/**
 * Enhanced File Validation Service
 * Provides comprehensive security validation for uploaded files
 */

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  sanitizedName?: string;
}

export interface ValidationError {
  code: 'FILE_TOO_LARGE' | 'INVALID_TYPE' | 'MALWARE_DETECTED' | 'INVALID_CONTENT' | 'INVALID_NAME';
  message: string;
  details?: any;
}

export interface ScanResult {
  isMalicious: boolean;
  threats: string[];
  confidence: number;
}

export class EnhancedFileValidator {
  private readonly allowedTypes = new Set([
    'image/jpeg', 
    'image/jpg',
    'image/png', 
    'image/webp',
    'application/pdf', 
    'text/plain', 
    'text/csv'
  ]);
  
  private readonly maxSizes = {
    'image/jpeg': 10 * 1024 * 1024, // 10MB
    'image/jpg': 10 * 1024 * 1024, // 10MB
    'image/png': 10 * 1024 * 1024, // 10MB
    'image/webp': 10 * 1024 * 1024, // 10MB
    'application/pdf': 25 * 1024 * 1024, // 25MB
    'text/plain': 5 * 1024 * 1024, // 5MB
    'text/csv': 5 * 1024 * 1024 // 5MB
  };

  private readonly dangerousExtensions = new Set([
    'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar', 'app', 'deb', 'pkg', 'dmg'
  ]);

  /**
   * Validates a file against all security criteria
   */
  async validateFile(file: File): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    
    // Validate file type
    if (!this.validateFileType(file)) {
      errors.push({
        code: 'INVALID_TYPE',
        message: `File type ${file.type} is not allowed`,
        details: { 
          fileType: file.type,
          allowedTypes: Array.from(this.allowedTypes) 
        }
      });
    }
    
    // Validate file size
    if (!this.validateFileSize(file)) {
      const maxSize = this.getMaxSizeForType(file.type);
      errors.push({
        code: 'FILE_TOO_LARGE',
        message: `File size ${this.formatBytes(file.size)} exceeds maximum ${this.formatBytes(maxSize)}`,
        details: { 
          fileSize: file.size, 
          maxSize,
          fileSizeFormatted: this.formatBytes(file.size),
          maxSizeFormatted: this.formatBytes(maxSize)
        }
      });
    }
    
    // Sanitize filename
    const sanitizedName = this.sanitizeFileName(file.name);
    if (sanitizedName !== file.name) {
      warnings.push(`Filename sanitized from "${file.name}" to "${sanitizedName}"`);
    }
    
    // Validate filename for dangerous patterns
    if (!this.validateFileName(file.name)) {
      errors.push({
        code: 'INVALID_NAME',
        message: 'Filename contains dangerous patterns or extensions',
        details: { originalName: file.name }
      });
    }
    
    // Content validation for images
    if (file.type.startsWith('image/')) {
      const contentValid = await this.validateImageContent(file);
      if (!contentValid) {
        errors.push({
          code: 'INVALID_CONTENT',
          message: 'Image content validation failed - file may be corrupted or malicious'
        });
      }
    }
    
