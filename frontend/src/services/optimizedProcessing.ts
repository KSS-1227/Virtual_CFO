// Optimized batch processing with concurrent limits and cost optimization
export class OptimizedBatchProcessor {
  private static readonly CONCURRENT_LIMIT = 5;
  private static readonly RATE_LIMIT_DELAY = 1000; // 1 second between batches
  private static readonly MAX_RETRIES = 3;

  static async processBatchWithLimits<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    onProgress?: (completed: number, total: number, current: string) => void
  ): Promise<R[]> {
    const results: R[] = [];
    const total = items.length;

    for (let i = 0; i < items.length; i += this.CONCURRENT_LIMIT) {
      const batch = items.slice(i, i + this.CONCURRENT_LIMIT);
      
      // Process batch concurrently
      const batchPromises = batch.map(async (item, batchIndex) => {
        const globalIndex = i + batchIndex;
        onProgress?.(globalIndex, total, this.getItemName(item));
        
        return this.processWithRetry(item, processor);
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      // Collect successful results
      batchResults.forEach((result, batchIndex) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`Failed to process item ${i + batchIndex}:`, result.reason);
        }
      });

      // Rate limiting: wait between batches
      if (i + this.CONCURRENT_LIMIT < items.length) {
        await this.delay(this.RATE_LIMIT_DELAY);
      }
    }

    return results;
  }

  private static async processWithRetry<T, R>(
    item: T,
    processor: (item: T) => Promise<R>,
    retries = 0
  ): Promise<R> {
    try {
      return await processor(item);
    } catch (error) {
      if (retries < this.MAX_RETRIES) {
        // Exponential backoff
        await this.delay(Math.pow(2, retries) * 1000);
        return this.processWithRetry(item, processor, retries + 1);
      }
      throw error;
    }
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private static getItemName(item: any): string {
    if (item && typeof item === 'object') {
      return item.name || item.filename || item.id || 'Unknown';
    }
    return String(item);
  }
}

// Cost optimization utilities
export class CostOptimizer {
  private static readonly TOKEN_COSTS = {
    'gpt-4o': { input: 0.005, output: 0.015 }, // per 1K tokens
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 }
  };

  static estimateProcessingCost(
    fileCount: number, 
    avgTokensPerFile = 1000,
    model = 'gpt-4o-mini'
  ): number {
    const costs = this.TOKEN_COSTS[model] || this.TOKEN_COSTS['gpt-4o-mini'];
    const totalTokens = fileCount * avgTokensPerFile;
    return (totalTokens / 1000) * costs.input;
  }

  static shouldProcessFile(
    file: File,
    duplicateCheck: { isDuplicate: boolean; matchType: string }
  ): { process: boolean; reason: string; costSaved?: number } {
    // Skip exact duplicates
    if (duplicateCheck.isDuplicate && duplicateCheck.matchType === 'exact') {
      return {
        process: false,
        reason: 'Exact duplicate detected',
        costSaved: this.estimateProcessingCost(1)
      };
    }

    // Check file size (very large files cost more)
    if (file.size > 10 * 1024 * 1024) { // 10MB
      return {
        process: false,
        reason: 'File too large (>10MB)'
      };
    }

    // Check file type
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      return {
        process: false,
        reason: 'Unsupported file type'
      };
    }

    return { process: true, reason: 'Ready for processing' };
  }
}

// Enhanced validation with business rules
export class EnhancedValidator {
  static validateExtractedData(data: any): { isValid: boolean; errors: string[]; confidence: number } {
    const errors: string[] = [];
    let confidence = 1.0;

    // Date validation
    if (data.date) {
      const date = new Date(data.date);
      if (isNaN(date.getTime())) {
        errors.push("Invalid date format");
        confidence -= 0.3;
      } else {
        const now = new Date();
        const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
        
        if (date > now) {
          errors.push("Date is in the future");
          confidence -= 0.2;
        } else if (date < twoYearsAgo) {
          errors.push("Date is more than 2 years old");
          confidence -= 0.1;
        }
      }
    } else {
      errors.push("Date is required");
      confidence -= 0.4;
    }

    // Amount validation
    if (typeof data.amount !== 'number' || data.amount <= 0) {
      errors.push("Amount must be a positive number");
      confidence -= 0.4;
    } else {
      // Suspicious amounts
      if (data.amount > 1000000) {
        errors.push("Amount suspiciously high (>₹10L)");
        confidence -= 0.2;
      } else if (data.amount < 1) {
        errors.push("Amount suspiciously low (<₹1)");
        confidence -= 0.1;
      }
    }

    // Vendor validation
    if (!data.vendor || data.vendor.trim().length < 2) {
      errors.push("Vendor name too short or missing");
      confidence -= 0.1;
    }

    // Category validation
    const validCategories = [
      'food', 'transport', 'utilities', 'office', 'inventory', 
      'equipment', 'marketing', 'professional', 'other'
    ];
    if (data.category && !validCategories.includes(data.category.toLowerCase())) {
      // Don't mark as error, just reduce confidence
      confidence -= 0.05;
    }

    return {
      isValid: errors.length === 0,
      errors,
      confidence: Math.max(0, confidence)
    };
  }

  static getConfidenceThreshold(amount: number): number {
    // Dynamic thresholds based on amount
    if (amount > 100000) return 0.90; // Very high value: 90%+ confidence required
    if (amount > 50000) return 0.85;  // High value: 85%+ confidence required
    if (amount > 10000) return 0.75;  // Medium value: 75%+ confidence required
    return 0.65; // Low value: 65%+ confidence required
  }

  static needsReview(data: any, extractedConfidence: number): boolean {
    const validation = this.validateExtractedData(data);
    const threshold = this.getConfidenceThreshold(data.amount || 0);
    
    return !validation.isValid || 
           extractedConfidence < threshold ||
           validation.confidence < threshold;
  }
}