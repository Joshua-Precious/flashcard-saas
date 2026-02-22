import { NextResponse, type NextRequest } from 'next/server';
import logger from '@/lib/logger';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface Flashcard {
    front: string;
    back: string;
}

interface GenerationResult {
    flashcards: Flashcard[];
    summary: string;
}

const systemPrompt = `You are a highly efficient quiz flashcard creator specialized in educational content. Your task is to:

1. Create a concise but comprehensive summary that:
   - Highlights the main concepts and key ideas
   - Lists important definitions
   - Explains critical relationships
   - Uses bullet points for clarity
   - Keeps it focused and relevant

2. Create exactly 10 high-quality flashcards that:
   - Cover the most important concepts
   - Include key definitions and terminology
   - Highlight critical relationships between concepts
   - Include notable examples or applications
   - Focus on testable material

YOU MUST RESPOND WITH ONLY THE FOLLOWING JSON STRUCTURE, NO OTHER TEXT:
{
    "flashcards": [
        {
            "front": "Question text here",
            "back": "Answer text here"
        }
    ],
    "summary": "Concise summary with bullet points using \\n for line breaks"
}

CRITICAL FORMATTING RULES:
1. Response must be PURE JSON - no markdown, no code blocks, no extra text
2. Use ONLY double quotes (") for strings and properties
3. "flashcards" must be an array of exactly 10 objects
4. Each flashcard object must have exactly two fields: "front" and "back"
5. Include a "summary" field with bullet points using \\n for line breaks
6. No trailing commas
7. No comments or additional fields
8. NEVER use special characters like ∞, ≥, ≤ - use regular ASCII alternatives
9. Escape all quotes within text content with backslash
10. Keep both flashcards and summary concise and clear
11. Use "- " for bullet points in summary`;

function splitIntoChunks(text: string, maxChunkSize = 100000): string[] {
    const paragraphs = text.split(/\n\s*\n/);
    const chunks: string[] = [];
    let currentChunk = '';
    let currentTokenCount = 0;

    const estimateTokens = (t: string): number => Math.ceil(t.length / 4);

    for (const paragraph of paragraphs) {
        const paragraphTokens = estimateTokens(paragraph);

        if (currentTokenCount + paragraphTokens > maxChunkSize && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
            currentTokenCount = 0;
        }

        if (paragraphTokens > maxChunkSize) {
            const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
            for (const sentence of sentences) {
                const sentenceTokens = estimateTokens(sentence);
                if (currentTokenCount + sentenceTokens > maxChunkSize && currentChunk.length > 0) {
                    chunks.push(currentChunk.trim());
                    currentChunk = '';
                    currentTokenCount = 0;
                }
                currentChunk += sentence + ' ';
                currentTokenCount += sentenceTokens;
            }
        } else {
            currentChunk += paragraph + '\n\n';
            currentTokenCount += paragraphTokens;
        }
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    chunks.forEach((chunk, i) => {
        logger.info({ chunk: i, estimatedTokens: estimateTokens(chunk) }, 'Chunk token estimate');
    });

    return chunks;
}

function cleanAndParseJSON(text: string): GenerationResult {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('No JSON structure found in response');
    }

    let jsonStr = jsonMatch[0];
    jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    try {
        return JSON.parse(jsonStr) as GenerationResult;
    } catch {
        logger.warn('Initial JSON parse failed, attempting to fix JSON');

        jsonStr = jsonStr
            .replace(/[∞]/g, 'infinity')
            .replace(/[≥]/g, '>=')
            .replace(/[≤]/g, '<=')
            .replace(/[−]/g, '-')
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/[\u2018\u2019]/g, "'");

        jsonStr = jsonStr.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
        jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
        jsonStr = jsonStr.replace(/:\s*([^"{}\[\],\s][^,}\]]*[^"{}\[\],\s])\s*([,}\]])/g, ':"$1"$2');
        jsonStr = jsonStr.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

        jsonStr = jsonStr.replace(/(?<!\\)"([^"]*)"(?=\s*[,}\]])/g, (_match, p1: string) => {
            return `"${p1.replace(/"/g, '\\"')}"`;
        });

        try {
            return JSON.parse(jsonStr) as GenerationResult;
        } catch {
            logger.warn('Second parse attempt failed, trying to extract valid parts');

            try {
                const flashcardsMatch = jsonStr.match(/"flashcards"\s*:\s*\[([\s\S]*?)\]/);
                const summaryMatch = jsonStr.match(/"summary"\s*:\s*"([^"]*?)"/);

                if (flashcardsMatch) {
                    const cardMatches = [...flashcardsMatch[1].matchAll(/\{([^{}]*)\}/g)];
                    const validCards = cardMatches
                        .map(match => {
                            try {
                                const cardStr = match[0].replace(/,\s*$/, '');
                                const card = JSON.parse(cardStr) as { front?: string; back?: string };
                                if (card.front && card.back) {
                                    return {
                                        front: String(card.front).trim(),
                                        back: String(card.back).trim(),
                                    };
                                }
                                return null;
                            } catch {
                                return null;
                            }
                        })
                        .filter((card): card is Flashcard => card !== null);

                    return {
                        flashcards: validCards,
                        summary: summaryMatch ? summaryMatch[1] : "- Content parsing error occurred.\n- Please try again.",
                    };
                }
            } catch (err) {
                logger.error({ err }, 'Failed to extract valid parts');
            }

            return {
                flashcards: [],
                summary: "- Failed to parse response.\n- Please try again.",
            };
        }
    }
}

