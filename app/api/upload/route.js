import { writeFile, mkdir } from 'fs/promises';
import { NextResponse } from 'next/server';
import path from 'path';
import mammoth from 'mammoth';

// Allowed MIME types
const ALLOWED_TYPES = [
    'application/msword',                                        // DOC
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    'application/vnd.oasis.opendocument.text',                  // ODT
    'text/plain',                                               // TXT
    'application/rtf'                                           // RTF
];

async function convertDOCXToText(buffer) {
    try {
        console.log('Converting DOCX to text...');
        const result = await mammoth.extractRawText({ buffer });
        console.log('DOCX conversion successful');
        return result.value;
    } catch (error) {
        console.error('Error converting DOCX:', error);
        throw new Error(`Failed to convert DOCX: ${error.message}`);
    }
}

export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json(
                { error: "No file received." },
                { status: 400 }
            );
        }

        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json(
                { 
                    error: "Invalid file type. Only document files are allowed.",
                    allowedTypes: ALLOWED_TYPES
                },
                { status: 400 }
            );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Create unique filename base
        const timestamp = Date.now();
        const originalName = file.name;
        const fileNameBase = `${timestamp}-${path.parse(originalName).name}`;
        
        // Ensure uploads directory exists
        const uploadsDir = path.join(process.cwd(), 'public/uploads');
        await mkdir(uploadsDir, { recursive: true });

        let finalFileName;
        let fileContent;

        // Handle different file types
        if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            try {
                console.log('Converting DOCX to text:', originalName);
                fileContent = await convertDOCXToText(buffer);
                finalFileName = `${fileNameBase}.txt`;
                console.log('DOCX converted successfully');
            } catch (error) {
                console.error('DOCX conversion error:', error);
                return NextResponse.json(
                    { 
                        error: "Failed to convert DOCX file",
                        details: error.message 
                    },
                    { status: 500 }
                );
            }
        } else {
            // For text files, use the content directly
            fileContent = buffer.toString('utf-8');
            finalFileName = `${fileNameBase}.txt`;
        }

        // Save the file
        await writeFile(path.join(uploadsDir, finalFileName), fileContent);
        const fileUrl = `/uploads/${finalFileName}`;
        
        return NextResponse.json({ 
            message: "File uploaded successfully",
            filename: finalFileName,
            originalName: originalName,
            url: fileUrl
        });
        
    } catch (error) {
        console.error('Error uploading file:', error);
        return NextResponse.json(
            { error: "Error uploading file." },
            { status: 500 }
        );
    }
} 