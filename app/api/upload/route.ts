import { NextResponse, type NextRequest } from 'next/server';
import path from 'path';
import mammoth from 'mammoth';
import logger from '@/lib/logger';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

// Allowed MIME types
const ALLOWED_TYPES = [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text',
    'text/plain',
    'application/rtf',
];

async function convertDOCXToText(buffer: Buffer): Promise<string> {
    try {
        logger.info('Converting DOCX to text');
        const result = await mammoth.extractRawText({ buffer });
        logger.info('DOCX conversion successful');
        return result.value;
    } catch (error) {
        const err = error as Error;
        logger.error({ err }, 'Error converting DOCX');
        throw new Error(`Failed to convert DOCX: ${err.message}`);
    }
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json(
                { error: "No file received." },
                { status: 400 }
            );
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json(
                {
                    error: "Invalid file type. Only document files are allowed.",
                    allowedTypes: ALLOWED_TYPES,
                },
                { status: 400 }
            );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const timestamp = Date.now();
        const originalName = file.name;
        const docId = `${timestamp}-${path.parse(originalName).name}`;

        let fileContent: string;

        if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            try {
                logger.info({ originalName }, 'Converting DOCX to text');
                fileContent = await convertDOCXToText(buffer);
                logger.info('DOCX converted successfully');
            } catch (error) {
                const err = error as Error;
                logger.error({ err }, 'DOCX conversion error');
                return NextResponse.json(
                    {
                        error: "Failed to convert DOCX file",
                        details: err.message,
                    },
                    { status: 500 }
                );
            }
        } else {
            fileContent = buffer.toString('utf-8');
        }

        await setDoc(doc(db, 'uploads', docId), {
            originalName,
            content: fileContent,
            mimeType: file.type,
            size: file.size,
            createdAt: new Date().toISOString(),
        });

        logger.info({ docId, originalName }, 'File stored in Firestore');

        return NextResponse.json({
            message: "File uploaded successfully",
            docId,
            originalName,
        });

    } catch (error) {
        const err = error as Error;
        logger.error({ err }, 'Error uploading file');
        return NextResponse.json(
            { error: "Error uploading file." },
            { status: 500 }
        );
    }
}