async function makeCompletion(content: string): Promise<GenerationResult> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
                'X-Title': 'Flashcard Study Buddy',
            },
            body: JSON.stringify({
                model: 'deepseek/deepseek-r1-0528:free',
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt,
                    },
                    {
                        role: 'user',
                        content: `Create 10 flashcards and a concise summary from this text. YOUR RESPONSE MUST BE PURE JSON WITH NO OTHER TEXT:\n\n${content}`,
                    },
                ],
                temperature: 0.1,
                max_tokens: 2000,
                timeout: 25000,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const responseText = await response.text();
        logger.debug({ responseText }, 'Raw API response');

        let responseData: {
            error?: { message?: string };
            choices?: { message?: { content?: string } }[];
        };
        try {
            responseData = JSON.parse(responseText);
        } catch {
            logger.error('Failed to parse API response');
            throw new Error('Invalid JSON response from API');
        }

        if (!response.ok) {
            throw new Error(responseData.error?.message || 'Failed to process with AI');
        }

        if (!responseData.choices?.[0]?.message?.content) {
            logger.error({ responseData }, 'Unexpected API response structure');
            throw new Error('Invalid API response structure');
        }

        const llmResponse = responseData.choices[0].message.content.trim();
        logger.debug({ llmResponse }, 'LLM response content');

        let parsedResponse: GenerationResult;
        try {
            parsedResponse = JSON.parse(llmResponse) as GenerationResult;
        } catch {
            logger.warn('Direct parsing failed, attempting to clean response');
            parsedResponse = cleanAndParseJSON(llmResponse);
        }

        if (!parsedResponse || typeof parsedResponse !== 'object') {
            throw new Error('Invalid response format: not an object');
        }

        if (!Array.isArray(parsedResponse.flashcards)) {
            logger.error({ flashcards: parsedResponse.flashcards }, 'Invalid flashcards format');
            throw new Error('Invalid response format: flashcards must be an array');
        }

        const validFlashcards = parsedResponse.flashcards
            .filter((card): card is Flashcard => card != null && typeof card === 'object')
            .map(card => ({
                front: String(card.front || '').trim(),
                back: String(card.back || '').trim(),
            }))
            .filter(card => card.front && card.back);

        let summary = String(parsedResponse.summary || '').trim();
        if (!summary) {
            summary = "- No summary available.";
        }

        return {
            flashcards: validFlashcards,
            summary,
        };

    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Request timed out after 30 seconds');
        }
        logger.error({ err: error }, 'Error in makeCompletion');
        throw new Error(`AI processing failed: ${(error as Error).message}`);
    }
}

export async function POST(request: NextRequest) {
    try {
        const { docId, chunkIndex } = await request.json() as { docId: string; chunkIndex: number };

        if (!docId || chunkIndex === undefined) {
            return NextResponse.json(
                { error: "Missing docId or chunk index." },
                { status: 400 }
            );
        }

        try {
            const uploadSnap = await getDoc(doc(db, 'uploads', docId));

            if (!uploadSnap.exists()) {
                return NextResponse.json(
                    { error: "Upload document not found." },
                    { status: 404 }
                );
            }

            const uploadData = uploadSnap.data();
            const totalChunks = uploadData.totalChunks as number;

            if (chunkIndex >= totalChunks) {
                return NextResponse.json(
                    { error: "Chunk index out of range." },
                    { status: 400 }
                );
            }

            const chunkSnap = await getDoc(doc(db, 'uploads', docId, 'chunks', `chunk_${chunkIndex}`));

            if (!chunkSnap.exists()) {
                return NextResponse.json(
                    { error: "Chunk not found." },
                    { status: 404 }
                );
            }

            const chunkContent = chunkSnap.data().content as string;

            logger.info({ docId, chunkIndex }, 'Processing chunk with AI');
            const result = await makeCompletion(chunkContent);

            return NextResponse.json({
                success: true,
                message: 'Chunk processed successfully',
                chunkDetails: {
                    docId,
                    chunkIndex,
                    totalChunks,
                },
                result: {
                    flashcards: result.flashcards,
                    summary: result.summary,
                },
            });

        } catch (error) {
            const err = error as Error;
            logger.error({ err }, 'Error processing chunk');
            return NextResponse.json(
                {
                    error: "Error processing chunk.",
                    details: err.message,
                },
                { status: 500 }
            );
        }

    } catch (error) {
        const err = error as Error;
        logger.error({ err }, 'Error in generate route');
        return NextResponse.json(
            { error: "Error processing request." },
            { status: 500 }
        );
    }
}
