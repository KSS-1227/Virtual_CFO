import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, Camera, FileText, Check, Edit, Save, X, AlertTriangle, Files, Trash2, Shield, Copy, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { openaiVisionService, type ProcessedData, type BatchProcessingResult } from "@/services/openaiVision";
import { duplicateDetectionService, type DuplicateCheckResult } from "@/services/duplicateDetection";
import { supabase } from "@/integrations/supabase/client";

interface ExtractedData extends ProcessedData {
  id: string;
  needsReview?: boolean;
  sourceFile?: string;
  isDuplicate?: boolean;
  duplicateInfo?: DuplicateCheckResult;
}

export function DocumentUploader() {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [extractedData, setExtractedData] = useState<ExtractedData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState({ completed: 0, total: 0, currentFile: '' });
  const [batchResults, setBatchResults] = useState<BatchProcessingResult | null>(null);
  const [duplicateChecks, setDuplicateChecks] = useState<Map<string, DuplicateCheckResult>>(new Map());
  const [duplicatesBlocked, setDuplicatesBlocked] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => 
      file.type.startsWith('image/') || file.type === 'application/pdf'
    );
    
    if (validFiles.length === 0) {
      setProcessingError('Please select valid image or PDF files.');
      return;
    }

    // Check for duplicates before processing
    const duplicateResults = new Map<string, DuplicateCheckResult>();
    let duplicateCount = 0;
    
    for (const file of validFiles) {
      const duplicateCheck = await duplicateDetectionService.checkForDuplicate(file);
      duplicateResults.set(file.name, duplicateCheck);
      if (duplicateCheck.isDuplicate) {
        duplicateCount++;
      }
    }
    
    setDuplicateChecks(duplicateResults);
    
    if (duplicateCount > 0) {
      setDuplicatesBlocked(duplicateCount);
      setProcessingError(
        `${duplicateCount} duplicate file${duplicateCount > 1 ? 's' : ''} detected. ` +
        `These ${duplicateCount > 1 ? 'have' : 'has'} already been processed.`
      );
    }
    
    // Filter out exact duplicates
    const nonDuplicateFiles = validFiles.filter(file => {
      const check = duplicateResults.get(file.name);
      return !check?.isDuplicate || check.matchType !== 'exact';
    });
    
    if (nonDuplicateFiles.length === 0) {
      setProcessingError('All selected files are duplicates and have already been processed.');
      return;
    }
    
    setUploadedFiles(nonDuplicateFiles);
    setIsProcessing(true);
    if (duplicateCount === 0) {
      setProcessingError(null);
    }
    setExtractedData([]);
    
    // Set batch mode if multiple files
    const batchMode = nonDuplicateFiles.length > 1;
    setIsBatchMode(batchMode);
    
    // Create preview for first file
    if (nonDuplicateFiles[0]) {
      const url = URL.createObjectURL(nonDuplicateFiles[0]);
      setPreviewUrl(url);
    }
    
    try {
      if (batchMode) {
        // Batch processing
        const results = await openaiVisionService.analyzeBatchDocuments(
          nonDuplicateFiles,
          (completed, total, currentFile) => {
            setBatchProgress({ completed, total, currentFile });
          }
        );
        
        setBatchResults(results);
        
        // Combine all successful extractions
        const allExtractedData: ExtractedData[] = [];
        results.results.forEach((result, resultIndex) => {
          if (result.success) {
            result.data.forEach(async (item, itemIndex) => {
              const validation = openaiVisionService.validateExtraction(item);
              const file = nonDuplicateFiles.find(f => f.name === result.file);
              
              // Register document to prevent future duplicates
              if (file) {
                await duplicateDetectionService.registerDocument(file, item);
              }
              
              allExtractedData.push({
                id: `${Date.now()}-${resultIndex}-${itemIndex}`,
                ...item,
                needsReview: !validation.isValid || item.confidence < 0.7,
                sourceFile: result.file
              });
            });
          }
        });
        
        setExtractedData(allExtractedData);
      } else {
        // Single file processing
        const processedData = await openaiVisionService.analyzeDocument(nonDuplicateFiles[0]);
        
        const extractedItems: ExtractedData[] = [];
        for (let index = 0; index < processedData.length; index++) {
          const item = processedData[index];
          const validation = openaiVisionService.validateExtraction(item);
          
          // Register document to prevent future duplicates
          await duplicateDetectionService.registerDocument(nonDuplicateFiles[0], item);
          
          extractedItems.push({
            id: `${Date.now()}-${index}`,
            ...item,
            needsReview: !validation.isValid || item.confidence < 0.7,
            sourceFile: nonDuplicateFiles[0].name
          });
        }
        
        setExtractedData(extractedItems);
      }
    } catch (error) {
      console.error('Document processing failed:', error);
      
      // Handle authentication errors specifically
      if (error.message.includes('Authentication required')) {
        setProcessingError('Please log in to use AI document processing. Using demo mode instead.');
        // Show demo data with clear indication
        const demoData: ExtractedData[] = [{
          id: `demo-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          description: "🔒 Demo Mode - Login required for AI processing",
          amount: -1500,
          category: "Operations",
          confidence: 0.5,
          needsReview: true,
          sourceFile: nonDuplicateFiles[0]?.name || 'demo'
        }];
        setExtractedData(demoData);
      } else {
        setProcessingError('Failed to process documents. Please try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };
  
  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    
    if (newFiles.length === 0) {
      setExtractedData([]);
      setPreviewUrl('');
      setBatchResults(null);
    }
  };
  
  const clearAllFiles = () => {
    setUploadedFiles([]);
    setExtractedData([]);
    setPreviewUrl('');
    setBatchResults(null);
    setBatchProgress({ completed: 0, total: 0, currentFile: '' });
    setDuplicateChecks(new Map());
    setDuplicatesBlocked(0);
  };

  const saveExtractedData = async () => {
    if (extractedData.length === 0) {
      alert("No data to save!");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);
    
    try {
      // Validate data before processing
      console.log('Original extracted data:', extractedData);
      
      // Fix invalid data before processing
      const fixedData = extractedData.map(item => {
        const fixedItem = {
          ...item,
          date: item.date?.includes('34') || item.date?.includes('35') || !item.date 
            ? new Date().toISOString().split('T')[0] 
            : item.date,
          amount: typeof item.amount === 'number' ? item.amount : parseFloat(item.amount) || 0
        };
        
        console.log('Fixed item:', { original: item, fixed: fixedItem });
        return fixedItem;
      });
      
      console.log('All fixed data:', fixedData);
      
      // Group items by date and calculate totals properly
      const dateGroups = new Map<string, { revenue: number; expenses: number; items: typeof fixedData }>();
      
      // Group items by date
      fixedData.forEach(item => {
        const date = item.date;
        if (!dateGroups.has(date)) {
          dateGroups.set(date, { revenue: 0, expenses: 0, items: [] });
        }
        
        const group = dateGroups.get(date)!;
        group.items.push(item);
        
        // Categorize based on amount sign and transaction type
        const isRevenue = item.amount > 0 || item.type?.toLowerCase() === 'sale' || item.transaction_type === 'income';
        const isExpense = item.amount < 0 || item.type?.toLowerCase() === 'expense' || item.type?.toLowerCase() === 'purchase' || item.transaction_type === 'expense';
        
        if (isRevenue) {
          group.revenue += Math.abs(item.amount);
        } else if (isExpense) {
          group.expenses += Math.abs(item.amount);
        } else {
          // Fallback: positive amounts are revenue, negative are expenses
          if (item.amount > 0) {
            group.revenue += Math.abs(item.amount);
          } else {
            group.expenses += Math.abs(item.amount);
          }
        }
      });
      
      // Insert or update earnings for each date
      let successCount = 0;
      let totalRevenue = 0;
      let totalExpenses = 0;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      for (const [date, group] of dateGroups) {
        try {
          console.log('Processing date group:', { date, revenue: group.revenue, expenses: group.expenses });
          
          // Check if record exists for this date
          const { data: existingRecord } = await supabase
            .from('earnings')
            .select('*')
            .eq('user_id', user.id)
            .eq('earning_date', date)
            .single();
          
          const earningsData = {
            user_id: user.id,
            earning_date: date,
            amount: existingRecord ? existingRecord.amount + group.revenue : group.revenue,
            inventory_cost: existingRecord ? existingRecord.inventory_cost + group.expenses : group.expenses
          };
          
          console.log('Earnings data for date:', date, earningsData);
          
          if (existingRecord) {
            // Update existing record by adding new amounts
            const { error } = await supabase
              .from('earnings')
              .update({
                amount: earningsData.amount,
                inventory_cost: earningsData.inventory_cost
              })
              .eq('id', existingRecord.id);
              
            if (error) {
              console.error('Update error:', error);
              throw new Error(`Update error: ${error.message}`);
            }
            
            console.log('Successfully updated record for date:', date);
          } else {
            // Insert new record
            const { error } = await supabase
              .from('earnings')
              .insert(earningsData);
              
            if (error) {
              console.error('Insert error:', error);
              throw new Error(`Insert error: ${error.message}`);
            }
            
            console.log('Successfully inserted record for date:', date);
          }
          
          successCount++;
          totalRevenue += group.revenue;
          totalExpenses += group.expenses;
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 
                              error?.message || 
                              JSON.stringify(error) || 
                              'Unknown error';
          console.error(`Failed to save date group ${date}:`, {
            error: errorMessage,
            date,
            group
          });
        }
      }
      
      if (successCount > 0) {
        setSaveSuccess(true);
        const netProfit = totalRevenue - totalExpenses;
        alert(`✅ Successfully processed ${successCount} date${successCount > 1 ? 's' : ''}!\n\n📊 Summary:\n💰 Total Revenue: ₹${totalRevenue.toLocaleString()}\n💸 Total Expenses: ₹${totalExpenses.toLocaleString()}\n📈 Net Profit: ₹${netProfit.toLocaleString()}\n\nCheck your dashboard for updated totals!`);
        
        // Clear data after success
        setExtractedData([]);
        setUploadedFiles([]);
        setPreviewUrl('');
        setBatchResults(null);
      } else {
        alert('⚠️ No transactions were saved. Please check the data and try again.');
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 
                          error?.message || 
                          JSON.stringify(error) || 
                          'Unknown error';
      console.error('Save error details:', {
        error: errorMessage,
        extractedDataCount: extractedData.length,
        firstItem: extractedData[0]
      });
      alert(`❌ Failed to save data: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  const startCamera = () => {
    // Camera capture functionality
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(() => {
          alert("Camera access granted. In production, this would open camera interface.");
        })
        .catch(() => {
          alert("Camera access denied or not available.");
        });
    } else {
      alert("Camera not supported on this device.");
    }
  };

  const handleCategoryCorrection = (itemId: string, newCategory: string) => {
    setExtractedData(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { ...item, category: newCategory, confidence: 1.0, needsReview: false }
          : item
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="modern-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Financial Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!uploadedFiles.length ? (
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center space-y-4 cursor-pointer hover:border-primary/50 transition-colors"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Upload your ledger or receipts</h3>
                <p className="text-muted-foreground">
                  Drag and drop files here, or click to browse
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Supports: PDF, JPG, PNG (Max 10MB each) • Multiple files supported
                </p>
              </div>
              
              <div className="flex justify-center gap-4">
                <Button size="lg" className="btn-primary">
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Files
                </Button>
                <Button size="lg" variant="outline" onClick={(e) => { e.stopPropagation(); startCamera(); }}>
                  <Camera className="h-4 w-4 mr-2" />
                  Take Photo
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">
                    {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''} selected
                  </h4>
                  <Button variant="ghost" size="sm" onClick={clearAllFiles}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                </div>
                
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium truncate max-w-48">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeFile(index)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Processing Progress */}
              {isProcessing && (
                <div className="space-y-3">
                  {isBatchMode ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Processing documents...</span>
                        <span>{batchProgress.completed}/{batchProgress.total}</span>
                      </div>
                      <Progress 
                        value={(batchProgress.completed / batchProgress.total) * 100} 
                        className="h-2"
                      />
                      {batchProgress.currentFile && (
                        <p className="text-xs text-muted-foreground truncate">
                          Current: {batchProgress.currentFile}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-sm text-muted-foreground">Analyzing document...</p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Batch Results Summary */}
              {batchResults && !isProcessing && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <h4 className="text-sm font-medium mb-2">Batch Processing Results</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-lg font-bold text-success">{batchResults.summary.successful}</p>
                      <p className="text-xs text-muted-foreground">Successful</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-destructive">{batchResults.summary.failed}</p>
                      <p className="text-xs text-muted-foreground">Failed</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-primary">{batchResults.summary.totalExtracted}</p>
                      <p className="text-xs text-muted-foreground">Entries</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Duplicate Detection Alert */}
              {duplicatesBlocked > 0 && (
                <div className="border rounded-lg p-4 bg-orange-50 border-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-orange-600" />
                    <p className="text-sm font-medium text-orange-800">
                      Duplicate Protection Active
                    </p>
                  </div>
                  <p className="text-sm text-orange-700">
                    {duplicatesBlocked} duplicate{duplicatesBlocked > 1 ? 's' : ''} detected and blocked. 
                    These files have already been processed to prevent double-counting.
                  </p>
                  <div className="mt-2 text-xs text-orange-600">
                    <div className="flex items-center gap-1">
                      <Copy className="h-3 w-3" />
                      Duplicate files:
                    </div>
                    <ul className="mt-1 ml-4 space-y-1">
                      {Array.from(duplicateChecks.entries())
                        .filter(([_, check]) => check.isDuplicate)
                        .map(([fileName, check]) => (
                          <li key={fileName} className="flex items-center gap-1">
                            <span>• {fileName}</span>
                            <Badge variant="outline" className="text-xs">
                              {check.matchType} match ({Math.round(check.confidence * 100)}%)
                            </Badge>
                          </li>
                        ))
                      }
                    </ul>
                  </div>
                </div>
              )}
              
              {processingError && (
                <div className={cn(
                  "border rounded-lg p-4 flex items-center gap-2",
                  processingError.includes('Login required') 
                    ? "bg-blue-50 border-blue-200" 
                    : processingError.includes('duplicate')
                    ? "bg-orange-50 border-orange-200"
                    : "bg-destructive/10 border-destructive/20"
                )}>
                  <AlertTriangle className={cn(
                    "h-4 w-4",
                    processingError.includes('Login required') 
                      ? "text-blue-600" 
                      : processingError.includes('duplicate')
                      ? "text-orange-600"
                      : "text-destructive"
                  )} />
                  <p className={cn(
                    "text-sm",
                    processingError.includes('Login required') 
                      ? "text-blue-800" 
                      : processingError.includes('duplicate')
                      ? "text-orange-800"
                      : "text-destructive"
                  )}>
                    {processingError}
                  </p>
                </div>
              )}
            </div>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png"
            multiple
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFileUpload(e.target.files);
              }
            }}
          />
        </CardContent>
      </Card>

      {/* Preview & Extracted Data */}
      {extractedData.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Document Preview */}
          <Card className="modern-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Document Preview
                {isBatchMode && (
                  <Badge variant="outline" className="text-xs">
                    <Files className="h-3 w-3 mr-1" />
                    Batch Mode
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {previewUrl ? (
                <div className="bg-muted/30 rounded-lg overflow-hidden">
                  {uploadedFiles[0]?.type.startsWith('image/') ? (
                    <img 
                      src={previewUrl} 
                      alt="Document preview" 
                      className="w-full h-48 object-contain"
                    />
                  ) : (
                    <div className="p-4 text-center">
                      <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">PDF processed successfully</p>
                    </div>
                  )}
                  {isBatchMode && uploadedFiles.length > 1 && (
                    <div className="p-2 bg-black/5 text-center">
                      <p className="text-xs text-muted-foreground">
                        +{uploadedFiles.length - 1} more file{uploadedFiles.length > 2 ? 's' : ''}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-muted/30 rounded-lg p-8 text-center">
                  <p className="text-muted-foreground">No preview available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Extracted Data */}
          <Card className="modern-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Extracted Data</CardTitle>
                <div className="flex gap-2">
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                    ✓ {extractedData.length} entries found
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {extractedData.map((item) => (
                  <div key={item.id} className={cn(
                    "p-3 rounded-lg border",
                    item.needsReview ? "bg-yellow-50 border-yellow-200" : "bg-muted/30 border-transparent"
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{item.description}</span>
                          <Badge 
                            variant={item.confidence > 0.8 ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {item.category}
                          </Badge>
                          {item.confidence && (
                            <Badge variant="outline" className="text-xs">
                              {Math.round(item.confidence * 100)}%
                            </Badge>
                          )}
                          {item.needsReview && (
                            <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Review
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <p className="text-xs text-muted-foreground">{item.date}</p>
                          {item.vendor && (
                            <p className="text-xs text-muted-foreground">• {item.vendor}</p>
                          )}
                          {item.sourceFile && (
                            <p className="text-xs text-muted-foreground">• {item.sourceFile}</p>
                          )}
                          {item.gst_number && (
                            <p className="text-xs text-muted-foreground">• GST: {item.gst_number}</p>
                          )}
                        </div>
                      </div>
                      <div className={cn(
                        "text-sm font-medium",
                        item.amount > 0 ? "text-success" : "text-destructive"
                      )}>
                        {item.amount > 0 ? "+" : ""}₹{Math.abs(item.amount).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t">
                <Button 
                  onClick={saveExtractedData} 
                  className="w-full btn-primary"
                  disabled={isSaving || extractedData.length === 0}
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Saving to Dashboard...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save ₹{(() => {
                        const revenue = extractedData.filter(item => 
                          item.amount > 0 || item.type?.toLowerCase() === 'sale'
                        ).reduce((sum, item) => sum + Math.abs(item.amount), 0);
                        
                        const expenses = extractedData.filter(item => 
                          item.amount < 0 || item.type?.toLowerCase() === 'expense' || item.type?.toLowerCase() === 'purchase'
                        ).reduce((sum, item) => sum + Math.abs(item.amount), 0);
                        
                        return `${revenue.toLocaleString()} Revenue + ₹${expenses.toLocaleString()} Expenses`;
                      })()}
                    </>
                  )}
                </Button>
                
                {saveSuccess && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-center">
                    <div className="flex items-center justify-center gap-1 text-green-800 text-sm">
                      <DollarSign className="h-4 w-4" />
                      <span>Revenue and expenses updated successfully!</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}