    // Malware detection
    const scanResult = await this.scanForMalware(file);
    if (scanResult.isMalicious) {
      errors.push({
        code: 'MALWARE_DETECTED',
        message: `Malicious content detected: ${scanResult.threats.join(', ')}`,
        details: { 
          threats: scanResult.threats,
          confidence: scanResult.confidence
        }
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedName
    };
  }

  /**
   * Validates file type by checking both MIME type and extension
   */
  validateFileType(file: File): boolean {
    // Check MIME type
    const mimeTypeValid = this.allowedTypes.has(file.type);
    
    // Check file extension matches MIME type
    const extensionValid = this.validateFileExtension(file.name, file.type);
    
    return mimeTypeValid && extensionValid;
  }

  /**
   * Validates file size against configured limits
   */
  validateFileSize(file: File): boolean {
    const maxSize = this.getMaxSizeForType(file.type);
    return file.size <= maxSize;
  }

  /**
   * Scans file for malicious content
   */
  async scanForMalware(file: File): Promise<ScanResult> {
    const threats: string[] = [];
    let confidence = 0;

    // Check file signature (magic bytes)
    const signatureCheck = await this.validateFileSignature(file);
    if (!signatureCheck.isValid) {
      threats.push('Invalid file signature');
      confidence += 0.3;
    }

    // Check for suspicious patterns in filename
    if (this.containsSuspiciousPatterns(file.name)) {
      threats.push('Suspicious filename patterns');
      confidence += 0.2;
    }

    // Check file size anomalies
    if (this.detectSizeAnomalies(file)) {
      threats.push('Unusual file size for type');
      confidence += 0.1;
    }

    // For images, check for embedded scripts or unusual metadata
    if (file.type.startsWith('image/')) {
      const imageThreats = await this.scanImageForThreats(file);
      threats.push(...imageThreats);
      confidence += imageThreats.length * 0.2;
    }

    return {
      isMalicious: confidence > 0.5,
      threats,
      confidence: Math.min(confidence, 1.0)
    };
  }

  /**
   * Sanitizes filename to prevent path traversal and other attacks
   */
  sanitizeFileName(fileName: string): string {
    return fileName
      // Remove path traversal attempts
      .replace(/\.\./g, '_')
      .replace(/[\/\\]/g, '_')
      // Remove dangerous characters
      .replace(/[<>:"|?*]/g, '_')
      // Remove control characters
      .replace(/[\x00-\x1f\x80-\x9f]/g, '_')
      // Remove leading dots and spaces
      .replace(/^[\.\s]+/, '')
      // Remove trailing dots and spaces
      .replace(/[\.\s]+$/, '')
      // Limit length
      .substring(0, 255)
      // Ensure we have a valid filename
      || 'sanitized_file';
  }

  /**
   * Validates filename for dangerous patterns
   */
  private validateFileName(fileName: string): boolean {
    const extension = fileName.toLowerCase().split('.').pop() || '';
    
    // Check for dangerous extensions
    if (this.dangerousExtensions.has(extension)) {
      return false;
    }

    // Check for double extensions (e.g., file.pdf.exe)
    const parts = fileName.toLowerCase().split('.');
    if (parts.length > 2) {
      for (let i = 0; i < parts.length - 1; i++) {
        if (this.dangerousExtensions.has(parts[i])) {
          return false;
        }
      }
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /script/i,
      /javascript/i,
      /vbscript/i,
      /onload/i,
      /onerror/i,
      /eval\(/i,
      /document\./i
    ];

    return !suspiciousPatterns.some(pattern => pattern.test(fileName));
  }

  /**
   * Validates file extension matches MIME type
   */
  private validateFileExtension(fileName: string, mimeType: string): boolean {
    const extension = fileName.toLowerCase().split('.').pop();
    const expectedExtensions: Record<string, string[]> = {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/webp': ['webp'],
      'application/pdf': ['pdf'],
      'text/plain': ['txt'],
      'text/csv': ['csv']
    };
    
    const allowed = expectedExtensions[mimeType] || [];
    return allowed.includes(extension || '');
  }

  /**
   * Validates image content by attempting to load it
   */
  private async validateImageContent(file: File): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      const cleanup = () => {
        URL.revokeObjectURL(url);
      };
      
      img.onload = () => {
        cleanup();
        // Basic validation: ensure image can be loaded and has reasonable dimensions
        const valid = img.width > 0 && 
                     img.height > 0 && 
                     img.width <= 10000 && 
                     img.height <= 10000 &&
                     img.width * img.height <= 100000000; // Max 100MP
        resolve(valid);
      };
      
      img.onerror = () => {
        cleanup();
        resolve(false);
      };
      
      // Set timeout for validation
      setTimeout(() => {
        cleanup();
        resolve(false);
      }, 5000);
      
      img.src = url;
    });
  }

  /**
   * Validates file signature (magic bytes)
   */
  private async validateFileSignature(file: File): Promise<{ isValid: boolean; detectedType?: string }> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        if (!arrayBuffer) {
          resolve({ isValid: false });
          return;
        }
        
        const bytes = new Uint8Array(arrayBuffer.slice(0, 16));
        const signature = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        
        // Common file signatures
        const signatures: Record<string, string[]> = {
          'image/jpeg': ['ffd8ff'],
          'image/png': ['89504e47'],
          'application/pdf': ['255044462d'],
          'image/webp': ['52494646']
        };
        
        let detectedType: string | undefined;
        let isValid = false;
        
        for (const [mimeType, sigs] of Object.entries(signatures)) {
          if (sigs.some(sig => signature.startsWith(sig))) {
            detectedType = mimeType;
            isValid = mimeType === file.type;
            break;
          }
        }
        
        // For text files, we can't easily validate signature
        if (file.type.startsWith('text/')) {
          isValid = true;
        }
        
        resolve({ isValid, detectedType });
      };
      
