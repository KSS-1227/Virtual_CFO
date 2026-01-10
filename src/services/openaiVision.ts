import { handleOpenAIError, compressImage, DocumentProcessingError } from './documentUtils';
import { supabase } from '@/integrations/supabase/client';

interface ExtractedReceiptData {
  date: string;
  vendor: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total_amount: number;
  category: string;
  subcategory: string;
  gst_number?: string;
  confidence: number;
  transaction_type: 'income' | 'expense';
}

interface ProcessedData {
  date: string;
  description: string;
  amount: number;
  category: string;
  subcategory?: string;
  confidence: number;
  vendor?: string;
  gst_number?: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
}

interface BatchDocumentResult {
  file: string;
  success: boolean;
  data: ProcessedData[];
  error: string | null;
}

interface BatchProcessingResult {
  results: BatchDocumentResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    totalExtracted: number;
  };
}

class OpenAIVisionService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
  }

  isConfigured(): boolean {
    return true; // Backend handles API key validation
  }

  getConfigurationError(): string | null {
    return null; // Backend handles configuration
  }

  private async convertToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        resolve(base64.split(',')[1]); // Remove data:image/jpeg;base64, prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private getAnalysisPrompt(): string {
    return `You are an expert Indian business accountant analyzing financial documents.

ANALYZE this document and extract EACH INDIVIDUAL TRANSACTION as a separate entry.

For LEDGER/DAYBOOK documents with multiple transactions:
- Extract EACH ROW as a separate transaction
- Look for columns: Time, Party/Customer, Item, Quantity, Amount, Type
- Each transaction should have its own entry

For SINGLE RECEIPT documents:
- Extract as one transaction with all items

TRANSACTION TYPES:
- "Sale" = Revenue (positive amount)
- "Purchase" = Expense (negative amount) 
- "Expense" = Expense (negative amount)

CATEGORIES:
- Revenue: Sales, Service Income
- Inventory: Stock Purchases, Raw Materials
- Operations: Rent, Utilities, Electricity
- Staff: Salaries, Wages
- Transport: Fuel, Vehicle costs
- Marketing: Advertisements
- Professional: CA fees, Legal
- Technology: Software, Hardware
- Finance: Bank charges, Interest
- Miscellaneous: Other expenses

Return ONLY valid JSON array with EACH transaction as separate object:
[
  {
    "date": "2015-12-25",
    "vendor": "Ramu Vegetable Supplier",
    "items": [{"name": "Cabbage", "quantity": 10, "price": 360}],
    "total_amount": 360,
    "category": "Inventory",
    "subcategory": "Vegetables",
    "confidence": 0.95,
    "transaction_type": "expense",
    "type": "Purchase"
  },
  {
    "date": "2015-12-25",
    "vendor": "Rajesh Kumar",
    "items": [{"name": "Cabbage", "quantity": 2, "price": 100}],
    "total_amount": 100,
    "category": "Revenue",
    "subcategory": "Sales",
    "confidence": 0.95,
    "transaction_type": "income",
    "type": "Sale"
  }
]

EXTRACT ALL VISIBLE TRANSACTIONS. Do not summarize - each row is a separate transaction.`;
  }

  async analyzeDocument(file: File): Promise<ProcessedData[]> {
    try {
      // Convert file to base64
      const base64Image = await this.convertToBase64(file);
      
      // Get auth token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('Authentication required. Please log in to use document processing.');
      }
      
      const response = await fetch(`${this.baseUrl}/api/vision/analyze-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          imageData: `data:${file.type};base64,${base64Image}`,
          fileName: file.name
        })
      });

      if (!response.ok) {
        throw new Error(`Backend API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        // Show specific error message to user
        throw new Error(result.error || 'Backend processing failed');
      }

      // Check if this is fallback data
      if (result.fallback) {
        console.warn('Using fallback data due to processing issues:', result.error);
      }

      return result.data;

    } catch (error) {
      console.error('Document analysis error:', error);

      // Handle authentication errors specifically
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        throw new Error('Authentication required. Please log in to use document processing.');
      }

      // Do NOT return demo/fallback data. Surface the error to the caller.
      throw new Error(`Document processing failed: ${error?.message || String(error)}`);
    }
  }

  // Batch processing with backend API
  async analyzeBatchDocuments(
    files: File[], 
    onProgress?: (completed: number, total: number, currentFile: string) => void
  ): Promise<BatchProcessingResult> {
    try {
      // Convert all files to base64
      const documents = await Promise.all(
        files.map(async (file) => ({
          imageData: `data:${file.type};base64,${await this.convertToBase64(file)}`,
          fileName: file.name
        }))
      );
      
      // Get auth token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('Authentication required. Please log in to use batch processing.');
      }
      
      const response = await fetch(`${this.baseUrl}/api/vision/analyze-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ documents })
      });

      if (!response.ok) {
        throw new Error(`Backend API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Batch processing failed');
      }

      return result.data;

    } catch (error) {
      console.error('Batch processing error:', error);
      
      // Handle authentication errors specifically
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        throw new Error('Authentication required. Please log in to use batch processing.');
      }
      
      // Return fallback batch result
      return {
        results: files.map(file => ({
          file: file.name,
          success: false,
          data: [],
          error: error.message
        })),
        summary: {
          total: files.length,
          successful: 0,
          failed: files.length,
          totalExtracted: 0
        }
      };
    }
  }
    // CRITICAL FIX #1: Token usage tracking for cost visibility
    private async trackTokenUsage(
      fileName: string,
      response: any
    ): Promise<{ 
      totalTokens: number; 
      inputTokens: number; 
      outputTokens: number; 
      estimatedCost: number;
      model: string;
    }> {
      // Extract token usage from API response
      const usage = response?.usage || { prompt_tokens: 0, completion_tokens: 0 };
      const inputTokens = usage.prompt_tokens || 0;
      const outputTokens = usage.completion_tokens || 0;
      const totalTokens = inputTokens + outputTokens;
    
      // Model detection and cost calculation (as of Jan 2025)
      let model = 'gpt-4o';
      let costPerMTok = 0; // cost per million tokens
    
      // Cost: GPT-4o = $2.50/$10 (input/output)
      const inputCost = (inputTokens / 1000000) * 2.50;
      const outputCost = (outputTokens / 1000000) * 10.00;
      const estimatedCostUSD = inputCost + outputCost;
      const estimatedCostINR = estimatedCostUSD * 83; // approx INR conversion
    
      // Log for analytics
      console.log(`Token usage for ${fileName}:`, {
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCostINR: estimatedCostINR.toFixed(2)
      });
    
      return {
        totalTokens,
        inputTokens,
        outputTokens,
        estimatedCost: estimatedCostINR,
        model
      };
    }

    // CRITICAL FIX #2: Resilient error recovery with retry logic
    private async retryWithBackoff<T>(
      operation: () => Promise<T>,
      maxRetries: number = 3,
      baseDelay: number = 1000
    ): Promise<T> {
      let lastError: Error;
    
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          return await operation();
        } catch (error) {
          lastError = error as Error;
        
          // Don't retry authentication errors
          if (lastError.message.includes('401') || lastError.message.includes('Unauthorized')) {
            throw lastError;
          }
        
          // Exponential backoff: 1s, 2s, 4s
          if (attempt < maxRetries - 1) {
            const delay = baseDelay * Math.pow(2, attempt);
            console.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms:`, lastError.message);
            await this.delay(delay);
          }
        }
      }
    
      throw lastError!;
    }
  
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private convertToProcessedData(extractedData: ExtractedReceiptData[]): ProcessedData[] {
    return extractedData.map(data => ({
      date: data.date,
      description: `${data.vendor} - ${data.items.map(item => item.name).join(', ')}`,
      amount: data.transaction_type === 'expense' ? -Math.abs(data.total_amount) : Math.abs(data.total_amount),
      category: data.category,
      subcategory: data.subcategory,
      confidence: data.confidence,
      vendor: data.vendor,
      gst_number: data.gst_number,
      items: data.items
    }));
  }

  private getFallbackData(errorMessage?: string): ProcessedData[] {
    // Deprecated: do not return demo data. Surface as error instead.
    return this.handleProcessingError(errorMessage || 'Processing unavailable');
  }

    private handleProcessingError(errorMessage: string): ProcessedData[] {
      // CRITICAL FIX #3: Don't return fake demo data on errors
      // Instead, throw the error so UI can handle it properly
      console.error('Processing failed. User should see actual error, not fake data.');
      throw new Error(`Document processing failed: ${errorMessage}`);
    }

  // Validate extracted data
  validateExtraction(data: ProcessedData): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    if (!data.date || isNaN(Date.parse(data.date))) {
      issues.push('Invalid or missing date');
    }
    
    if (!data.amount || Math.abs(data.amount) > 10000000) {
      issues.push('Invalid amount');
    }
    
    if (!data.category) {
      issues.push('Missing category');
    }
    
    if (data.confidence < 0.5) {
      issues.push('Low confidence extraction');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

export const openaiVisionService = new OpenAIVisionService();
export type { ProcessedData, BatchDocumentResult, BatchProcessingResult };