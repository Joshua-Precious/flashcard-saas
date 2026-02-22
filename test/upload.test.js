import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino';

const logger = pino({ level: 'info', transport: { target: 'pino-pretty', options: { colorize: true } } });

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testFileUpload(filePath) {
    try {
        const fileName = path.basename(filePath);
        logger.info({ fileName }, '=== Testing upload ===');
        
        // Read the test file
        const fileBuffer = await fs.readFile(filePath);
        
        // Create FormData and append file
        const formData = new FormData();
        const fileType = fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 
                        fileName.toLowerCase().endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 
                        'text/plain';
        
        const file = new File([fileBuffer], fileName, { type: fileType });
        formData.append('file', file);

        // Make the upload request
        logger.info('Sending upload request');
        const response = await fetch('http://localhost:3000/api/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(`Upload failed: ${result.error}\nDetails: ${result.details || 'No additional details'}`);
        }

        logger.info({ result }, 'Upload successful');

        return { success: true, result };
    } catch (error) {
        logger.error({ err: error, file: path.basename(filePath) }, 'Error testing file');
        return { success: false, error: error.message };
    }
}

// Get file path from command line argument
const filePath = process.argv[2];

if (!filePath) {
    logger.error('Please provide a file path as an argument.');
    logger.info('Usage: node upload.test.js <path-to-file>');
    logger.info('Example: node upload.test.js "../public/samples/test.pdf"');
    process.exit(1);
}

try {
    // Check if file exists
    await fs.access(filePath);
    await testFileUpload(filePath);
} catch (error) {
    if (error.code === 'ENOENT') {
        logger.error({ filePath }, 'File not found');
    } else {
        logger.error({ err: error }, 'Error');
    }
    process.exit(1);
} 