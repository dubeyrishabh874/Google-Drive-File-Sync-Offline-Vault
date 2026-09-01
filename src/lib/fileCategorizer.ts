import JSZip from 'jszip';
import type { FileCategory } from '../types';

export interface ExtractedFile {
  file: File;
  relativePath: string;
  category: FileCategory;
}

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

export function categorizeFile(filename: string, mimeType?: string): FileCategory {
  const ext = getFileExtension(filename);
  const mime = (mimeType || '').toLowerCase();

  // Documents
  if (
    ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'epub', 'md', 'pages', 'key'].includes(ext) ||
    mime.includes('pdf') ||
    mime.includes('msword') ||
    mime.includes('officedocument.wordprocessingml') ||
    mime.startsWith('text/plain') ||
    mime.startsWith('text/markdown')
  ) {
    return 'documents';
  }

  // Spreadsheets & Data
  if (
    ['xls', 'xlsx', 'csv', 'tsv', 'ods', 'numbers'].includes(ext) ||
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime.includes('csv')
  ) {
    return 'spreadsheets';
  }

  // Images
  if (
    ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico', 'heic', 'avif'].includes(ext) ||
    mime.startsWith('image/')
  ) {
    return 'images';
  }

  // Archives
  if (
    ['zip', 'rar', 'tar', 'gz', '7z', 'bz2', 'xz', 'tgz'].includes(ext) ||
    mime.includes('zip') ||
    mime.includes('tar') ||
    mime.includes('compressed') ||
    mime.includes('archive')
  ) {
    return 'archives';
  }

  // Code & Developer
  if (
    ['js', 'ts', 'jsx', 'tsx', 'json', 'html', 'css', 'scss', 'py', 'rs', 'go', 'cpp', 'c', 'h', 'cs', 'java', 'php', 'rb', 'sql', 'sh', 'yml', 'yaml', 'xml', 'env'].includes(ext) ||
    mime.includes('javascript') ||
    mime.includes('json') ||
    mime.includes('xml') ||
    mime.includes('html') ||
    mime.includes('css')
  ) {
    return 'code';
  }

  // Media
  if (
    ['mp4', 'mov', 'avi', 'mkv', 'webm', 'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext) ||
    mime.startsWith('video/') ||
    mime.startsWith('audio/')
  ) {
    return 'media';
  }

  return 'other';
}

export function getCategoryDriveFolderName(category: FileCategory): string {
  switch (category) {
    case 'documents':
      return 'Documents';
    case 'spreadsheets':
      return 'Spreadsheets & Data';
    case 'images':
      return 'Images & Visuals';
    case 'archives':
      return 'Archives & Backups';
    case 'code':
      return 'Code & Scripts';
    case 'media':
      return 'Media & Audio';
    default:
      return 'General Storage';
  }
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '0 KB/s';
  return `${formatBytes(bytesPerSec, 1)}/s`;
}

// Parse dropped files and directory entries recursively
export async function parseDataTransferItems(items: DataTransferItemList): Promise<ExtractedFile[]> {
  const fileList: ExtractedFile[] = [];

  const traverseFileTree = async (item: any, path = ''): Promise<void> => {
    if (item.isFile) {
      return new Promise<void>((resolve) => {
        item.file((file: File) => {
          const relativePath = path ? `${path}/${file.name}` : file.name;
          fileList.push({
            file,
            relativePath,
            category: categorizeFile(file.name, file.type),
          });
          resolve();
        });
      });
    } else if (item.isDirectory) {
      const dirReader = item.createReader();
      const readEntries = async (): Promise<any[]> => {
        return new Promise((resolve) => {
          dirReader.readEntries((entries: any[]) => {
            resolve(entries);
          });
        });
      };

      let entries: any[] = [];
      let batch: any[];
      do {
        batch = await readEntries();
        entries = entries.concat(batch);
      } while (batch.length > 0);

      const newPath = path ? `${path}/${item.name}` : item.name;
      for (const child of entries) {
        await traverseFileTree(child, newPath);
      }
    }
  };

  const entries: any[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
      if (entry) {
        entries.push(entry);
      } else {
        const file = item.getAsFile();
        if (file) {
          fileList.push({
            file,
            relativePath: file.name,
            category: categorizeFile(file.name, file.type),
          });
        }
      }
    }
  }

  for (const entry of entries) {
    await traverseFileTree(entry);
  }

  return fileList;
}

// Extract files from a zip file
export async function extractZipArchive(zipFile: File): Promise<ExtractedFile[]> {
  const jszip = new JSZip();
  const zip = await jszip.loadAsync(zipFile);
  const extracted: ExtractedFile[] = [];

  const filePromises: Promise<void>[] = [];

  zip.forEach((relativePath, zipEntry) => {
    if (!zipEntry.dir) {
      const promise = zipEntry.async('blob').then((blob) => {
        const filename = relativePath.split('/').pop() || relativePath;
        const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
        extracted.push({
          file,
          relativePath,
          category: categorizeFile(filename, file.type),
        });
      });
      filePromises.push(promise);
    }
  });

  await Promise.all(filePromises);
  return extracted;
}
