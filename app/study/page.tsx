'use client';

import React, { useState, useRef, type ChangeEvent, type DragEvent } from 'react';
import { Upload, X, File, Image, FileText, Archive, ChevronDown, ChevronUp } from 'lucide-react';
import logger from '@/lib/logger.browser';

interface FileItem {
    id: string;
    file: File;
    name: string;
    size: number;
    type: string;
    preview?: string;
}

interface UploadedFile {
    id: string;
    name: string;
    type: string;
    size: number;
    docId: string;
    uploadedAt: string;
    url?: string;
}

interface UploadStatusEntry {
    status: 'uploading' | 'completed' | 'error';
    progress?: number;
    docId?: string;
    error?: string;
}

interface Flashcard {
    front: string;
    back: string;
    summary?: string;
}

interface GenerationStatusEntry {
    status: 'processing' | 'completed' | 'error';
    message: string;
    result?: Flashcard[];
    summaries?: string[];
    error?: string;
}

interface ChunkStatusEntry {
    totalChunks: number;
    processedChunks: number;
    chunks?: { index: number; size: number }[];
}

function generateUniqueId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default function FileUploadPage() {
    const [files, setFiles] = useState<FileItem[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadStatus, setUploadStatus] = useState<Record<string, UploadStatusEntry>>({});
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [generationStatus, setGenerationStatus] = useState<Record<string, GenerationStatusEntry>>({});
    const [selectedFlashcards, setSelectedFlashcards] = useState<Flashcard[] | null>(null);
    const [currentCard, setCurrentCard] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [chunkStatus, setChunkStatus] = useState<Record<string, ChunkStatusEntry>>({});
    const [summaries, setSummaries] = useState<string[]>([]);
    const [isSummaryOpen, setIsSummaryOpen] = useState(false);

    const ALLOWED_TYPES = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.oasis.opendocument.text',
        'text/plain',
        'application/rtf',
    ];

    const handleFiles = (fileList: FileList) => {
        const validFiles = Array.from(fileList).filter(file => ALLOWED_TYPES.includes(file.type));
        const invalidFiles = Array.from(fileList).filter(file => !ALLOWED_TYPES.includes(file.type));

        if (invalidFiles.length > 0) {
            alert(`The following files are not allowed: ${invalidFiles.map(f => f.name).join(', ')}\n\nOnly PDF and document files are allowed.`);
        }

        if (validFiles.length > 0) {
            const newFiles: FileItem[] = validFiles.map(file => ({
                id: generateUniqueId(),
                file: file,
                name: file.name,
                size: file.size,
                type: file.type,
            }));
            setFiles(prev => [...prev, ...newFiles]);
        }
    };

    const handleDrag = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFiles(e.dataTransfer.files);
        }
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            handleFiles(e.target.files);
        }
    };

    const onButtonClick = () => {
        fileInputRef.current?.click();
    };

    const removeFile = (id: string) => {
        setFiles(prev => {
            const updated = prev.filter(file => file.id !== id);
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

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getFileIcon = (type: string) => {
        if (type.startsWith('image/')) return <Image className="w-5 h-5 text-green-500" />;
        if (type.startsWith('text/') || type.includes('document')) return <FileText className="w-5 h-5 text-blue-500" />;
        if (type.includes('zip') || type.includes('rar') || type.includes('archive')) return <Archive className="w-5 h-5 text-orange-500" />;
        return <File className="w-5 h-5 text-gray-500" />;
    };

    const generateFromFile = async (fileId: string, docId: string) => {
        try {
            setGenerationStatus(prev => ({
                ...prev,
                [fileId]: {
                    status: 'processing',
                    message: 'Extracting and chunking content...',
                },
            }));

            const extractResponse = await fetch('/api/extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ docId }),
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
                    chunks: extractData.metadata.chunks,
                },
            }));

            const allFlashcards: Flashcard[] = [];
            const allSummaries: string[] = [];

            for (let i = 0; i < extractData.metadata.totalChunks; i++) {
                setGenerationStatus(prev => ({
                    ...prev,
                    [fileId]: {
                        status: 'processing',
                        message: `Processing chunk ${i + 1} of ${extractData.metadata.totalChunks}...`,
                    },
                }));

                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        docId: extractData.metadata.docId,
                        chunkIndex: i,
                    }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Generation failed');
                }

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
                        processedChunks: i + 1,
                    },
                }));
            }

            if (allFlashcards.length === 0) {
                throw new Error('No valid flashcards were generated');
            }

            setGenerationStatus(prev => ({
                ...prev,
                [fileId]: {
                    status: 'completed',
                    result: allFlashcards,
                    summaries: allSummaries.length > 0 ? allSummaries : ['No summary available'],
                    message: 'Processing complete',
                },
            }));

            logger.info({ flashcardCount: allFlashcards.length }, 'Generated flashcards');
            logger.info({ summaryCount: allSummaries.length }, 'Generated summaries');
        } catch (error) {
            const err = error as Error;
            logger.error({ err }, 'Error generating from file');
            setGenerationStatus(prev => ({
                ...prev,
                [fileId]: {
                    status: 'error',
                    error: err.message,
                    message: 'Error: ' + err.message,
                },
            }));
        }
    };

    const uploadFiles = async () => {
        for (const fileObj of files) {
            try {
                setUploadStatus(prev => ({
                    ...prev,
                    [fileObj.id]: { status: 'uploading', progress: 0 },
                }));

                const formData = new FormData();
                formData.append('file', fileObj.file);

                const uploadResponse = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                });

                const uploadData = await uploadResponse.json();

                if (!uploadResponse.ok) {
                    throw new Error(uploadData.error || 'Upload failed');
                }

                setUploadStatus(prev => ({
                    ...prev,
                    [fileObj.id]: {
                        status: 'completed',
                        docId: uploadData.docId,
                    },
                }));

                setUploadedFiles(prev => [...prev, {
                    id: fileObj.id,
                    name: fileObj.name,
                    type: fileObj.type,
                    size: fileObj.size,
                    docId: uploadData.docId,
                    uploadedAt: new Date().toISOString(),
                }]);

                await generateFromFile(fileObj.id, uploadData.docId);
            } catch (error) {
                const err = error as Error;
                logger.error({ err }, 'Error uploading file');
                setUploadStatus(prev => ({
                    ...prev,
                    [fileObj.id]: {
                        status: 'error',
                        error: err.message,
                    },
                }));
            }
        }
    };

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
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
            <div className="absolute top-4 left-4 md:top-6 md:left-6 z-10">
                <a
                    href="/"
                    className="px-3 py-2 md:px-5 md:py-2.5 bg-white text-gray-700 font-medium rounded-full shadow-sm hover:shadow-md hover:bg-gray-50 transition-all duration-200 flex items-center space-x-2 border border-gray-200 text-sm md:text-base"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    <span className="hidden md:inline">Back to Home</span>
                    <span className="md:hidden">Back</span>
                </a>
            </div>

            <div className="container mx-auto px-4 py-16 md:py-16">
                {/* Header */}
                <div className="text-center mb-10 md:mb-16 mt-8 md:mt-0">
                    <h1 className="text-3xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 mb-4 md:mb-6 tracking-tight">
                        Study Buddy
                    </h1>
                    <p className="text-lg md:text-xl text-gray-700 max-w-2xl mx-auto leading-relaxed px-2">
                        Upload your study materials to instantly generate AI-powered flashcards and comprehensive summaries.
                    </p>
                </div>

                {/* Upload Area */}
                <div className="max-w-4xl mx-auto mb-10 md:mb-12">
                    <div
                        className={`relative border-2 border-dashed rounded-3xl p-6 md:p-12 text-center transition-all duration-300 bg-white shadow-sm hover:shadow-md ${
                            dragActive
                                ? 'border-blue-500 bg-blue-50/50 scale-[1.02]'
                                : 'border-gray-200 hover:border-blue-400'
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

                            <div className="space-y-3">
                                <h3 className="text-2xl font-bold text-gray-800">
                                    {dragActive ? 'Drop your files here!' : 'Upload your documents'}
                                </h3>
                                <p className="text-gray-500 text-lg">
                                    Drag and drop files here, or{' '}
                                    <button
                                        onClick={onButtonClick}
                                        className="text-blue-600 hover:text-blue-700 font-semibold underline decoration-2 underline-offset-4 transition-colors"
                                    >
                                        browse
                                    </button>
                                </p>
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full border border-gray-100">
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Allowed formats:</span>
                                    <span className="text-sm text-gray-600 font-mono">DOC, DOCX, ODT, TXT, RTF</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Uploaded Files Container */}
                {uploadedFiles.length > 0 && (
                    <div className="max-w-4xl mx-auto mt-12 md:mt-16">
                        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                            <div className="px-6 md:px-8 py-6 border-b border-gray-100 bg-gray-50/50">
                                <h2 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-3">
                                    <span className="text-blue-600">📚</span> Your Study Materials
                                </h2>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {uploadedFiles.map((file) => (
                                    <div key={`uploaded-${file.id}`} className="p-4 md:p-6 hover:bg-gray-50/80 transition-all duration-200 group">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0">
                                            <div className="flex items-start md:items-center space-x-4 md:space-x-5">
                                                <div className="w-12 h-12 md:w-14 md:h-14 flex-shrink-0 bg-white shadow-sm border border-gray-100 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                                                    {getFileIcon(file.type)}
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="text-base md:text-lg font-bold text-gray-900 mb-1 truncate max-w-[200px] md:max-w-none">
                                                        {file.name}
                                                    </h3>
                                                    <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs md:text-sm font-medium text-gray-500">
                                                        <span className="bg-gray-100 px-2.5 py-1 rounded-md">{formatFileSize(file.size)}</span>
                                                        <span>•</span>
                                                        <span>Uploaded {formatDate(file.uploadedAt)}</span>
                                                    </div>
                                                    {generationStatus[file.id] && (
                                                        <div className="mt-2">
                                                            <p className={`text-sm ${
                                                                generationStatus[file.id].status === 'completed' ? 'text-green-500' :
                                                                generationStatus[file.id].status === 'error' ? 'text-red-500' :
                                                                'text-blue-500'
                                                            }`}>
                                                                {generationStatus[file.id].message}
                                                            </p>
                                                            {generationStatus[file.id].status === 'completed' && generationStatus[file.id].result && (
                                                                <div className="mt-1">
                                                                    <p className="text-xs md:text-sm text-gray-600">
                                                                        {Array.isArray(generationStatus[file.id].result) ? generationStatus[file.id].result!.length : 0} flashcards created
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2 md:space-x-3 w-full md:w-auto justify-end mt-2 md:mt-0 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                <a
                                                    href={file.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex-1 md:flex-none text-center px-4 py-2 text-xs md:text-sm font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-all duration-200 border border-transparent hover:border-blue-100"
                                                >
                                                    View File
                                                </a>
                                                {!generationStatus[file.id] && (
                                                    <button
                                                        onClick={() => generateFromFile(file.id, file.docId)}
                                                        className="flex-1 md:flex-none justify-center px-4 py-2 md:px-5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                                        Process
                                                    </button>
                                                )}
                                                {generationStatus[file.id] && generationStatus[file.id].status === 'completed' && (
                                                    <button
                                                        onClick={() => {
                                                            const flashcards = Array.isArray(generationStatus[file.id].result) ? generationStatus[file.id].result! : [];
                                                            setSelectedFlashcards(flashcards);
                                                            setSummaries(generationStatus[file.id].summaries || []);
                                                            setCurrentCard(0);
                                                            setIsFlipped(false);
                                                        }}
                                                        className="flex-1 md:flex-none justify-center px-4 py-2 md:px-5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2 md:ml-2"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
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
                    <div className="max-w-4xl mx-auto mt-10 md:mt-12">
                        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
                            <div className="px-6 md:px-8 py-5 md:py-6 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
                                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                                    <span className="text-indigo-600">📤</span> Files to Upload ({files.length})
                                </h2>
                                <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto justify-end">
                                    <button
                                        onClick={clearAllFiles}
                                        className="text-sm font-semibold text-gray-500 hover:text-red-600 transition-colors px-3 py-2 rounded-lg hover:bg-red-50"
                                    >
                                        Clear All
                                    </button>
                                    <button
                                        onClick={uploadFiles}
                                        className="px-5 py-2.5 md:px-6 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2"
                                    >
                                        <Upload className="w-4 h-4" />
                                        Upload Files
                                    </button>
                                </div>
                            </div>

                            <div className="divide-y divide-gray-100">
                                {files.map((fileObj) => (
                                    <div key={`file-${fileObj.id}`} className="px-6 md:px-8 py-5 hover:bg-gray-50/80 transition-all duration-200 group">
                                        <div className="flex items-center space-x-4 md:space-x-5">
                                            <div className="w-12 h-12 bg-white shadow-sm border border-gray-100 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                                                {getFileIcon(fileObj.type)}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-base font-bold text-gray-900 truncate mb-1">
                                                    {fileObj.name}
                                                </h3>
                                                <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm font-medium text-gray-500">
                                                    <span className="bg-gray-100 px-2 py-0.5 rounded">{formatFileSize(fileObj.size)}</span>
                                                    <span>•</span>
                                                    <span className="truncate max-w-[100px] md:max-w-none">{fileObj.type || 'Unknown type'}</span>
                                                </div>
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
                                                className="flex-shrink-0 p-2.5 text-gray-400 hover:text-red-500 transition-all duration-200 rounded-full hover:bg-red-50 md:opacity-0 group-hover:opacity-100 opacity-100"
                                                title="Remove file"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {files.length === 0 && uploadedFiles.length === 0 && (
                    <div className="text-center mt-16 p-12 bg-white/50 rounded-3xl border border-gray-100 border-dashed max-w-2xl mx-auto">
                        <div className="text-4xl mb-4 opacity-50">📄</div>
                        <p className="text-lg text-gray-500 font-medium">No files selected yet.</p>
                        <p className="text-gray-400 mt-2">Start by uploading some study materials above!</p>
                    </div>
                )}

                {/* Processing Status */}
                <div className="max-w-4xl mx-auto mt-8 space-y-4 md:space-y-6">
                    {Object.entries(generationStatus).map(([fileId, status]) => {
                        const file = uploadedFiles?.find(f => f.id === fileId);
                        return (
                            <div key={`status-${fileId}`} className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 md:p-8 transition-all duration-300 hover:shadow-xl">
                                <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
                                        {status.status === 'completed' ? '✅' : status.status === 'error' ? '❌' : '⚙️'}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg md:text-xl text-gray-900 break-all md:break-normal">
                                            {file?.name || 'File'}
                                        </h3>
                                        <div className="text-sm font-medium text-gray-500 mt-1">{status.message}</div>
                                    </div>
                                </div>

                            {chunkStatus[fileId] && (
                                <div className="mb-4">
                                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 transition-all duration-500"
                                            style={{
                                                width: `${(chunkStatus[fileId].processedChunks / chunkStatus[fileId].totalChunks) * 100}%`,
                                            }}
                                        />
                                    </div>
                                    <div className="text-sm font-medium text-gray-500 mt-3 flex justify-between items-center">
                                        <span>Processing chunks...</span>
                                        <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs">
                                            {chunkStatus[fileId].processedChunks} / {chunkStatus[fileId].totalChunks}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
                </div>

                {/* Flashcard Modal */}
                {selectedFlashcards && selectedFlashcards.length > 0 && (
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl flashcard-modal overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
                            <div className="flashcard-modal-content p-4 md:p-8 relative flex flex-col h-full overflow-y-auto">
                                {/* Close Button */}
                                <button
                                    onClick={() => {
                                        setSelectedFlashcards(null);
                                        setCurrentCard(0);
                                        setIsFlipped(false);
                                    }}
                                    className="absolute top-4 right-4 md:top-6 md:right-6 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-20"
                                >
                                    <X className="w-6 h-6" />
                                </button>

                                {/* Summary Section */}
                                <div className="mb-6 md:mb-10 flex-shrink-0">
                                    <button
                                        onClick={() => setIsSummaryOpen(!isSummaryOpen)}
                                        className="w-full flex items-center justify-between text-left group mb-4 pr-12"
                                    >
                                        <h3 className="font-bold text-xl md:text-2xl text-gray-900 flex items-center gap-2">
                                            <span className="text-blue-600">📝</span> Document Summary
                                        </h3>
                                        <span className={`p-2 rounded-full hover:bg-gray-100 transition-colors ${isSummaryOpen ? 'bg-gray-100' : ''}`}>
                                            {isSummaryOpen ? <ChevronUp className="w-6 h-6 text-gray-500" /> : <ChevronDown className="w-6 h-6 text-gray-500" />}
                                        </span>
                                    </button>
                                    
                                    {isSummaryOpen && (
                                        <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 md:p-6 text-sm md:text-base text-gray-700 leading-relaxed shadow-inner animate-in fade-in slide-in-from-top-2 max-h-60 overflow-y-auto">
                                            {summaries && summaries.length > 0 ? summaries.join('\n\n') : 'No summary available'}
                                        </div>
                                    )}
                                </div>

                                {/* Flashcard Section */}
                                <div className="flex-1 flex flex-col min-h-0">
                                    <div className="flex items-center justify-between mb-4 md:mb-6 flex-shrink-0">
                                        <h3 className="font-bold text-xl md:text-2xl text-gray-900 flex items-center gap-2">
                                            <span className="text-indigo-600">🎴</span> Flashcards
                                        </h3>
                                        <span className="px-3 py-1 md:px-4 md:py-1.5 bg-indigo-100 text-indigo-700 font-semibold rounded-full text-xs md:text-sm">
                                            {currentCard + 1} / {selectedFlashcards.length}
                                        </span>
                                    </div>
                                    <div className="flashcard-container flex-1 relative perspective-1000 min-h-[300px] md:min-h-[400px]">
                                        <div
                                            className={`flashcard ${isFlipped ? 'flipped' : ''} w-full h-full`}
                                            onClick={() => setIsFlipped(!isFlipped)}
                                        >
                                            {/* Front */}
                                            <div className="flashcard-front bg-white border border-gray-200 shadow-lg rounded-2xl cursor-pointer hover:shadow-xl transition-shadow duration-300 absolute inset-0 backface-hidden">
                                                <div className="flashcard-content flex flex-col items-center justify-center h-full p-6 md:p-8 overflow-y-auto">
                                                    <div className="text-lg md:text-2xl font-medium text-gray-800 text-center leading-relaxed">
                                                        {selectedFlashcards[currentCard]?.front || 'No question available'}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Back */}
                                            <div className="flashcard-back bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 shadow-lg rounded-2xl cursor-pointer absolute inset-0 backface-hidden rotate-y-180">
                                                <div className="flashcard-content flex flex-col items-center justify-center h-full p-6 md:p-8 overflow-y-auto">
                                                    <div className="text-base md:text-xl text-gray-800 mb-6 text-center leading-relaxed">
                                                        {selectedFlashcards[currentCard]?.back || 'No answer available'}
                                                    </div>
                                                    {selectedFlashcards[currentCard]?.summary && (
                                                        <div className="mt-auto pt-6 border-t border-blue-200/50 w-full text-left">
                                                            <h4 className="text-xs md:text-sm font-bold text-indigo-600 mb-2 uppercase tracking-wider">Additional Context</h4>
                                                            <div className="text-xs md:text-sm text-gray-700 leading-relaxed">
                                                                {selectedFlashcards[currentCard].summary}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Navigation */}
                                    <div className="flashcard-navigation mt-6 md:mt-8 flex-shrink-0">
                                        <div className="flex items-center justify-between bg-gray-50 p-2 md:p-4 rounded-2xl border border-gray-100 gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsFlipped(false);
                                                    prevCard();
                                                }}
                                                disabled={currentCard === 0}
                                                className="flex-1 px-4 py-3 bg-white text-gray-700 font-medium rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 hover:text-gray-900 transition-all duration-200 shadow-sm border border-gray-200 flex items-center justify-center gap-2 text-sm md:text-base"
                                            >
                                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                                                <span className="hidden sm:inline">Previous</span>
                                            </button>
                                            
                                            <div className="text-xs md:text-sm font-medium text-gray-500 flex items-center gap-1 md:gap-2 bg-white px-3 py-2 rounded-full shadow-sm border border-gray-100 whitespace-nowrap">
                                                <svg className="w-3 h-3 md:w-4 md:h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>
                                                <span className="hidden sm:inline">Click card to flip</span>
                                                <span className="sm:hidden">Tap to flip</span>
                                            </div>
                                            
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsFlipped(false);
                                                    nextCard();
                                                }}
                                                disabled={currentCard === selectedFlashcards.length - 1}
                                                className="flex-1 px-4 py-3 bg-gray-900 text-white font-medium rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-800 transition-all duration-200 shadow-md flex items-center justify-center gap-2 text-sm md:text-base"
                                            >
                                                <span className="hidden sm:inline">Next</span>
                                                <span className="sm:hidden">Next</span>
                                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
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
