/**
 * SecurityScanner - Validates and sanitizes all user inputs and file content
 * Implements comprehensive input sanitization and security scanning
 */

export interface ScanResult {
  isValid: boolean;
  errors: SecurityError[];
  warnings: string[];
  sanitizedData?: any;
}

export interface SecurityError {
  code: 'INVALID_BASE64' | 'XSS_DETECTED' | 'INJECTION_DETECTED' | 'SUSPICIOUS_METADATA' | 'MALICIOUS_CONTENT';
  message: string;
  details?: any;
}

export interface MetadataValidationResult {
  isValid: boolean;
  sanitizedMetadata: Record<string, any>;
  errors: SecurityError[];
  warnings: string[];
}

export class SecurityScanner {
  private readonly base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
  private readonly xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^>]*>/gi,
    /<object\b[^>]*>/gi,
    /<embed\b[^>]*>/gi,
    /<link\b[^>]*>/gi,
    /<meta\b[^>]*>/gi,
    /expression\s*\(/gi,
    /vbscript:/gi,
    /data:text\/html/gi
  ];
  
  private readonly injectionPatterns = [
    /('|(\\')|(;)|(\\;)|(\/\*)|(\\\/\*)|(--)|(\\\-\\\-)|(\/\*)|(\*\/))/gi,
    /(union|select|insert|update|delete|drop|create|alter|exec|execute)/gi,
    /(\bor\b|\band\b).*[=<>]/gi,
    /\b(eval|function|settimeout|setinterval)\s*\(/gi
  ];

  private readonly suspiciousMetadataKeys = [
    'script', 'javascript', 'vbscript', 'onload', 'onerror', 'onclick',
    'eval', 'function', 'constructor', 'prototype', '__proto__'
  ];

  /**
   * Validates base64 data format and content
   * Requirements: 3.1
   */
  validateBase64Data(data: string): ScanResult {
    const errors: SecurityError[] = [];
    const warnings: string[] = [];

    if (!data || typeof data !== 'string') {
      errors.push({
        code: 'INVALID_BASE64',
        message: 'Base64 data must be a non-empty string',
        details: { received: typeof data }
      });
      return { isValid: false, errors, warnings };
    }

    // Remove data URL prefix if present
    const base64Data = data.replace(/^data:[^;]+;base64,/, '');
    
    // Check format
    if (!this.base64Pattern.test(base64Data)) {
      errors.push({
        code: 'INVALID_BASE64',
        message: 'Invalid base64 format detected',
        details: { invalidCharacters: base64Data.match(/[^A-Za-z0-9+/=]/g) }
      });
    }

    // Check length (must be multiple of 4)
    if (base64Data.length % 4 !== 0) {
      errors.push({
        code: 'INVALID_BASE64',
        message: 'Base64 string length must be multiple of 4',
        details: { length: base64Data.length, remainder: base64Data.length % 4 }
      });
    }

    // Check for suspicious content in decoded data
    try {
      const decoded = atob(base64Data);
      const suspiciousContent = this.detectSuspiciousContent(decoded);
      if (suspiciousContent.length > 0) {
        warnings.push(`Potentially suspicious content detected: ${suspiciousContent.join(', ')}`);
      }
    } catch (error) {
      errors.push({
        code: 'INVALID_BASE64',
        message: 'Failed to decode base64 data',
        details: { error: error.message }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedData: base64Data
    };
  }

  /**
   * Sanitizes text input against XSS and injection attacks
   * Requirements: 3.2
   */
  sanitizeTextInput(input: string): ScanResult {
    const errors: SecurityError[] = [];
    const warnings: string[] = [];
    let sanitizedData = input;

    if (typeof input !== 'string') {
      errors.push({
        code: 'XSS_DETECTED',
        message: 'Input must be a string',
        details: { received: typeof input }
      });
      return { isValid: false, errors, warnings, sanitizedData: '' };
    }

    // Check for XSS patterns
    for (const pattern of this.xssPatterns) {
      const matches = input.match(pattern);
      if (matches) {
        errors.push({
          code: 'XSS_DETECTED',
          message: 'Potential XSS attack detected',
          details: { matches: matches.slice(0, 5) } // Limit to first 5 matches
        });
      }
    }

    // Check for injection patterns
    for (const pattern of this.injectionPatterns) {
      const matches = input.match(pattern);
      if (matches) {
        errors.push({
          code: 'INJECTION_DETECTED',
          message: 'Potential injection attack detected',
          details: { matches: matches.slice(0, 5) } // Limit to first 5 matches
        });
      }
    }

    // Sanitize the input
    sanitizedData = this.performTextSanitization(input);
    
    if (sanitizedData !== input) {
      warnings.push('Input was sanitized to remove potentially dangerous content');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedData
    };
  }

  /**
   * Validates file metadata for safety
   * Requirements: 3.3
   */
  validateMetadata(metadata: Record<string, any>): MetadataValidationResult {
    const errors: SecurityError[] = [];
    const warnings: string[] = [];
    const sanitizedMetadata: Record<string, any> = {};

    if (!metadata || typeof metadata !== 'object') {
      errors.push({
        code: 'SUSPICIOUS_METADATA',
        message: 'Metadata must be a valid object',
        details: { received: typeof metadata }
      });
      return { isValid: false, sanitizedMetadata: {}, errors, warnings };
    }

    for (const [key, value] of Object.entries(metadata)) {
      // Check for suspicious keys
      if (this.suspiciousMetadataKeys.some(suspiciousKey => 
        key.toLowerCase().includes(suspiciousKey.toLowerCase()))) {
        errors.push({
          code: 'SUSPICIOUS_METADATA',
          message: `Suspicious metadata key detected: ${key}`,
          details: { key, value }
        });
        continue;
      }

      // Sanitize string values
      if (typeof value === 'string') {
        const sanitizationResult = this.sanitizeTextInput(value);
        if (!sanitizationResult.isValid) {
          errors.push(...sanitizationResult.errors.map(error => ({
            ...error,
            message: `Metadata field '${key}': ${error.message}`
          })));
        } else {
          sanitizedMetadata[key] = sanitizationResult.sanitizedData;
          if (sanitizationResult.warnings.length > 0) {
            warnings.push(`Metadata field '${key}' was sanitized`);
          }
        }
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        // Allow safe primitive types
        sanitizedMetadata[key] = value;
      } else if (value === null || value === undefined) {
        // Allow null/undefined
        sanitizedMetadata[key] = value;
      } else {
        // Reject complex objects, functions, etc.
        warnings.push(`Metadata field '${key}' with type '${typeof value}' was removed for security`);
      }
    }

    return {
      isValid: errors.length === 0,
      sanitizedMetadata,
      errors,
      warnings
    };
  }

  /**
   * Detects and rejects suspicious content
   * Requirements: 3.4
   */
  detectSuspiciousContent(content: string): string[] {
    const suspiciousPatterns = [
      'javascript:',
      'vbscript:',
      'data:text/html',
      '<script',
      '</script>',
      'eval(',
      'function(',
      'setTimeout(',
      'setInterval(',
      'document.cookie',
      'document.write',
      'window.location',
      'innerHTML',
      'outerHTML'
    ];

    const detected: string[] = [];
    const lowerContent = content.toLowerCase();

    for (const pattern of suspiciousPatterns) {
      if (lowerContent.includes(pattern.toLowerCase())) {
        detected.push(pattern);
      }
    }

    return detected;
  }

  /**
   * Performs comprehensive content scanning
   */
  scanContent(content: string, contentType?: string): ScanResult {
    const errors: SecurityError[] = [];
    const warnings: string[] = [];

    // Check for suspicious content
    const suspiciousContent = this.detectSuspiciousContent(content);
    if (suspiciousContent.length > 0) {
      errors.push({
        code: 'MALICIOUS_CONTENT',
        message: 'Suspicious content patterns detected',
        details: { patterns: suspiciousContent }
      });
    }

    // Additional checks based on content type
    if (contentType) {
      if (contentType.startsWith('text/') || contentType === 'application/json') {
        const textScanResult = this.sanitizeTextInput(content);
        errors.push(...textScanResult.errors);
        warnings.push(...textScanResult.warnings);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedData: content
    };
  }

  /**
   * Private method to perform text sanitization
   */
  private performTextSanitization(input: string): string {
    let sanitized = input;

    // Remove script tags and their content
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove javascript: and vbscript: protocols
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/vbscript:/gi, '');
    
    // Remove event handlers
    sanitized = sanitized.replace(/on\w+\s*=/gi, '');
    
    // Remove dangerous HTML tags
    sanitized = sanitized.replace(/<(iframe|object|embed|link|meta)\b[^>]*>/gi, '');
    
    // Remove CSS expressions
    sanitized = sanitized.replace(/expression\s*\(/gi, '');
    
    // Remove data URLs with HTML content
    sanitized = sanitized.replace(/data:text\/html[^"']*/gi, '');

    return sanitized;
  }
}

// Export singleton instance
export const securityScanner = new SecurityScanner();