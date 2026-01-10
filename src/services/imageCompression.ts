/**
 * Image Compression Service
 * 
 * Provides client-side image compression before upload to reduce
 * processing time and bandwidth usage.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'webp' | 'png';
  maintainAspectRatio?: boolean;
  maxSizeKB?: number;
}

export interface CompressionResult {
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  dimensions: {
    original: { width: number; height: number };
    compressed: { width: number; height: number };
  };
  format: string;
  quality: number;
}

export interface ImageCompressor {
  compressImage(file: File, options?: CompressionOptions): Promise<CompressionResult>;
  calculateOptimalDimensions(originalWidth: number, originalHeight: number, maxWidth: number, maxHeight: number): { width: number; height: number };
  estimateCompressedSize(width: number, height: number, quality: number, format: string): number;
}

export class EnhancedImageCompressor implements ImageCompressor {
  private readonly defaultOptions: Required<CompressionOptions> = {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.8,
    format: 'jpeg',
    maintainAspectRatio: true,
    maxSizeKB: 1024 // 1MB
  };

  /**
   * Compress an image file with specified options
   */
  async compressImage(file: File, options: CompressionOptions = {}): Promise<CompressionResult> {
    const opts = { ...this.defaultOptions, ...options };
    
    // Validate input
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    // Load image to get dimensions
    const { image, originalDimensions } = await this.loadImage(file);
    
    // Calculate optimal dimensions
    const targetDimensions = this.calculateOptimalDimensions(
      originalDimensions.width,
      originalDimensions.height,
      opts.maxWidth,
      opts.maxHeight
    );

    // Determine optimal format and quality
    const { format, quality } = await this.determineOptimalSettings(
      file,
      targetDimensions,
      opts
    );

    // Compress the image
    const compressedFile = await this.performCompression(
      image,
      targetDimensions,
      format,
      quality,
      file.name
    );

    // Calculate compression metrics
    const compressionRatio = file.size / compressedFile.size;

    return {
      compressedFile,
      originalSize: file.size,
      compressedSize: compressedFile.size,
      compressionRatio,
      dimensions: {
        original: originalDimensions,
        compressed: targetDimensions
      },
      format,
      quality
    };
  }

  /**
   * Calculate optimal dimensions while maintaining aspect ratio
   */
  calculateOptimalDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    // If image is already smaller than limits, keep original size
    if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
      return { width: originalWidth, height: originalHeight };
    }

    // Calculate aspect ratio
    const aspectRatio = originalWidth / originalHeight;

    // Calculate dimensions based on width constraint
    let targetWidth = Math.min(originalWidth, maxWidth);
    let targetHeight = targetWidth / aspectRatio;

    // If height exceeds limit, recalculate based on height constraint
    if (targetHeight > maxHeight) {
      targetHeight = maxHeight;
      targetWidth = targetHeight * aspectRatio;
    }

    // Ensure dimensions are integers
    return {
      width: Math.round(targetWidth),
      height: Math.round(targetHeight)
    };
  }

  /**
   * Estimate compressed file size based on dimensions and quality
   */
  estimateCompressedSize(width: number, height: number, quality: number, format: string): number {
    const pixels = width * height;
    
    // Base compression ratios for different formats
    const baseRatios = {
      'jpeg': 0.1,  // JPEG typically compresses to ~10% of raw size
      'webp': 0.08, // WebP is more efficient
      'png': 0.3    // PNG is less compressed but lossless
    };

    const baseRatio = baseRatios[format as keyof typeof baseRatios] || baseRatios.jpeg;
    
    // Adjust for quality (higher quality = larger file)
    const qualityMultiplier = format === 'png' ? 1 : (0.5 + quality * 0.5);
    
    // Raw size would be width * height * 4 bytes per pixel (RGBA)
    const rawSize = pixels * 4;
    
    return Math.round(rawSize * baseRatio * qualityMultiplier);
  }

  /**
   * Load image from file and get dimensions
   */
  private async loadImage(file: File): Promise<{
    image: HTMLImageElement;
    originalDimensions: { width: number; height: number };
  }> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);

      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve({
          image,
          originalDimensions: {
            width: image.naturalWidth,
            height: image.naturalHeight
          }
        });
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      image.src = url;
    });
  }

  /**
   * Determine optimal format and quality settings
   */
  private async determineOptimalSettings(
    file: File,
    targetDimensions: { width: number; height: number },
    options: Required<CompressionOptions>
  ): Promise<{ format: string; quality: number }> {
    let format = options.format;
    let quality = options.quality;

    // Auto-select format if not specified or if we need better compression
    if (options.maxSizeKB > 0) {
      const estimatedSize = this.estimateCompressedSize(
        targetDimensions.width,
        targetDimensions.height,
        quality,
        format
      );

      const targetSizeBytes = options.maxSizeKB * 1024;

      // If estimated size exceeds target, try more aggressive compression
      if (estimatedSize > targetSizeBytes) {
        // Try WebP if supported and not already using it
        if (format !== 'webp' && this.isWebPSupported()) {
          format = 'webp';
          
          const webpEstimate = this.estimateCompressedSize(
            targetDimensions.width,
            targetDimensions.height,
            quality,
            'webp'
          );
          
          if (webpEstimate <= targetSizeBytes) {
            return { format, quality };
          }
        }

        // Reduce quality to meet size target
        const compressionNeeded = targetSizeBytes / estimatedSize;
        quality = Math.max(0.1, quality * compressionNeeded);
      }
    }

    return { format, quality };
  }

  /**
   * Perform the actual image compression
   */
  private async performCompression(
    image: HTMLImageElement,
    dimensions: { width: number; height: number },
    format: string,
    quality: number,
    originalFileName: string
  ): Promise<File> {
    // Create canvas for compression
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Set canvas dimensions
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    // Configure canvas for high-quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw image to canvas with new dimensions
    ctx.drawImage(image, 0, 0, dimensions.width, dimensions.height);

    // Convert to blob with specified format and quality
    const mimeType = this.getMimeType(format);
    
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'));
            return;
          }

          // Create new file with compressed data
          const compressedFileName = this.generateCompressedFileName(originalFileName, format);
          const compressedFile = new File([blob], compressedFileName, {
            type: mimeType,
            lastModified: Date.now()
          });

          resolve(compressedFile);
        },
        mimeType,
        format === 'png' ? undefined : quality // PNG doesn't use quality parameter
      );
    });
  }

  /**
   * Check if WebP format is supported
   */
  private isWebPSupported(): boolean {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    
    try {
      return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    } catch {
      return false;
    }
  }

  /**
   * Get MIME type for format
   */
  private getMimeType(format: string): string {
    const mimeTypes = {
      'jpeg': 'image/jpeg',
      'webp': 'image/webp',
      'png': 'image/png'
    };
    
    return mimeTypes[format as keyof typeof mimeTypes] || 'image/jpeg';
  }

  /**
   * Generate filename for compressed image
   */
  private generateCompressedFileName(originalName: string, format: string): string {
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
    const extension = format === 'jpeg' ? 'jpg' : format;
    
    return `${nameWithoutExt}_compressed.${extension}`;
  }

  /**
   * Batch compress multiple images
   */
  async compressImages(
    files: File[],
    options: CompressionOptions = {},
    onProgress?: (completed: number, total: number) => void
  ): Promise<CompressionResult[]> {
    const results: CompressionResult[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        const result = await this.compressImage(file, options);
        results.push(result);
      } catch (error) {
        // Create error result for failed compression
        results.push({
          compressedFile: file, // Use original file as fallback
          originalSize: file.size,
          compressedSize: file.size,
          compressionRatio: 1,
          dimensions: {
            original: { width: 0, height: 0 },
            compressed: { width: 0, height: 0 }
          },
          format: 'error',
          quality: 0
        });
      }
      
      onProgress?.(i + 1, files.length);
    }
    
    return results;
  }

  /**
   * Get compression statistics for analysis
   */
  getCompressionStats(results: CompressionResult[]): {
    totalOriginalSize: number;
    totalCompressedSize: number;
    averageCompressionRatio: number;
    totalSavings: number;
    savingsPercentage: number;
  } {
    const totalOriginalSize = results.reduce((sum, r) => sum + r.originalSize, 0);
    const totalCompressedSize = results.reduce((sum, r) => sum + r.compressedSize, 0);
    const averageCompressionRatio = results.reduce((sum, r) => sum + r.compressionRatio, 0) / results.length;
    const totalSavings = totalOriginalSize - totalCompressedSize;
    const savingsPercentage = (totalSavings / totalOriginalSize) * 100;

    return {
      totalOriginalSize,
      totalCompressedSize,
      averageCompressionRatio,
      totalSavings,
      savingsPercentage
    };
  }
}