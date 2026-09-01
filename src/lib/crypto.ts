// Web Crypto API utility for AES-256-GCM encryption and decryption of offline files

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 256;
const DEFAULT_SALT_LENGTH = 16;
const IV_LENGTH = 12; // 96 bits standard for AES-GCM

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

// Derive AES-GCM key from user passphrase and salt
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt File or Blob with AES-256-GCM
export async function encryptFile(
  file: Blob,
  passphrase: string
): Promise<{ encryptedBlob: Blob; iv: string; salt: string }> {
  const fileBuffer = await file.arrayBuffer();
  const salt = window.crypto.getRandomValues(new Uint8Array(DEFAULT_SALT_LENGTH));
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  const key = await deriveKey(passphrase, salt);
  const encryptedContent = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
    },
    key,
    fileBuffer
  );

  return {
    encryptedBlob: new Blob([encryptedContent], { type: 'application/octet-stream' }),
    iv: arrayBufferToBase64(iv.buffer),
    salt: arrayBufferToBase64(salt.buffer),
  };
}

// Decrypt encrypted blob back to original File/Blob
export async function decryptFile(
  encryptedBlob: Blob,
  ivBase64: string,
  saltBase64: string,
  passphrase: string,
  mimeType: string = 'application/octet-stream'
): Promise<Blob> {
  const encryptedBuffer = await encryptedBlob.arrayBuffer();
  const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));
  const salt = new Uint8Array(base64ToArrayBuffer(saltBase64));

  const key = await deriveKey(passphrase, salt);
  const decryptedContent = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
    },
    key,
    encryptedBuffer
  );

  return new Blob([decryptedContent], { type: mimeType });
}

// Compute SHA-256 Hash for file integrity verification
export async function computeSha256(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Generate device master key helper for offline transparent vault
export function getOrCreateDeviceVaultKey(): string {
  const keyName = 'gd_sync_device_vault_key';
  let stored = localStorage.getItem(keyName);
  if (!stored) {
    const randomBytes = window.crypto.getRandomValues(new Uint8Array(32));
    stored = arrayBufferToBase64(randomBytes.buffer);
    localStorage.setItem(keyName, stored);
  }
  return stored;
}
