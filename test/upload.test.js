import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testFileUpload(filePath) {
    try {
        const fileName = path.basename(filePath);
        console.log(`\n=== Testing upload for: ${fileName} ===\n`);
        
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
        console.log('Sending upload request...');
        const response = await fetch('http://localhost:3000/api/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(`Upload failed: ${result.error}\nDetails: ${result.details || 'No additional details'}`);
        }

        console.log('Upload successful!');
        console.log('Response:', result);
        
        // Try to read the converted file
        if (result.url) {
            const convertedFilePath = path.join(process.cwd(), 'public', result.url);
            const convertedContent = await fs.readFile(convertedFilePath, 'utf-8');
            console.log('\nConverted content preview (first 500 chars):');
            console.log('----------------------------------------');
            console.log(convertedContent.substring(0, 500));
            console.log('----------------------------------------\n');
        }

        return { success: true, result };
    } catch (error) {
        console.error(`Error testing ${path.basename(filePath)}:`, error);
        return { success: false, error: error.message };
    }
}

// Get file path from command line argument
const filePath = process.argv[2];

if (!filePath) {
    console.error('\nPlease provide a file path as an argument.');
    console.log('Usage: node upload.test.js <path-to-file>');
    console.log('Example: node upload.test.js "../public/samples/test.pdf"\n');
    process.exit(1);
}

try {
    // Check if file exists
    await fs.access(filePath);
    await testFileUpload(filePath);
} catch (error) {
    if (error.code === 'ENOENT') {
        console.error(`\nFile not found: ${filePath}\n`);
    } else {
        console.error('\nError:', error.message, '\n');
    }
    process.exit(1);
} 