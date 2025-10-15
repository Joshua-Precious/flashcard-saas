import { NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

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

async function extractTextFromFile(filePath) {
    try {
        // All files should be text files at this point
        const content = await readFile(filePath, 'utf-8');
        
        // Basic cleanup of any remaining control characters
        return content
            .replace(/\0/g, '') // Remove null characters
            .replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
            .trim();
    } catch (error) {
        console.error('Error reading file:', error);
        throw new Error(`Failed to read file: ${error.message}`);
    }
}

export async function POST(request) {
    try {
        const formData = await request.formData();
        const fileUrl = formData.get('fileUrl');

        if (!fileUrl) {
            return NextResponse.json(
                { error: "No file URL provided." },
                { status: 400 }
            );
        }

        // Extract filename from URL and clean it
        const filename = decodeURIComponent(fileUrl.split('/').pop());
        
        // Construct full file path
        const filePath = path.join(process.cwd(), 'public/uploads', filename);
        
        try {
            // Extract text from file
            console.log('Reading file:', filename);
            const extractedText = await extractTextFromFile(filePath);
            
            if (!extractedText || extractedText.trim().length === 0) {
                throw new Error('No text could be extracted from the file');
            }

            console.log('Text extracted successfully, creating chunks...');
            
            // Split content into chunks
            const chunks = splitIntoChunks(extractedText);
            
            if (chunks.length === 0) {
                throw new Error('No valid text chunks could be created');
            }

            // Create a directory for storing chunks if it doesn't exist
            const chunksDir = path.join(process.cwd(), 'public/chunks', filename.replace(/\.[^/.]+$/, ''));
            await mkdir(chunksDir, { recursive: true });

            // Store each chunk in a separate file
            const chunkPromises = chunks.map(async (chunk, index) => {
                const chunkPath = path.join(chunksDir, `chunk_${index}.txt`);
                await writeFile(chunkPath, chunk);
                return {
                    index,
                    path: chunkPath,
                    size: chunk.length
                };
            });

            const chunkInfo = await Promise.all(chunkPromises);

            // Store metadata about the chunks
            const metadata = {
                originalFile: filename,
                totalChunks: chunks.length,
                chunks: chunkInfo,
                timestamp: new Date().toISOString()
            };

            const metadataPath = path.join(chunksDir, 'metadata.json');
            await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

            return NextResponse.json({
                success: true,
                message: 'File extracted and chunked successfully',
                metadata: {
                    ...metadata,
                    chunks: chunkInfo.map(chunk => ({
                        index: chunk.index,
                        size: chunk.size
                    }))
                }
            });

        } catch (error) {
            console.error('Error processing file:', error);
            return NextResponse.json(
                { 
                    error: "Error processing file.",
                    details: error.message
                },
                { status: 500 }
            );
        }

    } catch (error) {
        console.error('Error in extract route:', error);
        return NextResponse.json(
            { error: "Error processing request." },
            { status: 500 }
        );
    }
} 