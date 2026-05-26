/**
 * Storage Manager Service
 * 
 * Manages localStorage with intelligent fallback strategies for large projects
 * Features:
 * - Automatic compression for large data
 * - Overflow detection and handling
 * - Metadata-only storage for huge projects
 * - Automatic cleanup of old versions
 * 
 * Part of Phase 1: Critical Stabilization (Implementation Roadmap)
 */

import { toast } from 'sonner';

const MAX_LOCALSTORAGE_SIZE = 4.5 * 1024 * 1024; // 4.5MB (safe limit, browsers typically allow 5-10MB)
const COMPRESSION_THRESHOLD = 100000; // 100KB - compress anything larger

export interface StorageMetadata {
  objectCount: number;
  lastSaved: number;
  sizeBytes: number;
  compressed: boolean;
  truncated: boolean;
}

export class StorageManager {
  private static instance: StorageManager;
  private compressionEnabled = true;

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  /**
   * Save data to localStorage with intelligent fallback
   */
  async save(key: string, data: any): Promise<boolean> {
    try {
      let serialized = JSON.stringify(data);
      const originalSize = serialized.length;

      // Try compression if data is large
      if (serialized.length > COMPRESSION_THRESHOLD && this.compressionEnabled) {
        try {
          const compressed = await this.compress(serialized);
          if (compressed.length < serialized.length) {
            serialized = compressed;
            console.log(
              `[StorageManager] Compressed ${originalSize} → ${serialized.length} bytes (${Math.round(
                ((originalSize - serialized.length) / originalSize) * 100
              )}% reduction)`
            );
          }
        } catch (e) {
          console.warn('[StorageManager] Compression failed, saving uncompressed');
        }
      }

      // Check if it fits
      if (serialized.length > MAX_LOCALSTORAGE_SIZE) {
        console.warn('[StorageManager] Data too large for localStorage, using fallback');
        return await this.handleOverflow(key, data);
      }

      // Try to save
      try {
        localStorage.setItem(key, serialized);
        
        // Save metadata
        const metadata: StorageMetadata = {
          objectCount: data.objects?.length || 0,
          lastSaved: Date.now(),
          sizeBytes: serialized.length,
          compressed: serialized.length < originalSize,
          truncated: false,
        };
        localStorage.setItem(`${key}_metadata`, JSON.stringify(metadata));
        
        return true;
      } catch (e: any) {
        if (e.name === 'QuotaExceededError') {
          console.warn('[StorageManager] Quota exceeded, using fallback');
          return await this.handleOverflow(key, data);
        }
        throw e;
      }
    } catch (error) {
      console.error('[StorageManager] Save error:', error);
      return false;
    }
  }

