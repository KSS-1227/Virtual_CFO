// Enhanced Document Processing API Service
class EnhancedDocumentAPI {
  private baseURL: string;
  private getAuthHeaders: () => Record<string, string>;

  constructor() {
    this.baseURL = '/api/documents';
    this.getAuthHeaders = () => ({
      'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
    });
  }

  // Process single financial document
  async processDocument(file: File, options: {
    documentType?: string;
    expectedDataType?: string;
  } = {}): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const formData = new FormData();
      formData.append('document', file);
      
      if (options.documentType) {
        formData.append('document_type', options.documentType);
      }
      if (options.expectedDataType) {
        formData.append('expected_data_type', options.expectedDataType);
      }

      const response = await fetch(`${this.baseURL}/process`, {
        method: 'POST',
        body: formData,
        headers: this.getAuthHeaders()
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to process document');
      }

      return result;
    } catch (error) {
      console.error('Document processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Process multiple documents in batch
  async batchProcessDocuments(files: File[]): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const formData = new FormData();
      
      files.forEach(file => {
        formData.append('documents', file);
      });

      const response = await fetch(`${this.baseURL}/batch-process`, {
        method: 'POST',
        body: formData,
        headers: this.getAuthHeaders()
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to process documents');
      }

      return result;
    } catch (error) {
      console.error('Batch processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Get all processed documents
  async getDocuments(params: {
    page?: number;
    limit?: number;
    docType?: string;
    status?: string;
  } = {}): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.docType) queryParams.append('doc_type', params.docType);
      if (params.status) queryParams.append('status', params.status);

      const response = await fetch(`${this.baseURL}?${queryParams}`, {
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        }
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch documents');
      }

      return result;
    } catch (error) {
      console.error('Fetch documents error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Get document statistics
  async getDocumentStats(): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseURL}/stats`, {
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        }
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch document statistics');
      }

      return result;
    } catch (error) {
      console.error('Fetch stats error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Delete a document
  async deleteDocument(documentId: string): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseURL}/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        }
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete document');
      }

      return result;
    } catch (error) {
      console.error('Delete document error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Validate file before processing
  validateFile(file: File): {
    isValid: boolean;
    error?: string;
  } {
    const maxSize = 50 * 1024 * 1024; // 50MB
    const allowedTypes = [
      'image/jpeg',
      'image/png', 
      'image/webp',
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (file.size > maxSize) {
      return {
        isValid: false,
        error: 'File size must be less than 50MB'
      };
    }

    if (!allowedTypes.includes(file.mimetype || file.type)) {
      return {
        isValid: false,
        error: 'Unsupported file type. Please upload images, PDFs, or spreadsheets.'
      };
    }

    return { isValid: true };
  }

  // Get processing recommendations based on file type
  getProcessingRecommendations(file: File): {
    documentType: string;
    expectedDataType: string;
    processingTips: string[];
  } {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    if (fileType.startsWith('image/')) {
      if (fileName.includes('receipt') || fileName.includes('bill')) {
        return {
          documentType: 'receipt',
          expectedDataType: 'expense_data',
          processingTips: [
            'Ensure the receipt is clearly visible and well-lit',
            'Make sure all text is readable',
            'Include the full receipt in the image'
          ]
        };
      } else if (fileName.includes('invoice')) {
        return {
          documentType: 'invoice',
          expectedDataType: 'revenue_data',
          processingTips: [
            'Capture the entire invoice including header and footer',
            'Ensure customer and vendor details are visible',
            'Include all line items and totals'
          ]
        };
      }
    } else if (fileType === 'application/pdf') {
      if (fileName.includes('statement') || fileName.includes('bank')) {
        return {
          documentType: 'bank_statement',
          expectedDataType: 'transaction_data',
          processingTips: [
            'Ensure the PDF is not password protected',
            'Include complete statement with all transactions',
            'Make sure dates and amounts are clearly visible'
          ]
        };
      }
    }

    return {
      documentType: 'auto_detect',
      expectedDataType: 'financial_data',
      processingTips: [
        'Ensure the document is clear and readable',
        'Include all relevant financial information',
        'Make sure dates and amounts are visible'
      ]
    };
  }
}

// Export singleton instance
export const enhancedDocumentAPI = new EnhancedDocumentAPI();

// Export utility functions
export const documentUtils = {
  formatCurrency: (amount: number, currency: string = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency
    }).format(amount);
  },

  formatDate: (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  getDocumentTypeIcon: (docType: string) => {
    const iconMap: Record<string, string> = {
      'receipt': '🧾',
      'invoice': '📄',
      'bank_statement': '🏦',
      'expense_report': '📊',
      'sales_report': '📈',
      'tax_document': '📋',
      'other': '📁'
    };
    return iconMap[docType] || iconMap['other'];
  },

  calculateTotalsByType: (lineItems: any[]) => {
    return lineItems.reduce((totals, item) => {
      switch (item.type) {
        case 'revenue':
          totals.revenue += item.amount;
          break;
        case 'expense':
          totals.expenses += item.amount;
          break;
        case 'tax':
          totals.taxes += item.amount;
          break;
        case 'fee':
          totals.fees += item.amount;
          break;
      }
      return totals;
    }, { revenue: 0, expenses: 0, taxes: 0, fees: 0 });
  }
};