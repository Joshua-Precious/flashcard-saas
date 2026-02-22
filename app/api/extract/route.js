import { NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, writeBatch } from 'firebase/firestore';

// Function to split text into chunks
function splitIntoChunks(text, maxChunkSize = 15000) {
    // Split by paragraphs first
    const paragraphs = text.split(/\n\s*\n/);
    const chunks = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
        // If adding this paragraph would exceed maxChunkSize, start a new chunk
        if ((currentChunk + paragraph).length > maxChunkSize && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
        }
        currentChunk += paragraph + '\n\n';
    }

    // Add the last chunk if it's not empty
    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

export async function POST(request) {
    try {
        const { docId } = await request.json();

        if (!docId) {
            return NextResponse.json(
                { error: "No document ID provided." },
                { status: 400 }
            );
        }

        try {
            // Read the uploaded file content from Firestore
            logger.info({ docId }, 'Reading file from Firestore');
            const uploadSnap = await getDoc(doc(db, 'uploads', docId));

            if (!uploadSnap.exists()) {
                return NextResponse.json(
                    { error: "Uploaded file not found." },
                    { status: 404 }
                );
            }

            const uploadData = uploadSnap.data();
            const extractedText = uploadData.content;

            if (!extractedText || extractedText.trim().length === 0) {
                throw new Error('No text could be extracted from the file');
            }

            logger.info('Text extracted successfully, creating chunks');

            // Split content into chunks
            const chunks = splitIntoChunks(extractedText);

            if (chunks.length === 0) {
                throw new Error('No valid text chunks could be created');
            }

            // Store chunks in Firestore using a batch write
            const batch = writeBatch(db);
            const chunkInfo = [];

            for (let i = 0; i < chunks.length; i++) {
                const chunkRef = doc(db, 'uploads', docId, 'chunks', `chunk_${i}`);
                batch.set(chunkRef, {
                    index: i,
                    content: chunks[i],
                    size: chunks[i].length,
                });
                chunkInfo.push({ index: i, size: chunks[i].length });
            }

            // Also store metadata on the parent document
            const uploadRef = doc(db, 'uploads', docId);
            batch.update(uploadRef, {
                totalChunks: chunks.length,
                chunkedAt: new Date().toISOString(),
            });

            await batch.commit();

            logger.info({ docId, totalChunks: chunks.length }, 'Chunks stored in Firestore');

            return NextResponse.json({
                success: true,
                message: 'File extracted and chunked successfully',
                metadata: {
                    docId,
                    originalFile: uploadData.originalName,
                    totalChunks: chunks.length,
                    chunks: chunkInfo,
                    timestamp: new Date().toISOString(),
                },
            });

        } catch (error) {
            logger.error({ err: error }, 'Error processing file');
            return NextResponse.json(
                { 
                    error: "Error processing file.",
                    details: error.message
                },
                { status: 500 }
            );
        }

    } catch (error) {
        logger.error({ err: error }, 'Error in extract route');
        return NextResponse.json(
            { error: "Error processing request." },
            { status: 500 }
        );
    }
} 