      reader.onerror = () => {
        resolve({ isValid: false });
      };
      
      reader.readAsArrayBuffer(file.slice(0, 16));
    });
  }

  /**
   * Checks for suspicious patterns in filename
   */
  private containsSuspiciousPatterns(fileName: string): boolean {
    const suspiciousPatterns = [
      /\$\{.*\}/,  // Template injection
      /<script/i,   // Script tags
      /javascript:/i, // JavaScript protocol
      /data:/i,     // Data URLs
      /vbscript:/i, // VBScript
      /file:/i,     // File protocol
      /\.\.[\\/]/,  // Path traversal
      /%2e%2e/i,    // URL encoded path traversal
      /\x00/,       // Null bytes
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(fileName));
  }

  /**
   * Detects size anomalies that might indicate malicious content
   */
  private detectSizeAnomalies(file: File): boolean {
    // Very small files that claim to be images/PDFs might be suspicious
    if ((file.type.startsWith('image/') || file.type === 'application/pdf') && file.size < 100) {
      return true;
    }
    
    // Extremely large files might be zip bombs or similar
    if (file.size > 100 * 1024 * 1024) { // 100MB
      return true;
    }
    
    return false;
  }

  /**
   * Scans images for embedded threats
   */
  private async scanImageForThreats(file: File): Promise<string[]> {
    const threats: string[] = [];
    
    try {
      // Read file as text to check for embedded scripts
      const text = await this.readFileAsText(file);
      
      // Check for script patterns in image metadata/comments
      const scriptPatterns = [
        /<script/i,
        /javascript:/i,
        /eval\(/i,
        /document\./i,
        /window\./i,
        /alert\(/i
      ];
      
      if (scriptPatterns.some(pattern => pattern.test(text))) {
        threats.push('Embedded script detected');
      }
      
      // Check for suspicious metadata
      if (text.includes('<?php') || text.includes('<%') || text.includes('#!/')) {
        threats.push('Server-side script detected');
      }
      
    } catch (error) {
      // If we can't read the file, it might be suspicious
      threats.push('Unable to scan file content');
    }
    
    return threats;
  }

  /**
   * Reads file content as text for analysis
   */
  private async readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        resolve(e.target?.result as string || '');
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      // Only read first 64KB to avoid memory issues
      const chunk = file.slice(0, 64 * 1024);
      reader.readAsText(chunk);
    });
  }

  /**
   * Gets maximum allowed size for a file type
   */
  private getMaxSizeForType(mimeType: string): number {
    return this.maxSizes[mimeType] || 5 * 1024 * 1024; // Default 5MB
  }

  /**
   * Formats bytes into human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Export singleton instance
export const fileValidator = new EnhancedFileValidator();