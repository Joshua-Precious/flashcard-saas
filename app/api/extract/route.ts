import { NextResponse, type NextRequest } from 'next/server';
import logger from '@/lib/logger';
import { db } from '@/lib/firebase';
import { doc, getDoc, writeBatch } from 'firebase/firestore';

interface ChunkInfo {
    index: number;
    size: number;
}

// Function to split text into chunks
function splitIntoChunks(text: string, maxChunkSize = 15000): string[] {
    const paragraphs = text.split(/\n\s*\n/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
        if ((currentChunk + paragraph).length > maxChunkSize && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
        }
        currentChunk += paragraph + '\n\n';
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

export async function POST(request: NextRequest) {
    try {
        const { docId } = await request.json() as { docId: string };

        if (!docId) {
            return NextResponse.json(
                { error: "No document ID provided." },
                { status: 400 }
            );
        }

        try {
            logger.info({ docId }, 'Reading file from Firestore');
            const uploadSnap = await getDoc(doc(db, 'uploads', docId));

            if (!uploadSnap.exists()) {
                return NextResponse.json(
                    { error: "Uploaded file not found." },
                    { status: 404 }
                );
            }

            const uploadData = uploadSnap.data();
            const extractedText = uploadData.content as string;

            if (!extractedText || extractedText.trim().length === 0) {
                throw new Error('No text could be extracted from the file');
            }

            logger.info('Text extracted successfully, creating chunks');

            const chunks = splitIntoChunks(extractedText);

            if (chunks.length === 0) {
                throw new Error('No valid text chunks could be created');
            }

            const batch = writeBatch(db);
            const chunkInfo: ChunkInfo[] = [];

            for (let i = 0; i < chunks.length; i++) {
                const chunkRef = doc(db, 'uploads', docId, 'chunks', `chunk_${i}`);
                batch.set(chunkRef, {
                    index: i,
                    content: chunks[i],
                    size: chunks[i].length,
                });
                chunkInfo.push({ index: i, size: chunks[i].length });
            }

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
            const err = error as Error;
            logger.error({ err }, 'Error processing file');
            return NextResponse.json(
                {
                    error: "Error processing file.",
                    details: err.message,
                },
                { status: 500 }
            );
        }

    } catch (error) {
        const err = error as Error;
        logger.error({ err }, 'Error in extract route');
        return NextResponse.json(
            { error: "Error processing request." },
            { status: 500 }
        );
    }
}