  /**
   * Load data from localStorage
   */
  async load(key: string): Promise<any | null> {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;

      // Check if compressed (basic heuristic)
      const isCompressed = !stored.startsWith('{');
      
      if (isCompressed) {
        try {
          const decompressed = await this.decompress(stored);
          return JSON.parse(decompressed);
        } catch (e) {
          console.warn('[StorageManager] Decompression failed, trying direct parse');
          return JSON.parse(stored);
        }
      }

      return JSON.parse(stored);
    } catch (error) {
      console.error('[StorageManager] Load error:', error);
      return null;
    }
  }

  /**
   * Get storage metadata
   */
  getMetadata(key: string): StorageMetadata | null {
    try {
      const metadata = localStorage.getItem(`${key}_metadata`);
      return metadata ? JSON.parse(metadata) : null;
    } catch {
      return null;
    }
  }

  /**
   * Handle overflow by using fallback strategies
   */
  private async handleOverflow(key: string, data: any): Promise<boolean> {
    console.log('[StorageManager] Handling overflow with fallback strategies');

    // Strategy 1: Clear old backups
    this.clearOldBackups();

    // Strategy 2: Save metadata only
    const metadata: StorageMetadata = {
      objectCount: data.objects?.length || 0,
      lastSaved: Date.now(),
      sizeBytes: JSON.stringify(data).length,
      compressed: false,
      truncated: true,
    };

    try {
      localStorage.setItem(`${key}_metadata`, JSON.stringify(metadata));
    } catch (e) {
      console.error('[StorageManager] Even metadata failed to save');
    }

    // Strategy 3: Save minimal version (IDs only)
    const minimalData = {
      objects: data.objects?.map((o: any) => ({
        id: o.id,
        name: o.name,
        type: o.type,
      })),
      objectCount: data.objects?.length || 0,
      truncated: true,
    };

    try {
      localStorage.setItem(`${key}_minimal`, JSON.stringify(minimalData));
    } catch (e) {
      console.error('[StorageManager] Minimal save also failed');
    }

    // Strategy 4: Notify user
    toast.warning(
      'Projeto grande demais para o auto-save do navegador. Use Salvar no Disco.',
      { 
        duration: 5000,
        description: `${data.objects?.length || 0} objetos - ${(JSON.stringify(data).length / 1024 / 1024).toFixed(2)}MB`
      }
    );

    return false;
  }

  /**
   * Compress data using CompressionStream API (modern browsers)
   */
  private async compress(data: string): Promise<string> {
    if ('CompressionStream' in window) {
      try {
        const blob = new Blob([data]);
        const stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
        const compressed = await new Response(stream).blob();
        
        // Convert blob to base64 for localStorage
        return await this.blobToBase64(compressed);
      } catch (e) {
        console.warn('[StorageManager] CompressionStream failed:', e);
      }
    }

    // Fallback: Simple RLE compression
    return this.simpleCompress(data);
  }

  /**
   * Decompress data
   */
  private async decompress(data: string): Promise<string> {
    if ('DecompressionStream' in window && data.startsWith('data:')) {
      try {
        const blob = await this.base64ToBlob(data);
        const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
        const decompressed = await new Response(stream).text();
        return decompressed;
      } catch (e) {
        console.warn('[StorageManager] DecompressionStream failed:', e);
      }
    }

    // Fallback: Simple RLE decompression
    return this.simpleDecompress(data);
  }

  /**
   * Simple compression using RLE (Run-Length Encoding)
   */
  private simpleCompress(data: string): string {
    // Very basic compression - just for fallback
    return data.replace(/(.)\1{2,}/g, (match, char) => {
      return `${char}${match.length}`;
    });
  }

  /**
   * Simple decompression
   */
  private simpleDecompress(data: string): string {
    return data.replace(/(.)\d+/g, (match, char) => {
      const count = parseInt(match.slice(1));
      return char.repeat(count);
    });
  }

  /**
   * Convert Blob to Base64
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Convert Base64 to Blob
   */
  private async base64ToBlob(base64: string): Promise<Blob> {
    const response = await fetch(base64);
    return response.blob();
  }

  /**
   * Clear old backups to free space
   */
  private clearOldBackups(): void {
    try {
      const keys = Object.keys(localStorage);
      const backupKeys = keys.filter(
        (k) => k.startsWith('project_backup_') || k.startsWith('editor_backup_')
      );

      // Sort by timestamp (embedded in key) and keep only 3 most recent
      backupKeys.sort().slice(0, -3).forEach((k) => {
        localStorage.removeItem(k);
        console.log(`[StorageManager] Removed old backup: ${k}`);
      });

      // Also remove orphaned metadata
      const metadataKeys = keys.filter((k) => k.endsWith('_metadata'));
      metadataKeys.forEach((metaKey) => {
        const baseKey = metaKey.replace('_metadata', '');
        if (!localStorage.getItem(baseKey)) {
          localStorage.removeItem(metaKey);
          console.log(`[StorageManager] Removed orphaned metadata: ${metaKey}`);
        }
      });
    } catch (error) {
      console.error('[StorageManager] Error clearing backups:', error);
    }
  }

  /**
   * Legacy remote fallback disabled for the local engine workflow.
   */
  private async forcedCloudSave(_data: any): Promise<boolean> {
    return false;
  }

  /**
   * Get storage usage statistics
   */
  getStorageStats(): {
    used: number;
    available: number;
    percentUsed: number;
    keys: string[];
  } {
    let used = 0;
    const keys: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        keys.push(key);
        const value = localStorage.getItem(key);
        if (value) {
          used += value.length;
        }
      }
    }

    const available = MAX_LOCALSTORAGE_SIZE - used;
    const percentUsed = (used / MAX_LOCALSTORAGE_SIZE) * 100;

    return {
      used,
      available,
      percentUsed,
      keys,
    };
  }

  /**
   * Clear all storage (use with caution)
   */
  clearAll(): void {
    localStorage.clear();
    console.log('[StorageManager] All storage cleared');
  }
}

// Export singleton instance
export const storageManager = StorageManager.getInstance();
