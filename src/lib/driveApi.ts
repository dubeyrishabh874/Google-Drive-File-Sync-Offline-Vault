import type { FileCategory } from '../types';
import { getCategoryDriveFolderName } from './fileCategorizer';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const APP_ROOT_FOLDER_NAME = '[Cloud Sync Vault]';

// Folder cache in memory
let cachedRootFolderId: string | null = null;
const cachedCategoryFolders: Record<string, string> = {};

// Find or create a folder in Drive
export async function findOrCreateFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string
): Promise<string> {
  const parentQuery = parentFolderId
    ? `'${parentFolderId}' in parents`
    : `'root' in parents`;
  const query = `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and ${parentQuery} and trashed = false`;

  const searchRes = await fetch(
    `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!searchRes.ok) {
    const errText = await searchRes.text();
    throw new Error(`Failed to query folder "${folderName}": ${errText}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const createRes = await fetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentFolderId ? [parentFolderId] : undefined,
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create folder "${folderName}": ${errText}`);
  }

  const createData = await createRes.json();
  return createData.id;
}

// Ensure the root and category folder hierarchy exists
export async function getTargetFolderForCategory(
  accessToken: string,
  category: FileCategory
): Promise<{ rootFolderId: string; categoryFolderId: string; categoryFolderName: string }> {
  if (!cachedRootFolderId) {
    cachedRootFolderId = await findOrCreateFolder(accessToken, APP_ROOT_FOLDER_NAME);
  }

  const categoryFolderName = getCategoryDriveFolderName(category);
  if (!cachedCategoryFolders[category]) {
    const catFolderId = await findOrCreateFolder(
      accessToken,
      categoryFolderName,
      cachedRootFolderId
    );
    cachedCategoryFolders[category] = catFolderId;
  }

  return {
    rootFolderId: cachedRootFolderId,
    categoryFolderId: cachedCategoryFolders[category],
    categoryFolderName,
  };
}

// Multipart upload with real-time XMLHttpRequest progress
export function uploadFileMultipart(
  accessToken: string,
  fileBlob: Blob,
  fileName: string,
  parentFolderId: string,
  mimeType: string = 'application/octet-stream',
  onProgress?: (percent: number, loadedBytes: number, totalBytes: number, speedBps: number) => void
): Promise<{ id: string; name: string; webViewLink?: string; size?: string }> {
  return new Promise((resolve, reject) => {
    const metadata = {
      name: fileName,
      parents: [parentFolderId],
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const reader = new FileReader();
    reader.onload = function () {
      const fileData = reader.result as ArrayBuffer;
      const metaPart = `Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
      const mediaHeader = `Content-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`;

      const blobParts = [
        delimiter,
        metaPart,
        delimiter,
        mediaHeader,
        new Uint8Array(fileData),
        closeDelimiter,
      ];

      const multipartBlob = new Blob(blobParts, {
        type: `multipart/related; boundary=${boundary}`,
      });

      const xhr = new XMLHttpRequest();
      xhr.open(
        'POST',
        `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,webViewLink,size,mimeType`
      );
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);

      let startTime = Date.now();
      let lastLoaded = 0;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.min(100, Math.round((e.loaded / e.total) * 100));
          const elapsedSec = (Date.now() - startTime) / 1000;
          const speedBps = elapsedSec > 0 ? e.loaded / elapsedSec : 0;
          if (onProgress) {
            onProgress(percent, e.loaded, e.total, speedBps);
          }
          lastLoaded = e.loaded;
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch (e) {
            reject(new Error('Invalid response from Google Drive'));
          }
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            reject(new Error(errData.error?.message || `Upload failed with status ${xhr.status}`));
          } catch (e) {
            reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during Google Drive upload. Offline mode active.'));
      };

      xhr.ontimeout = () => {
        reject(new Error('Drive upload timed out.'));
      };

      xhr.send(multipartBlob);
    };

    reader.onerror = () => reject(new Error('Failed to read file for upload'));
    reader.readAsArrayBuffer(fileBlob);
  });
}

// List files managed in Drive
export async function listAppDriveFiles(accessToken: string): Promise<any[]> {
  try {
    const res = await fetch(
      `${DRIVE_API_BASE}/files?pageSize=100&fields=files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,parents,iconLink,thumbnailLink)&q=trashed=false&orderBy=modifiedTime desc`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!res.ok) {
      throw new Error(`Failed to list Drive files: ${res.statusText}`);
    }

    const data = await res.json();
    return data.files || [];
  } catch (err) {
    console.error('List Drive files error:', err);
    return [];
  }
}

// Delete file from Drive
export async function deleteDriveFile(accessToken: string, fileId: string): Promise<void> {
  const res = await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete file from Drive (${res.status})`);
  }
}

// Download blob from Drive
export async function downloadDriveBlob(accessToken: string, fileId: string): Promise<Blob> {
  const res = await fetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to download file from Drive (${res.status})`);
  }

  return await res.blob();
}
