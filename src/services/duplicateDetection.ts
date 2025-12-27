import { duplicateAPI } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';

export interface DocumentFingerprint {
  id: string;
  fileHash: string;
  contentHash: string;
  visualHash: string;
  fileName: string;
  fileSize: number;
  processedAt: Date;
  extractedData?: any;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchType: 'exact' | 'content' | 'visual' | 'none';
  matchedDocument?: DocumentFingerprint;
  confidence: number;
}

class DuplicateDetectionService {
  private processedDocuments: Map<string, DocumentFingerprint> = new Map();
  private readonly SIMILARITY_THRESHOLD = 0.85;

  /**
   * Generate file hash from file content using Web Crypto API
   */
  private async generateFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate content hash from extracted data using simple hash function
   */
  private async generateContentHash(extractedData: any): Promise<string> {
    const contentString = JSON.stringify({
      vendor: extractedData.vendor?.toLowerCase().trim(),
      amount: Math.round(extractedData.amount * 100),
      date: extractedData.date,
      items: extractedData.items?.map((item: any) => ({
        name: item.name?.toLowerCase().trim(),
        price: Math.round(item.price * 100)
      }))
    });
    
    let hash = 0;
    for (let i = 0; i < contentString.length; i++) {
      const char = contentString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Generate visual hash using simple image characteristics
   */
  private async generateVisualHash(file: File): Promise<string> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Resize to small dimensions for comparison
        canvas.width = 16;
        canvas.height = 16;
        ctx?.drawImage(img, 0, 0, 16, 16);
        
        // Get image data and create hash
        const imageData = ctx?.getImageData(0, 0, 16, 16);
        const data = imageData?.data || new Uint8ClampedArray();
        
        // Simple perceptual hash - average pixel values
        let hash = '';
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          hash += avg > 128 ? '1' : '0';
        }
        
        resolve(Math.abs(hash).toString(16));
      };
      
