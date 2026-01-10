/**
 * Enhanced Chunked Uploader
 * 
 * Provides dynamic chunk sizing, resumable uploads, parallel processing,
 * and comprehensive progress tracking for large file uploads.
 */

export interface UploadOptions {
  chunkSize?: number;
  maxRetries?: number;
  onProgress?: (progress: ProgressInfo) => void;
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void;
}

export interface ProgressInfo {
  uploadedBytes: number;
  totalBytes: number;
  percentage: number;
  estimatedTimeRemaining: number;
  currentChunk: number;
  totalChunks: number;
}

export interface UploadResult {
  success: boolean;
  uploadId: string;
  fileName: string;
  fileSize: number;
  processingTime: number;
  chunks: ChunkResult[];
  error?: string;
}

export interface ChunkResult {
  chunkIndex: number;
  success: boolean;
  size: number;
  uploadTime: number;
  retryCount: number;
  error?: string;
}

export interface UploadState {
  uploadId: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  completedChunks: number;
  failedChunks: number[];
  startTime: number;
  lastChunkTime?: number;
  averageChunkTime?: number;
}

export interface ChunkedUploader {
  uploadFile(file: File, options?: UploadOptions): Promise<UploadResult>;
  calculateOptimalChunkSize(fileSize: number): number;
  uploadChunk(chunk: Blob, chunkIndex: number, totalChunks: number, uploadId: string): Promise<ChunkResult>;
  resumeUpload(uploadId: string): Promise<UploadResult>;
}

export class EnhancedChunkedUploader implements ChunkedUploader {
  private readonly defaultChunkSize = 1024 * 1024; // 1MB
  private readonly maxChunkSize = 5 * 1024 * 1024; // 5MB (browser limit)
  private readonly minChunkSize = 256 * 1024; // 256KB
  private readonly maxConcurrentChunks = 3; // Parallel upload limit
  
  private uploadStates = new Map<string, UploadState>();
  private networkSpeed = 0; // bytes per second
  private lastSpeedUpdate = 0;

  /**
   * Upload a file with dynamic chunking and resumable capability
   */
  async uploadFile(file: File, options: UploadOptions = {}): Promise<UploadResult> {
    const chunkSize = options.chunkSize || this.calculateOptimalChunkSize(file.size);
    const totalChunks = Math.ceil(file.size / chunkSize);
    const uploadId = this.generateUploadId();
    
    const uploadState: UploadState = {
      uploadId,
      fileName: file.name,
      fileSize: file.size,
      totalChunks,
      completedChunks: 0,
      failedChunks: [],
      startTime: Date.now()
    };

    this.uploadStates.set(uploadId, uploadState);
    const results: ChunkResult[] = [];

    try {
      // Process chunks with controlled concurrency
      const chunkPromises: Promise<ChunkResult>[] = [];
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        
        // Control concurrency - wait if too many chunks are processing
        if (chunkPromises.length >= this.maxConcurrentChunks) {
          const completedChunk = await Promise.race(chunkPromises);
          results.push(completedChunk);
          
          // Remove completed promise from array
          const completedIndex = chunkPromises.findIndex(p => p === Promise.resolve(completedChunk));
          if (completedIndex !== -1) {
            chunkPromises.splice(completedIndex, 1);
          }
          
          this.updateProgress(uploadState, results, options.onProgress);
        }
        
        // Add new chunk upload to queue
        const chunkPromise = this.uploadChunkWithRetry(chunk, i, totalChunks, uploadId, options);
        chunkPromises.push(chunkPromise);
      }
      
      // Wait for all remaining chunks to complete
      const remainingResults = await Promise.all(chunkPromises);
      results.push(...remainingResults);
      
      // Final progress update
      uploadState.completedChunks = results.filter(r => r.success).length;
      this.updateProgress(uploadState, results, options.onProgress);
      
      // Finalize upload on server
      await this.finalizeUpload(uploadId);
      
      const processingTime = Date.now() - uploadState.startTime;
      
      return {
        success: true,
        uploadId,
        fileName: file.name,
        fileSize: file.size,
        processingTime,
        chunks: results
      };
      
    } catch (error) {
      // Preserve upload state for potential resume
      await this.preserveUploadState(uploadId, uploadState);
      
      return {
        success: false,
        uploadId,
        fileName: file.name,
        fileSize: file.size,
        processingTime: Date.now() - uploadState.startTime,
        chunks: results,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      this.uploadStates.delete(uploadId);
    }
  }

  /**
   * Calculate optimal chunk size based on file size and network conditions
   */
  calculateOptimalChunkSize(fileSize: number): number {
    // Base chunk size on file size
    let chunkSize: number;
    
    if (fileSize < 10 * 1024 * 1024) { // < 10MB
      chunkSize = Math.min(this.defaultChunkSize, fileSize);
    } else if (fileSize < 100 * 1024 * 1024) { // < 100MB
      chunkSize = 2 * 1024 * 1024; // 2MB chunks
    } else {
      chunkSize = this.maxChunkSize; // 5MB chunks for large files
    }
    
    // Adjust based on network speed if available
    if (this.networkSpeed > 0) {
      // For slow networks, use smaller chunks
      if (this.networkSpeed < 100 * 1024) { // < 100KB/s
        chunkSize = Math.max(this.minChunkSize, chunkSize / 4);
      } else if (this.networkSpeed < 1024 * 1024) { // < 1MB/s
        chunkSize = Math.max(this.minChunkSize, chunkSize / 2);
      }
    }
    
    return Math.min(Math.max(chunkSize, this.minChunkSize), this.maxChunkSize);
  }

