// ─────────────────────────────────────────────
// Storage Service — Abstraction
// قابل للترحيل لـ S3/MinIO دون إعادة تصميم
// ─────────────────────────────────────────────

export interface StorageResult {
  path: string;
  url: string;
  size: number;
  mimeType: string;
}

export interface StorageService {
  upload(file: Buffer, fileName: string, mimeType: string): Promise<StorageResult>;
  getAccessUrl(path: string): string;
  delete(path: string): Promise<void>;
}

// ── Local Storage Implementation ──

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

class LocalStorageService implements StorageService {
  async upload(file: Buffer, fileName: string, mimeType: string): Promise<StorageResult> {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const ext = path.extname(fileName);
    const storedName = `${randomUUID()}${ext}`;
    const filePath = path.join(UPLOAD_DIR, storedName);
    await fs.writeFile(filePath, file);
    return {
      path: storedName,
      url: `/api/files/${storedName}`,
      size: file.length,
      mimeType,
    };
  }

  getAccessUrl(storedPath: string): string {
    return `/api/files/${storedPath}`;
  }

  async delete(storedPath: string): Promise<void> {
    const filePath = path.join(UPLOAD_DIR, storedPath);
    try {
      await fs.unlink(filePath);
    } catch {
      // ignore if already deleted
    }
  }
}

// Singleton
let storageInstance: StorageService | null = null;

export function getStorageService(): StorageService {
  if (!storageInstance) {
    storageInstance = new LocalStorageService();
  }
  return storageInstance;
}
