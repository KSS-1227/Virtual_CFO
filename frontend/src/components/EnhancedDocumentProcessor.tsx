import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  CheckCircle, 
  AlertCircle,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Eye,
  Download,
  Trash2,
  RefreshCw
} from 'lucide-react';

interface ExtractedFinancialData {
  document_type: string;
  total_revenue: number;
  total_expenses: number;
  net_amount: number;
  currency: string;
  date_range: {
    start_date: string;
    end_date: string;
  };
  line_items: Array<{
    description: string;
    amount: number;
    type: 'expense' | 'revenue' | 'tax' | 'fee';
    category: string;
    quantity?: number;
    unit_price?: number;
  }>;
  vendor_customer_info: {
    name: string;
    contact?: string;
    gst_number?: string;
    address?: string;
  };
  tax_details: {
    gst_amount: number;
    gst_rate: number;
    other_taxes: any[];
  };
  confidence: number;
  review_required: boolean;
  notes?: string;
}

interface ProcessingResult {
  extracted_data: ExtractedFinancialData;
  auto_saved: boolean;
  saved_entries: any[];
  processing_summary: {
    total_revenue: number;
    total_expenses: number;
    net_amount: number;
    line_items_count: number;
    confidence_score: number;
    review_required: boolean;
  };
}

const EnhancedDocumentProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [batchMode, setBatchMode] = useState(false);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 1) {
      setBatchMode(true);
      processBatchDocuments(files);
    } else if (files.length === 1) {
      processDocument(files[0]);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  // Process single document
  const processDocument = async (file: File) => {
    setIsProcessing(true);
    setProcessingProgress(0);
    
    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('document_type', 'auto_detect');
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/documents/process', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      clearInterval(progressInterval);
      setProcessingProgress(100);

      if (!response.ok) {
        throw new Error('Failed to process document');
      }

      const result = await response.json();
      
      if (result.success) {
        setResults(prev => [result.data, ...prev]);
      } else {
        throw new Error(result.error || 'Processing failed');
      }

    } catch (error) {
      console.error('Document processing error:', error);
      alert(`Error processing document: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };

  // Process multiple documents in batch
  const processBatchDocuments = async (files: File[]) => {
    setIsProcessing(true);
    setProcessingProgress(0);
    
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('documents', file);
      });
      
      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => Math.min(prev + 5, 90));
      }, 300);

      const response = await fetch('/api/documents/batch-process', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      clearInterval(progressInterval);
      setProcessingProgress(100);

      if (!response.ok) {
        throw new Error('Failed to process documents');
      }

      const result = await response.json();
      
      if (result.success) {
        // Add batch results to individual results
        result.data.individual_results.forEach((individualResult: any) => {
          if (!individualResult.error) {
            setResults(prev => [individualResult, ...prev]);
          }
        });
      }

    } catch (error) {
      console.error('Batch processing error:', error);
      alert(`Error processing documents: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
      setBatchMode(false);
    }
  };

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 1) {
      setBatchMode(true);
      processBatchDocuments(files);
    } else if (files.length === 1) {
      processDocument(files[0]);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
          <FileText className="h-8 w-8 text-blue-600" />
          Professional Document Processor
        </h1>
        <p className="text-gray-600">
          Upload any financial document - AI extracts complete expense and revenue data instantly
        </p>
      </div>

      {/* Upload Area */}
      <Card className={`border-2 border-dashed transition-colors ${
        dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
      }`}>
        <CardContent className="p-8">
          <div
            className="text-center space-y-4"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="flex justify-center">
              <div className="p-4 bg-gray-100 rounded-full">
                <Upload className="h-12 w-12 text-gray-600" />
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Drop documents here or click to upload
              </h3>
              <p className="text-gray-600 mb-4">
                Supports: Images (JPG, PNG), PDFs, Excel files, Bank statements
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Batch upload multiple documents for comprehensive analysis
              </p>
            </div>

            <div className="flex gap-4 justify-center">
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
                id="document-upload"
              />
              <Button asChild size="lg">
                <label htmlFor="document-upload" className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Documents
                </label>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Processing Progress */}
      {isProcessing && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
                <span className="font-medium">
                  {batchMode ? 'Processing multiple documents...' : 'Analyzing document...'}
                </span>
              </div>
              <Progress value={processingProgress} className="w-full" />
              <p className="text-sm text-gray-600">
                AI is extracting financial data, categorizing transactions, and generating insights...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Display */}
      {results.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Processing Results</h2>
          
          {results.map((result, index) => (
            <Card key={index} className="border-green-200 bg-green-50">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      Document Processed Successfully
                    </CardTitle>
                    <CardDescription>
                      {result.extracted_data.document_type} • {result.processing_summary.line_items_count} transactions
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="bg-green-100">
                      {Math.round(result.processing_summary.confidence_score * 100)}% confidence
                    </Badge>
                    {result.auto_saved && (
                      <Badge className="bg-green-600">
                        Auto-saved
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Financial Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-white">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                          <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(result.processing_summary.total_revenue)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-white">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-5 w-5 text-red-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Expenses</p>
                          <p className="text-2xl font-bold text-red-600">
                            {formatCurrency(result.processing_summary.total_expenses)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-white">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-600">Net Amount</p>
                          <p className={`text-2xl font-bold ${
                            result.processing_summary.net_amount >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatCurrency(result.processing_summary.net_amount)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Detailed Information */}
                <Tabs defaultValue="transactions" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="transactions">Transactions</TabsTrigger>
                    <TabsTrigger value="vendor">Vendor Info</TabsTrigger>
                    <TabsTrigger value="tax">Tax Details</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="transactions" className="space-y-4">
                    <div className="bg-white rounded-lg p-4">
                      <h4 className="font-semibold mb-3">Line Items</h4>
                      <div className="space-y-2">
                        {result.extracted_data.line_items?.map((item, itemIndex) => (
                          <div key={itemIndex} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <div>
                              <p className="font-medium">{item.description}</p>
                              <p className="text-sm text-gray-600">
                                {item.category} • {item.type}
                                {item.quantity && ` • Qty: ${item.quantity}`}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`font-bold ${
                                item.type === 'revenue' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {formatCurrency(item.amount)}
                              </p>
                              {item.unit_price && (
                                <p className="text-sm text-gray-600">
                                  @ {formatCurrency(item.unit_price)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="vendor" className="space-y-4">
                    <div className="bg-white rounded-lg p-4">
                      <h4 className="font-semibold mb-3">Vendor/Customer Information</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-medium">Name</p>
                          <p className="text-gray-600">{result.extracted_data.vendor_customer_info?.name || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="font-medium">Contact</p>
                          <p className="text-gray-600">{result.extracted_data.vendor_customer_info?.contact || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="font-medium">GST Number</p>
                          <p className="text-gray-600">{result.extracted_data.vendor_customer_info?.gst_number || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="font-medium">Address</p>
                          <p className="text-gray-600">{result.extracted_data.vendor_customer_info?.address || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="tax" className="space-y-4">
                    <div className="bg-white rounded-lg p-4">
                      <h4 className="font-semibold mb-3">Tax Information</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-medium">GST Amount</p>
                          <p className="text-gray-600">{formatCurrency(result.extracted_data.tax_details?.gst_amount || 0)}</p>
                        </div>
                        <div>
                          <p className="font-medium">GST Rate</p>
                          <p className="text-gray-600">{result.extracted_data.tax_details?.gst_rate || 0}%</p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Review Required Alert */}
                {result.processing_summary.review_required && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Review Required:</strong> Some data extraction had low confidence. 
                      Please verify the amounts and details before finalizing.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Help Section */}
      <Alert>
        <Eye className="h-4 w-4" />
        <AlertDescription>
          <strong>Professional AI Document Processing:</strong> This system uses advanced GPT-4 Vision 
          to extract comprehensive financial data from any document type. It automatically categorizes 
          transactions, calculates totals, and provides business insights.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default EnhancedDocumentProcessor;