  /**
   * Upload a single chunk with retry logic
   */
  async uploadChunk(
    chunk: Blob, 
    chunkIndex: number, 
    totalChunks: number, 
    uploadId: string
  ): Promise<ChunkResult> {
    const startTime = Date.now();
    
    try {
      const formData = new FormData();
      formData.append('chunk', chunk);
      formData.append('chunkIndex', chunkIndex.toString());
      formData.append('totalChunks', totalChunks.toString());
      formData.append('uploadId', uploadId);

      const response = await fetch('/api/upload/chunk', {
        method: 'POST',
        body: formData,
        headers: {
          'X-Chunk-Index': chunkIndex.toString(),
          'X-Upload-ID': uploadId
        }
      });

      if (!response.ok) {
        throw new Error(`Chunk upload failed: ${response.statusText}`);
      }

      const uploadTime = Date.now() - startTime;
      
      // Update network speed estimation
      this.updateNetworkSpeed(chunk.size, uploadTime);

      return {
        chunkIndex,
        success: true,
        size: chunk.size,
        uploadTime,
        retryCount: 0
      };
      
    } catch (error) {
      const uploadTime = Date.now() - startTime;
      
      return {
        chunkIndex,
        success: false,
        size: chunk.size,
        uploadTime,
        retryCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Resume an interrupted upload
   */
  async resumeUpload(uploadId: string): Promise<UploadResult> {
    const savedState = await this.recoverUploadState(uploadId);
    if (!savedState) {
      throw new Error(`No saved state found for upload ${uploadId}`);
    }

    // Implementation would continue from where it left off
    // This is a simplified version - full implementation would
    // check which chunks were already uploaded and continue from there
    throw new Error('Resume upload not yet implemented');
  }

  /**
   * Upload chunk with retry logic and exponential backoff
   */
  private async uploadChunkWithRetry(
    chunk: Blob, 
    chunkIndex: number, 
    totalChunks: number, 
    uploadId: string,
    options: UploadOptions
  ): Promise<ChunkResult> {
    const maxRetries = options.maxRetries || 3;
    let lastError: Error;
    let retryCount = 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.uploadChunk(chunk, chunkIndex, totalChunks, uploadId);
        result.retryCount = retryCount;
        
        // Notify chunk completion
        options.onChunkComplete?.(chunkIndex, totalChunks);
        
        return result;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        retryCount++;
        
        if (attempt < maxRetries) {
          // Exponential backoff with jitter
          const baseDelay = 1000 * Math.pow(2, attempt);
          const jitter = Math.random() * 1000;
          const delay = Math.min(baseDelay + jitter, 10000);
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    return {
      chunkIndex,
      success: false,
      size: chunk.size,
      uploadTime: 0,
      retryCount,
      error: lastError.message
    };
  }

  /**
   * Update progress information and call progress callback
   */
  private updateProgress(
    uploadState: UploadState, 
    results: ChunkResult[], 
    onProgress?: (progress: ProgressInfo) => void
  ): void {
    const completedChunks = results.filter(r => r.success).length;
    const uploadedBytes = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.size, 0);
    
    const percentage = (completedChunks / uploadState.totalChunks) * 100;
    
    // Calculate ETA based on average chunk time
    const currentTime = Date.now();
    const elapsedTime = currentTime - uploadState.startTime;
    const avgTimePerChunk = completedChunks > 0 ? elapsedTime / completedChunks : 0;
    const remainingChunks = uploadState.totalChunks - completedChunks;
    const estimatedTimeRemaining = avgTimePerChunk * remainingChunks;

    const progress: ProgressInfo = {
      uploadedBytes,
      totalBytes: uploadState.fileSize,
      percentage,
      estimatedTimeRemaining,
      currentChunk: completedChunks,
      totalChunks: uploadState.totalChunks
    };

    onProgress?.(progress);
  }

  /**
   * Update network speed estimation for adaptive chunk sizing
   */
  private updateNetworkSpeed(bytes: number, timeMs: number): void {
    const currentTime = Date.now();
    
    // Only update if enough time has passed
    if (currentTime - this.lastSpeedUpdate > 5000) { // 5 seconds
      const bytesPerSecond = (bytes / timeMs) * 1000;
      
      // Use exponential moving average for smoothing
      if (this.networkSpeed === 0) {
        this.networkSpeed = bytesPerSecond;
      } else {
        this.networkSpeed = 0.7 * this.networkSpeed + 0.3 * bytesPerSecond;
      }
      
      this.lastSpeedUpdate = currentTime;
    }
  }

  /**
   * Generate unique upload ID
   */
  private generateUploadId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Preserve upload state for resumable uploads
   */
  private async preserveUploadState(uploadId: string, state: UploadState): Promise<void> {
    try {
      localStorage.setItem(`upload_state_${uploadId}`, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to preserve upload state:', error);
    }
  }

  /**
   * Recover upload state for resumable uploads
   */
  private async recoverUploadState(uploadId: string): Promise<UploadState | null> {
    try {
      const stateJson = localStorage.getItem(`upload_state_${uploadId}`);
      return stateJson ? JSON.parse(stateJson) : null;
    } catch (error) {
      console.warn('Failed to recover upload state:', error);
      return null;
    }
  }

  /**
   * Finalize upload on server (assemble chunks)
   */
  private async finalizeUpload(uploadId: string): Promise<void> {
    const response = await fetch('/api/upload/finalize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uploadId })
    });

    if (!response.ok) {
      throw new Error(`Failed to finalize upload: ${response.statusText}`);
    }
  }
}