      img.onerror = () => {
        // Fallback to file-based hash
        resolve((file.name + file.size).split('').reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0);
          return a & a;
        }, 0).toString(16));
      };
      
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Calculate similarity between two content hashes
   */
  private calculateContentSimilarity(hash1: string, hash2: string, data1: any, data2: any): number {
    if (hash1 === hash2) return 1.0;
    
    // Compare key fields for similarity
    let matches = 0;
    let total = 0;
    
    // Vendor similarity
    if (data1.vendor && data2.vendor) {
      const similarity = this.stringSimilarity(
        data1.vendor.toLowerCase(), 
        data2.vendor.toLowerCase()
      );
      matches += similarity;
      total += 1;
    }
    
    // Amount similarity (within 5% tolerance)
    if (data1.amount && data2.amount) {
      const amountDiff = Math.abs(data1.amount - data2.amount) / Math.max(Math.abs(data1.amount), Math.abs(data2.amount));
      matches += amountDiff < 0.05 ? 1 : 0;
      total += 1;
    }
    
    // Date similarity
    if (data1.date && data2.date) {
      matches += data1.date === data2.date ? 1 : 0;
      total += 1;
    }
    
    return total > 0 ? matches / total : 0;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private stringSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;
    
    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
    
    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,
          matrix[j][i - 1] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }
    
    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len2][len1]) / maxLen;
  }

  /**
   * Check if a document is a duplicate (with backend integration)
   */
  async checkForDuplicate(file: File, extractedData?: any): Promise<DuplicateCheckResult> {
    try {
      const fileHash = await this.generateFileHash(file);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Fallback to local checking if not authenticated
        return this.checkForDuplicateLocal(file, extractedData);
      }
      
      // Check with backend first
      try {
        console.log('Skipping backend duplicate check - using local only');
        // const response = await duplicateAPI.checkDuplicate({
        //   fileHash,
        //   fileName: file.name,
        //   fileSize: file.size,
        //   extractedData,
        //   userId: user.id
        // });
        // 
        // if (response.success) {
        //   return response.data;
        // }
      } catch (error) {
        console.warn('Backend duplicate check failed, using local fallback:', error);
      }
      
      // Fallback to local checking
      return this.checkForDuplicateLocal(file, extractedData);
      
    } catch (error) {
      console.error('Duplicate detection error:', error);
      return {
        isDuplicate: false,
        matchType: 'none',
        confidence: 0
      };
    }
  }

  /**
   * Local duplicate checking (fallback)
   */
  private async checkForDuplicateLocal(file: File, extractedData?: any): Promise<DuplicateCheckResult> {
    try {
      const fileHash = await this.generateFileHash(file);
      
      // Check for exact file match first
      for (const [id, fingerprint] of this.processedDocuments) {
        if (fingerprint.fileHash === fileHash) {
          return {
            isDuplicate: true,
            matchType: 'exact',
            matchedDocument: fingerprint,
            confidence: 1.0
          };
        }
      }
      
      // If we have extracted data, check for content similarity
      if (extractedData) {
        const contentHash = await this.generateContentHash(extractedData);
        const visualHash = await this.generateVisualHash(file);
        
        for (const [id, fingerprint] of this.processedDocuments) {
          // Content similarity check
          if (fingerprint.extractedData) {
            const contentSimilarity = this.calculateContentSimilarity(
              contentHash, 
              fingerprint.contentHash, 
              extractedData, 
              fingerprint.extractedData
            );
            
            if (contentSimilarity >= this.SIMILARITY_THRESHOLD) {
              return {
                isDuplicate: true,
                matchType: 'content',
                matchedDocument: fingerprint,
                confidence: contentSimilarity
              };
            }
          }
          
          // Visual similarity check (for images)
          if (file.type.startsWith('image/') && fingerprint.visualHash === visualHash) {
            return {
              isDuplicate: true,
              matchType: 'visual',
              matchedDocument: fingerprint,
              confidence: 0.9
            };
          }
        }
      }
      
      return {
        isDuplicate: false,
        matchType: 'none',
        confidence: 0
      };
      
    } catch (error) {
      console.error('Local duplicate detection error:', error);
      return {
        isDuplicate: false,
        matchType: 'none',
        confidence: 0
      };
    }
  }

  /**
   * Register a processed document (with backend integration)
   */
  async registerDocument(file: File, extractedData: any): Promise<string> {
    const id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fileHash = await this.generateFileHash(file);
    const contentHash = await this.generateContentHash(extractedData);
    const visualHash = await this.generateVisualHash(file);
    
    const fingerprint: DocumentFingerprint = {
      id,
      fileHash,
      contentHash,
      visualHash,
      fileName: file.name,
      fileSize: file.size,
      processedAt: new Date(),
      extractedData
    };
    
    // Store locally first
    this.processedDocuments.set(id, fingerprint);
    this.saveToStorage();
    
    // Try to register with backend
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('Skipping backend duplicate registration - using local only');
        // await duplicateAPI.registerDocument({
        //   fileHash,
        //   contentHash,
        //   fileName: file.name,
        //   fileSize: file.size,
        //   extractedData,
        //   userId: user.id
        // });
      }
    } catch (error) {
      console.warn('Failed to register document with backend:', error);
      // Continue with local storage only
    }
    
    return id;
  }

  /**
   * Remove a document from tracking
   */
  removeDocument(id: string): boolean {
    const removed = this.processedDocuments.delete(id);
    if (removed) {
      this.saveToStorage();
    }
    return removed;
  }

  /**
   * Get all processed documents
   */
  getProcessedDocuments(): DocumentFingerprint[] {
    return Array.from(this.processedDocuments.values());
  }

  /**
   * Clear all processed documents
   */
  clearAll(): void {
    this.processedDocuments.clear();
    this.saveToStorage();
  }

  /**
   * Save to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = Array.from(this.processedDocuments.entries());
      localStorage.setItem('virtualcfo_processed_docs', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }

  /**
   * Load from localStorage
   */
  loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('virtualcfo_processed_docs');
      if (stored) {
        const data = JSON.parse(stored);
        this.processedDocuments = new Map(data);
      }
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
    }
  }

  /**
   * Get duplicate statistics (with backend integration)
   */
  async getStats(): Promise<{ total: number; duplicatesBlocked: number; lastProcessed?: Date }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const response = await duplicateAPI.getStats(user.id);
        if (response.success) {
          return {
            total: response.data.total,
            duplicatesBlocked: response.data.duplicatesBlocked || 0,
            lastProcessed: response.data.lastProcessed ? new Date(response.data.lastProcessed) : undefined
          };
        }
      }
    } catch (error) {
      console.warn('Failed to get stats from backend:', error);
    }
    
    // Fallback to local stats
    const docs = Array.from(this.processedDocuments.values());
    return {
      total: docs.length,
      duplicatesBlocked: 0, // This would be tracked separately
      lastProcessed: docs.length > 0 ? new Date(Math.max(...docs.map(d => d.processedAt.getTime()))) : undefined
    };
  }
}

export const duplicateDetectionService = new DuplicateDetectionService();

// Load existing data on initialization
duplicateDetectionService.loadFromStorage();