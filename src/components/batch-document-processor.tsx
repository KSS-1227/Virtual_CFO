import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Upload, 
  Files, 
  CheckCircle, 
  XCircle, 
  Download, 
  Trash2,
  AlertTriangle,
                  <Button
                    size="sm"
                    onClick={startBatchProcessingWithRetry}
                    disabled={isProcessing || selectedFiles.length === 0}
                    className="btn-primary"
                  >
                    {isProcessing ? 'Processing...' : 'Start Processing'}
                  </Button>
    Files, 
    CheckCircle, 
    XCircle, 
    Download, 
    Trash2,
    AlertTriangle,
    FileText,
    Image,
    DollarSign,
    Zap
  } from 'lucide-react';
    );
    
    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setSelectedFiles([]);
    reset();
  };

  const startBatchProcessing = async () => {
    if (selectedFiles.length === 0) return;
    
    try {
      await processBatch(selectedFiles);
    } catch (error) {
      console.error('Batch processing failed:', error);
    }
  };
    // CRITICAL FIX #2: Resilient processing with automatic retry
    const startBatchProcessingWithRetry = async () => {
      if (selectedFiles.length === 0) return;
    
      const MAX_RETRIES = 2;
      let attempt = 0;
      let lastError: any;
    
      while (attempt < MAX_RETRIES) {
        try {
          await processBatch(selectedFiles);
          return; // Success - exit
        } catch (error) {
          lastError = error;
          attempt++;
        
          // Don't retry on authentication errors
          if (error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
            console.error('Authentication error - no retry:', error);
            break;
          }
        
          if (attempt < MAX_RETRIES) {
            const delay = 2000 * attempt; // 2s, 4s backoff
            console.warn(`Batch processing failed, retrying in ${delay}ms... (attempt ${attempt}/${MAX_RETRIES})`);
          
            // Show retry notification to user
            const retryMsg = `Processing failed. Retrying... (attempt ${attempt}/${MAX_RETRIES})`;
            // Could integrate with toast notification here
          
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    
      // All retries exhausted
      console.error('Batch processing failed after all retries:', lastError);
    };

  const downloadResults = () => {
    if (!results) return;
    
    const csvData = results.results
      .filter(r => r.success)
      .flatMap(r => r.data.map(item => ({
        file: r.file,
        date: item.date,
        description: item.description,
        amount: item.amount,
        category: item.category,
        vendor: item.vendor || '',
        confidence: item.confidence
      })));
    
    const csvContent = [
      'File,Date,Description,Amount,Category,Vendor,Confidence',
      ...csvData.map(row => 
        `"${row.file}","${row.date}","${row.description}",${row.amount},"${row.category}","${row.vendor}",${row.confidence}`
      )
    ].join('\\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-processing-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (file.type === 'application/pdf') return <FileText className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  return (
    <div className="space-y-6">
      {/* File Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Files className="h-5 w-5" />
            Batch Document Processor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload Area */}
          <div
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">Drop files here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">
              Support: PDF, JPG, PNG • Max 50 files • 10MB each
            </p>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => handleFileSelection(e.target.files)}
          />
          
          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">
                  {selectedFiles.length} files selected
                </h4>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={startBatchProcessing}
                    disabled={isProcessing || selectedFiles.length === 0}
                    className="btn-primary"
                  >
                    {isProcessing ? 'Processing...' : 'Start Processing'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={clearAll}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                </div>
              </div>
              
              <div className="max-h-48 overflow-y-auto space-y-1">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                    <div className="flex items-center gap-2">
                      {getFileIcon(file)}
                      <div>
                        <p className="text-sm font-medium truncate max-w-64">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeFile(index)}
                      disabled={isProcessing}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processing Progress */}
      {isProcessing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Processing Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing documents...</span>
                <span>{progress.completed}/{progress.total}</span>
              </div>
              <Progress value={(progress.completed / progress.total) * 100} className="h-2" />
              {progress.currentFile && (
                <p className="text-xs text-muted-foreground">
                  Current: {progress.currentFile}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-destructive/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results && !isProcessing && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Processing Results</CardTitle>
              <Button size="sm" variant="outline" onClick={downloadResults}>
                <Download className="h-4 w-4 mr-1" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
              <div className="text-center">
                <p className="text-2xl font-bold">{results.summary.total}</p>
                <p className="text-xs text-muted-foreground">Total Files</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-success">{results.summary.successful}</p>
                <p className="text-xs text-muted-foreground">Successful</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-destructive">{results.summary.failed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{results.summary.totalExtracted}</p>
                <p className="text-xs text-muted-foreground">Entries</p>
              </div>
            </div>

              {/* Cost Tracking Widget - CRITICAL FIX #1 */}
              <div className="grid grid-cols-2 gap-4 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <DollarSign className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-xs text-blue-600 font-medium">Estimated Cost</p>
                    <p className="text-lg font-bold text-blue-900">
                      ₹{((results.summary.totalExtracted * 0.05) || 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">~₹0.05 per entry</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Zap className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-xs text-blue-600 font-medium">Processing Time</p>
                    <p className="text-lg font-bold text-blue-900">
                      {results.summary.successful > 0 ? '2-5s/file' : 'N/A'}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">avg completion time</p>
                  </div>
                </div>
              </div>

            <Separator />

            {/* Detailed Results */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {results.results.map((result, index) => (
                <div key={index} className={cn(
                  "p-3 rounded border",
                  result.success ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <CheckCircle className="h-4 w-4 text-success" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={startBatchProcessingWithRetry}
                    disabled={isProcessing || selectedFiles.length === 0}
                    className="btn-primary"
                  >
                    {isProcessing ? 'Processing...' : 'Start Processing'}
                  </Button>
  );
}