'use client';

import React, { useState, useRef } from 'react';
import { Upload, X, File, Image, FileText, Archive } from 'lucide-react';

function generateUniqueId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default function FileUploadPage() {
    const [files, setFiles] = useState([]);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);
    const [uploadStatus, setUploadStatus] = useState({});
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [generationStatus, setGenerationStatus] = useState({});
    const [selectedFlashcards, setSelectedFlashcards] = useState(null);
    const [currentCard, setCurrentCard] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [chunkStatus, setChunkStatus] = useState({});
    const [summaries, setSummaries] = useState([]);
    const [currentChunkIndex, setCurrentChunkIndex] = useState(0);

    const ALLOWED_TYPES = [
        'application/pdf',                                           // PDF
        'application/msword',                                        // DOC
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
        'application/vnd.oasis.opendocument.text',                  // ODT
        'text/plain',                                               // TXT
        'application/rtf'                                           // RTF
    ];

    const handleFiles = (fileList) => {
        const validFiles = Array.from(fileList).filter(file => ALLOWED_TYPES.includes(file.type));
        const invalidFiles = Array.from(fileList).filter(file => !ALLOWED_TYPES.includes(file.type));
        
        if (invalidFiles.length > 0) {
            alert(`The following files are not allowed: ${invalidFiles.map(f => f.name).join(', ')}\n\nOnly PDF and document files are allowed.`);
        }

        if (validFiles.length > 0) {
            const newFiles = validFiles.map(file => ({
                id: generateUniqueId(),
                file: file,
                name: file.name,
                size: file.size,
                type: file.type
            }));
            setFiles(prev => [...prev, ...newFiles]);
        }
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
        setDragActive(true);
        } else if (e.type === "dragleave") {
        setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFiles(e.dataTransfer.files);
        }
    };

    const handleChange = (e) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
        handleFiles(e.target.files);
        }
    };

    const onButtonClick = () => {
        fileInputRef.current?.click();
    };

    const removeFile = (id) => {
        setFiles(prev => {
        const updated = prev.filter(file => file.id !== id);
        // Clean up preview URLs to prevent memory leaks
        const removedFile = prev.find(file => file.id === id);
        if (removedFile && removedFile.preview) {
            URL.revokeObjectURL(removedFile.preview);
        }
        return updated;
        });
    };

    const clearAllFiles = () => {
        files.forEach(file => {
        if (file.preview) {
            URL.revokeObjectURL(file.preview);
        }
        });
        setFiles([]);
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getFileIcon = (type) => {
        if (type.startsWith('image/')) return <Image className="w-5 h-5 text-green-500" />;
        if (type.startsWith('text/') || type.includes('document')) return <FileText className="w-5 h-5 text-blue-500" />;
        if (type.includes('zip') || type.includes('rar') || type.includes('archive')) return <Archive className="w-5 h-5 text-orange-500" />;
        return <File className="w-5 h-5 text-gray-500" />;
    };

    const generateFromFile = async (fileId, fileUrl) => {
        try {
            setGenerationStatus(prev => ({
                ...prev,
                [fileId]: { 
                    status: 'processing',
                    message: 'Extracting and chunking content...'
                }
            }));

            // First, extract and chunk the content
            const extractFormData = new FormData();
            extractFormData.append('fileUrl', fileUrl);

            const extractResponse = await fetch('/api/extract', {
                method: 'POST',
                body: extractFormData
            });

            const extractData = await extractResponse.json();

            if (!extractResponse.ok) {
                throw new Error(extractData.error || 'Extraction failed');
            }

            setChunkStatus(prev => ({
                ...prev,
                [fileId]: {
                    totalChunks: extractData.metadata.totalChunks,
                    processedChunks: 0,
                    chunks: extractData.metadata.chunks
                }
            }));

            // Process each chunk
            const allFlashcards = [];
            const allSummaries = [];

            for (let i = 0; i < extractData.metadata.totalChunks; i++) {
                setGenerationStatus(prev => ({
                    ...prev,
                    [fileId]: { 
                        status: 'processing',
                        message: `Processing chunk ${i + 1} of ${extractData.metadata.totalChunks}...`
                    }
                }));

                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        filename: extractData.metadata.originalFile,
                        chunkIndex: i
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Generation failed');
                }

                // Add null checks for the response data
                if (data.result && Array.isArray(data.result.flashcards)) {
                    allFlashcards.push(...data.result.flashcards);
                }
                if (data.result && typeof data.result.summary === 'string') {
                    allSummaries.push(data.result.summary);
                }

                setChunkStatus(prev => ({
                    ...prev,
                    [fileId]: {
                        ...prev[fileId],
                        processedChunks: i + 1
                    }
                }));
            }

            // Ensure we have valid data before updating state
            if (allFlashcards.length === 0) {
                throw new Error('No valid flashcards were generated');
            }

            setGenerationStatus(prev => ({
                ...prev,
                [fileId]: { 
                    status: 'completed',
                    result: allFlashcards,
                    summaries: allSummaries.length > 0 ? allSummaries : ['No summary available'],
                    message: 'Processing complete'
                }
            }));

            console.log('Generated flashcards:', allFlashcards);
            console.log('Generated summaries:', allSummaries);

        } catch (error) {
            console.error('Error generating from file:', error);
            setGenerationStatus(prev => ({
                ...prev,
                [fileId]: { 
                    status: 'error',
                    error: error.message,
                    message: 'Error: ' + error.message
                }
            }));
        }
    };

    const uploadFiles = async () => {
        for (const fileObj of files) {
            try {
                setUploadStatus(prev => ({
                    ...prev,
                    [fileObj.id]: { status: 'uploading', progress: 0 }
                }));

                const formData = new FormData();
                formData.append('file', fileObj.file);

                const uploadResponse = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });

                const uploadData = await uploadResponse.json();

                if (!uploadResponse.ok) {
                    throw new Error(uploadData.error || 'Upload failed');
                }

                setUploadStatus(prev => ({
                    ...prev,
                    [fileObj.id]: { 
                        status: 'completed',
                        url: uploadData.url
                    }
                }));

                // Add to uploaded files list
                setUploadedFiles(prev => [...prev, {
                    id: fileObj.id,
                    name: fileObj.name,
                    type: fileObj.type,
                    size: fileObj.size,
                    url: uploadData.url,
                    uploadedAt: new Date().toISOString()
                }]);

                // Automatically start generation after successful upload
                await generateFromFile(fileObj.id, uploadData.url);

            } catch (error) {
                console.error('Error uploading file:', error);
                setUploadStatus(prev => ({
                    ...prev,
                    [fileObj.id]: { 
                        status: 'error',
                        error: error.message
                    }
                }));
            }
        }
    };

    // Function to format date
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const showFlashcards = (flashcards) => {
        setSelectedFlashcards(flashcards);
        setCurrentCard(0);
        setIsFlipped(false);
    };

    const nextCard = () => {
        if (selectedFlashcards && currentCard < selectedFlashcards.length - 1) {
            setCurrentCard(prev => prev + 1);
            setIsFlipped(false);
        }
    };

    const prevCard = () => {
        if (selectedFlashcards && currentCard > 0) {
            setCurrentCard(prev => prev - 1);
            setIsFlipped(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
            {/* Back Button */}
            <div className="absolute top-4 left-4">
                <a
                    href="/"
                    className="px-4 py-2 bg-white text-blue-600 rounded-lg shadow-md hover:bg-blue-50 transition-colors duration-200 flex items-center space-x-2 border border-blue-200"
                >
                    <span>← Back to Home</span>
                </a>
            </div>

            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="text-center mb-12">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                    Study Buddy
                </h1>
                <p className='text-lg text-gray-900 max-w-xl mx-auto pb-6'>
                    Study Buddy is a tool that helps you study for your exams.
                </p>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                    Upload your study materials here for easy access.
                </p>
                </div>

                {/* Upload Area */}
                <div className="max-w-4xl mx-auto mb-8">
                <div
                    className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
                    dragActive 
                        ? 'border-blue-500 bg-blue-50 scale-105' 
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".doc,.docx,.odt,.txt,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text,text/plain,application/rtf"
                    onChange={handleChange}
                    className="hidden"
                    />
                    
                    <div className="flex flex-col items-center space-y-4">
                    <div className={`p-4 rounded-full transition-colors ${
                        dragActive ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                        <Upload className={`w-12 h-12 ${
                        dragActive ? 'text-blue-600' : 'text-gray-400'
                        }`} />
                    </div>
                    
                    <div>
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">
                        {dragActive ? 'Drop your files here!' : 'Upload your documents'}
                        </h3>
                        <p className="text-gray-500 mb-2">
                        Drag and drop files here, or{' '}
                        <button
                            onClick={onButtonClick}
                            className="text-blue-600 hover:text-blue-700 font-medium underline"
                        >
                            browse
                        </button>
                        </p>
                        <p className="text-sm text-gray-400">
                            Allowed files: DOC, DOCX, ODT, TXT, RTF
                        </p>
                    </div>
                    
                    <button
                        onClick={onButtonClick}
                        className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-md hover:shadow-lg"
                    >
                        Select Files
                    </button>
                    </div>
                </div>
                </div>

                {/* Uploaded Files Container */}
                {uploadedFiles.length > 0 && (
                    <div className="max-w-4xl mx-auto mt-12">
                        <div className="bg-white rounded-xl shadow-lg border border-gray-200">
                            <div className="px-6 py-4 border-b border-gray-200">
                                <h2 className="text-xl font-semibold text-gray-800">
                                    Your Study Materials
x                                </h2>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {uploadedFiles.map((file) => (
                                    <div key={`uploaded-${file.id}`} className="p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-4">
                                                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                                    {getFileIcon(file.type)}
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-medium text-gray-900">
                                                        {file.name}
                                                    </h3>
                                                    <p className="text-sm text-gray-500">
                                                        {formatFileSize(file.size)} • Uploaded {formatDate(file.uploadedAt)}
                                                    </p>
                                                    {generationStatus[file.id] && (
                                                        <div className="mt-1">
                                                            <p className={`text-sm ${
                                                                generationStatus[file.id].status === 'completed' ? 'text-green-500' :
                                                                generationStatus[file.id].status === 'error' ? 'text-red-500' :
                                                                'text-blue-500'
                                                            }`}>
                                                                {generationStatus[file.id].message}
                                                            </p>
                                                            {generationStatus[file.id].status === 'completed' && generationStatus[file.id].result && (
                                                                <div className="mt-2">
                                                                    <p className="text-sm text-gray-600">
                                                                        {Array.isArray(generationStatus[file.id].result) ? generationStatus[file.id].result.length : 0} flashcards created
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <a
                                                    href={file.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                                                >
                                                    View File
                                                </a>
                                                {!generationStatus[file.id] && (
                                                    <button
                                                        onClick={() => generateFromFile(file.id, file.url)}
                                                        className="px-3 py-1 text-sm text-green-600 hover:text-green-700 hover:bg-green-50 rounded-md transition-colors"
                                                    >
                                                        Process
                                                    </button>
                                                )}
                                                {generationStatus[file.id] && generationStatus[file.id].status === 'completed' && (
                                                    <button
                                                        onClick={() => {
                                                            const flashcards = Array.isArray(generationStatus[file.id].result) ? generationStatus[file.id].result : [];
                                                            setSelectedFlashcards(flashcards);
                                                            setSummaries(generationStatus[file.id].summaries || []);
                                                            setCurrentCard(0);
                                                            setIsFlipped(false);
                                                        }}
                                                        className="px-3 py-1 text-sm bg-green-600 text-white hover:bg-green-700 rounded-md transition-colors ml-2"
                                                    >
                                                        Study
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Current Upload List */}
                {files.length > 0 && (
                    <div className="max-w-4xl mx-auto mt-8">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-800">
                                    Files to Upload ({files.length})
                                </h2>
                                <div className="space-x-3">
                                    <button
                                        onClick={clearAllFiles}
                                        className="text-sm text-gray-500 hover:text-red-600 transition-colors"
                                    >
                                        Clear All
                                    </button>
                                    <button
                                        onClick={uploadFiles}
                                        className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
                                    >
                                        Upload Files
                                    </button>
                                </div>
                            </div>
                            
                            <div className="divide-y divide-gray-100">
                                {files.map((fileObj) => (
                                    <div key={`file-${fileObj.id}`} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center space-x-4">
                                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                                {getFileIcon(fileObj.type)}
                                            </div>
                                            
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-sm font-medium text-gray-900 truncate">
                                                    {fileObj.name}
                                                </h3>
                                                <p className="text-sm text-gray-500">
                                                    {formatFileSize(fileObj.size)} • {fileObj.type || 'Unknown type'}
                                                </p>
                                                {uploadStatus[fileObj.id] && (
                                                    <p className={`text-sm ${
                                                        uploadStatus[fileObj.id].status === 'completed' ? 'text-green-500' :
                                                        uploadStatus[fileObj.id].status === 'error' ? 'text-red-500' :
                                                        'text-blue-500'
                                                    }`}>
                                                        {uploadStatus[fileObj.id].status === 'uploading' && 'Uploading...'}
                                                        {uploadStatus[fileObj.id].status === 'completed' && 'Upload complete'}
                                                        {uploadStatus[fileObj.id].status === 'error' && uploadStatus[fileObj.id].error}
                                                    </p>
                                                )}
                                            </div>
                                            
                                            <button
                                                onClick={() => removeFile(fileObj.id)}
                                                className="flex-shrink-0 p-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-red-50"
                                                title="Remove file"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {files.length === 0 && (
                <div className="text-center text-gray-500 mt-12">
                    <p>No files selected yet. Start by uploading some files above!</p>
                </div>
                )}

                {/* Processing Status */}
                {Object.entries(generationStatus).map(([fileId, status]) => {
                    const file = uploadedFiles?.find(f => f.id === fileId);
                    return (
                    <div key={`status-${fileId}`} className="bg-white rounded-lg shadow-md p-6 mb-4">
                        <h3 className="font-semibold mb-2">
                            {file?.name || 'File'}
                        </h3>
                        <div className="text-sm text-gray-600 mb-2">{status.message}</div>
                        
                        {chunkStatus[fileId] && (
                            <div className="mb-4">
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-blue-500 transition-all duration-500"
                                        style={{
                                            width: `${(chunkStatus[fileId].processedChunks / chunkStatus[fileId].totalChunks) * 100}%`
                                        }}
                                    />
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {chunkStatus[fileId].processedChunks} of {chunkStatus[fileId].totalChunks} chunks processed
                                </div>
                            </div>
                        )}

                        {status.status === 'completed' && (
                            <div className="mt-4">
                                <button
                                    onClick={() => {
                                        const flashcards = Array.isArray(status.result) ? status.result : [];
                                        setSelectedFlashcards(flashcards);
                                        setSummaries(status.summaries || []);
                                        setCurrentCard(0);
                                        setIsFlipped(false);
                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                    Study Flashcards
                                </button>
                            </div>
                        )}
                    </div>
                    );
                })}

                {/* Flashcard Modal */}
                {selectedFlashcards && selectedFlashcards.length > 0 && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full flashcard-modal">
                            <div className="flashcard-modal-content">
                                {/* Close Button */}
                                <button
                                    onClick={() => {
                                        setSelectedFlashcards(null);
                                        setCurrentCard(0);
                                        setIsFlipped(false);
                                    }}
                                    className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                                >
                                    <X className="w-6 h-6" />
                                </button>

                                {/* Summary Section */}
                                <div className="mb-8">
                                    <h3 className="font-bold text-xl mb-3">Summary</h3>
                                    <div className="bg-gray-50 rounded-lg p-4 text-gray-700">
                                        {summaries && summaries[currentChunkIndex] || 'No summary available'}
                                    </div>
                                </div>

                                {/* Flashcard Section */}
                                <div className="flex-1 min-h-[400px] flex flex-col">
                                    <h3 className="font-bold text-xl mb-4">Flashcard {currentCard + 1} of {selectedFlashcards.length}</h3>
                                    <div className="flashcard-container flex-1">
                                        <div 
                                            className={`flashcard ${isFlipped ? 'flipped' : ''}`}
                                            onClick={() => setIsFlipped(!isFlipped)}
                                        >
                                            {/* Front */}
                                            <div className="flashcard-front bg-white border-2 border-blue-200 rounded-lg">
                                                <div className="flashcard-content">
                                                    <div className="text-xl text-gray-800">
                                                        {selectedFlashcards[currentCard]?.front || 'No question available'}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Back */}
                                            <div className="flashcard-back bg-blue-50 border-2 border-blue-200 rounded-lg">
                                                <div className="flashcard-content">
                                                    <div className="text-xl text-gray-800 mb-4">
                                                        {selectedFlashcards[currentCard]?.back || 'No answer available'}
                                                    </div>
                                                    {/* Per-question summary */}
                                                    {selectedFlashcards[currentCard]?.summary && (
                                                        <div className="mt-4 pt-4 border-t border-blue-200">
                                                            <h4 className="text-sm font-semibold text-gray-600 mb-2">Additional Context:</h4>
                                                            <div className="text-sm text-gray-700">
                                                                {selectedFlashcards[currentCard].summary}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Navigation */}
                                    <div className="flashcard-navigation">
                                        <div className="flex items-center justify-between">
                                            <button
                                                onClick={() => {
                                                    setIsFlipped(false);
                                                    prevCard();
                                                }}
                                                disabled={currentCard === 0}
                                                className="px-6 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                                            >
                                                ← Previous
                                            </button>
                                            <button
                                                onClick={() => setIsFlipped(!isFlipped)}
                                                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                                            >
                                                {isFlipped ? 'Show Question' : 'Show Answer'}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setIsFlipped(false);
                                                    nextCard();
                                                }}
                                                disabled={currentCard === selectedFlashcards.length - 1}
                                                className="px-6 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                                            >
                                                Next →
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
} 