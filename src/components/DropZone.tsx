import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Image,
  FileSpreadsheet,
  Archive,
  FolderUp,
  FileCode,
  Shield,
  Layers,
  Settings2,
  Check,
} from 'lucide-react';
import { parseDataTransferItems, extractZipArchive, type ExtractedFile } from '../lib/fileCategorizer';

interface DropZoneProps {
  onFilesSelected: (
    files: ExtractedFile[],
    options: {
      autoCategorize: boolean;
      encryptOffline: boolean;
    }
  ) => void;
  isOnline: boolean;
  hasDriveToken: boolean;
  disabled?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onFilesSelected,
  isOnline,
  hasDriveToken,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [autoCategorize, setAutoCategorize] = useState(true);
  const [encryptOffline, setEncryptOffline] = useState(true);
  const [autoUnpackZip, setAutoUnpackZip] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const processFiles = async (extracted: ExtractedFile[]) => {
    if (extracted.length === 0) return;
    setIsProcessing(true);
    try {
      const finalFiles: ExtractedFile[] = [];
      for (const item of extracted) {
        if (
          autoUnpackZip &&
          (item.file.name.endsWith('.zip') || item.file.type.includes('zip'))
        ) {
          try {
            const unzipped = await extractZipArchive(item.file);
            if (unzipped.length > 0) {
              finalFiles.push(...unzipped);
              continue;
            }
          } catch (err) {
            console.warn('Zip unpack fallback to raw archive:', err);
          }
        }
        finalFiles.push(item);
      }

      onFilesSelected(finalFiles, {
        autoCategorize,
        encryptOffline,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsProcessing(true);
      try {
        const extracted = await parseDataTransferItems(e.dataTransfer.items);
        await processFiles(extracted);
      } catch (err) {
        console.error('Error processing dropped items:', err);
      } finally {
        setIsProcessing(false);
      }
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files: ExtractedFile[] = (Array.from(e.dataTransfer.files) as File[]).map((f) => ({
        file: f,
        relativePath: f.name,
        category: 'other' as const,
      }));
      await processFiles(files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files: ExtractedFile[] = (Array.from(e.target.files) as File[]).map((f) => ({
        file: f,
        relativePath: f.webkitRelativePath || f.name,
        category: 'other' as const,
      }));
      processFiles(files);
      e.target.value = '';
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Hidden inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        multiple
        className="hidden"
        id="file-input"
      />
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFileInputChange}
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        multiple
        className="hidden"
        id="folder-input"
      />
      <input
        type="file"
        ref={zipInputRef}
        onChange={handleFileInputChange}
        accept=".zip,.tar,.gz,.7z,.rar"
        className="hidden"
        id="zip-input"
      />

      {/* Main Drag-and-Drop Container */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-8 sm:p-10 text-center transition-all ${
          isDragging
            ? 'border-[#1A1A1A] bg-white scale-[0.995] shadow-sm'
            : 'border-[#D1D1D1] bg-[#F9F9F9] hover:bg-white hover:border-[#999]'
        } ${disabled || isProcessing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {/* Minimalist Icon Badge matching High Density theme */}
        <div className="w-12 h-12 bg-[#E5E5E5] rounded mb-3 flex items-center justify-center text-[#1A1A1A]">
          <div className="w-6 h-0.5 bg-[#1A1A1A] relative before:absolute before:w-0.5 before:h-6 before:bg-[#1A1A1A] before:-top-[11px] before:left-[11px]"></div>
        </div>

        {/* Text descriptions */}
        <h2 className="text-base sm:text-lg font-semibold text-[#1A1A1A] mb-1">
          {isDragging ? 'Drop your files or folders here' : 'Drag & Drop to Sync'}
        </h2>
        <p className="text-xs sm:text-sm text-[#666] max-w-md mb-5 leading-relaxed">
          Upload files, folders, or ZIP archives automatically with smart category routing & offline encryption
        </p>

        {/* Action Button Group */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mb-5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isProcessing}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-medium bg-[#1A1A1A] text-white hover:bg-[#333] transition-colors shadow-xs"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Select Files</span>
          </button>

          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            disabled={disabled || isProcessing}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-medium bg-white hover:bg-[#F5F5F5] text-[#1A1A1A] border border-[#E5E5E5] transition-colors"
          >
            <FolderUp className="w-3.5 h-3.5 text-[#666]" />
            <span>Upload Folder</span>
          </button>

          <button
            type="button"
            onClick={() => zipInputRef.current?.click()}
            disabled={disabled || isProcessing}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-medium bg-white hover:bg-[#F5F5F5] text-[#1A1A1A] border border-[#E5E5E5] transition-colors"
          >
            <Archive className="w-3.5 h-3.5 text-[#666]" />
            <span>Upload ZIP</span>
          </button>
        </div>

        {/* Supported Types Chips */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-[#E5E5E5] text-[11px] text-[#888]">
          <span className="flex items-center gap-1 font-medium">
            <FileText className="w-3 h-3 text-[#666]" /> Documents
          </span>
          <span className="text-[#D1D1D1]">•</span>
          <span className="flex items-center gap-1 font-medium">
            <Image className="w-3 h-3 text-[#666]" /> Images
          </span>
          <span className="text-[#D1D1D1]">•</span>
          <span className="flex items-center gap-1 font-medium">
            <FileSpreadsheet className="w-3 h-3 text-[#666]" /> Spreadsheets
          </span>
          <span className="text-[#D1D1D1]">•</span>
          <span className="flex items-center gap-1 font-medium">
            <Archive className="w-3 h-3 text-[#666]" /> ZIP & Folders
          </span>
          <span className="text-[#D1D1D1]">•</span>
          <span className="flex items-center gap-1 font-medium">
            <FileCode className="w-3 h-3 text-[#666]" /> Code & Scripts
          </span>
        </div>
      </div>

      {/* Upload & Sync Configuration Options Bar */}
      <div className="px-4 py-2.5 rounded-lg bg-white border border-[#E5E5E5] flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-2 text-[#666] font-medium">
          <Settings2 className="w-3.5 h-3.5 text-[#999]" />
          <span>Upload Options</span>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Auto-categorize toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-[#1A1A1A] hover:text-black transition-colors">
            <input
              type="checkbox"
              checked={autoCategorize}
              onChange={(e) => setAutoCategorize(e.target.checked)}
              className="sr-only"
            />
            <div
              className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                autoCategorize
                  ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white'
                  : 'bg-[#F9F9F9] border-[#D1D1D1] text-transparent'
              }`}
            >
              <Check className="w-3 h-3 stroke-[3]" />
            </div>
            <span className="flex items-center gap-1 text-[11px] font-medium">
              <Layers className="w-3.5 h-3.5 text-[#666]" />
              Auto-Categorize Folders
            </span>
          </label>

          {/* Offline Encrypted Vault Copy */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-[#1A1A1A] hover:text-black transition-colors">
            <input
              type="checkbox"
              checked={encryptOffline}
              onChange={(e) => setEncryptOffline(e.target.checked)}
              className="sr-only"
            />
            <div
              className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                encryptOffline
                  ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white'
                  : 'bg-[#F9F9F9] border-[#D1D1D1] text-transparent'
              }`}
            >
              <Check className="w-3 h-3 stroke-[3]" />
            </div>
            <span className="flex items-center gap-1 text-[11px] font-medium">
              <Shield className="w-3.5 h-3.5 text-[#666]" />
              Encrypt Offline (AES-256)
            </span>
          </label>

          {/* Auto-unpack ZIP */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-[#1A1A1A] hover:text-black transition-colors">
            <input
              type="checkbox"
              checked={autoUnpackZip}
              onChange={(e) => setAutoUnpackZip(e.target.checked)}
              className="sr-only"
            />
            <div
              className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                autoUnpackZip
                  ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white'
                  : 'bg-[#F9F9F9] border-[#D1D1D1] text-transparent'
              }`}
            >
              <Check className="w-3 h-3 stroke-[3]" />
            </div>
            <span className="flex items-center gap-1 text-[11px] font-medium">
              <Archive className="w-3.5 h-3.5 text-[#666]" />
              Unpack ZIP Archives
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};
