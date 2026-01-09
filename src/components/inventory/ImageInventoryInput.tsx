import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Camera, Upload, Image as ImageIcon, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ExtractedData {
  product_name?: string;
  brand?: string;
  category?: string;
  visible_quantity?: number;
  unit_type?: string;
  price?: number;
  confidence?: number;
  items?: Array<{
    product_name: string;
    quantity: number;
    unit: string;
    price?: number;
  }>;
}

interface ImageProcessingResult {
  success: boolean;
  image_type: {
    type: string;
    confidence: number;
  };
  extracted_data: ExtractedData;
  processing_time: number;
}

interface ImageInventoryInputProps {
  onDataExtracted: (result: ImageProcessingResult) => void;
  onError: (error: string) => void;
}

export const ImageInventoryInput: React.FC<ImageInventoryInputProps> = ({
  onDataExtracted,
  onError
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [processingResult, setProcessingResult] = useState<ImageProcessingResult | null>(null);
  const [isCameraMode, setIsCameraMode] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      
      setProcessingResult(null);
    } else {
      onError('Please select a valid image file');
    }
  }, [onError]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Use back camera on mobile
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraMode(true);
      }
    } catch (error) {
      console.error('Error starting camera:', error);
      onError('Failed to start camera. Please check camera permissions.');
    }
  }, [onError]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraMode(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
            setSelectedImage(file);
            setImagePreview(canvas.toDataURL());
            stopCamera();
            setProcessingResult(null);
          }
        }, 'image/jpeg', 0.8);
      }
    }
  }, [stopCamera]);

  const processImage = async () => {
    if (!selectedImage) {
      onError('Please select an image first');
      return;
    }

    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedImage);

      const response = await fetch('/api/inventory/image-processing', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to process image');
      }

      setProcessingResult(result.image_result);
      onDataExtracted(result.image_result);

      toast({
        title: "Image processed successfully",
        description: `Detected ${result.image_result.image_type.type} with ${Math.round(result.image_result.extracted_data.confidence * 100)}% confidence`,
      });

    } catch (error) {
      console.error('Error processing image:', error);
      onError(error instanceof Error ? error.message : 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  const processReceipt = async () => {
    if (!selectedImage) {
      onError('Please select a receipt image first');
      return;
    }

    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedImage);

      const response = await fetch('/api/inventory/receipt-processing', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to process receipt');
      }

      setProcessingResult(result.receipt_processing_result);
      onDataExtracted(result.receipt_processing_result);

      toast({
        title: "Receipt processed successfully",
        description: `Processed ${result.items_processed} items from receipt`,
      });

    } catch (error) {
      console.error('Error processing receipt:', error);
      onError(error instanceof Error ? error.message : 'Failed to process receipt');
    } finally {
      setIsProcessing(false);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview('');
    setProcessingResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Image Inventory Processing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Image Input Controls */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            disabled={isProcessing || isCameraMode}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Image
          </Button>
          
          <Button
            onClick={isCameraMode ? stopCamera : startCamera}
            variant="outline"
            disabled={isProcessing}
          >
            <Camera className="h-4 w-4 mr-2" />
            {isCameraMode ? 'Stop Camera' : 'Use Camera'}
          </Button>

          {selectedImage && (
            <Button
              onClick={clearImage}
              variant="ghost"
              size="sm"
              disabled={isProcessing}
            >
              Clear
            </Button>
          )}
        </div>

        <Input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Camera View */}
        {isCameraMode && (
          <div className="space-y-2">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full max-w-md mx-auto rounded-lg"
            />
            <div className="flex justify-center">
              <Button onClick={capturePhoto}>
                <Camera className="h-4 w-4 mr-2" />
                Capture Photo
              </Button>
            </div>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />

        {/* Image Preview */}
        {imagePreview && (
          <div className="space-y-2">
            <h4 className="font-medium">Selected Image:</h4>
            <img
              src={imagePreview}
              alt="Selected"
              className="max-w-full max-h-64 mx-auto rounded-lg border"
            />
          </div>
        )}

        {/* Processing Controls */}
        {selectedImage && !processingResult && (
          <div className="flex gap-2">
            <Button
              onClick={processImage}
              disabled={isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ImageIcon className="h-4 w-4 mr-2" />
              )}
              {isProcessing ? 'Processing...' : 'Process Image'}
            </Button>
            
            <Button
              onClick={processReceipt}
              disabled={isProcessing}
              variant="outline"
              className="flex-1"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Process as Receipt
            </Button>
          </div>
        )}

        {/* Processing Results */}
        {processingResult && (
          <ProcessingResults result={processingResult} />
        )}

        {/* Usage Tips */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Supported Images:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Product photos - Extract product name, brand, category</li>
              <li>Receipts/Bills - Auto-update inventory from purchases</li>
              <li>Invoices - Process supplier deliveries</li>
              <li>Inventory lists - Bulk import current stock levels</li>
            </ul>
          </AlertDescription>
        </Alert>

      </CardContent>
    </Card>
  );
};

interface ProcessingResultsProps {
  result: ImageProcessingResult;
}

const ProcessingResults: React.FC<ProcessingResultsProps> = ({ result }) => {
  const { image_type, extracted_data } = result;

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-green-50">
      <div className="flex items-center gap-2">
        <CheckCircle className="h-5 w-5 text-green-600" />
        <h4 className="font-medium text-green-800">Processing Complete</h4>
      </div>

      {/* Image Type */}
      <div className="space-y-2">
        <h5 className="font-medium">Detected Type:</h5>
        <div className="flex gap-2">
          <Badge variant="default">
            {image_type.type.replace('_', ' ').toUpperCase()}
          </Badge>
          <Badge variant="outline">
            {Math.round(image_type.confidence * 100)}% confidence
          </Badge>
        </div>
      </div>

      {/* Extracted Data */}
      <div className="space-y-2">
        <h5 className="font-medium">Extracted Information:</h5>
        
        {/* Single Product Data */}
        {extracted_data.product_name && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><strong>Product:</strong> {extracted_data.product_name}</div>
            {extracted_data.brand && (
              <div><strong>Brand:</strong> {extracted_data.brand}</div>
            )}
            {extracted_data.category && (
              <div><strong>Category:</strong> {extracted_data.category}</div>
            )}
            {extracted_data.visible_quantity && (
              <div><strong>Quantity:</strong> {extracted_data.visible_quantity} {extracted_data.unit_type}</div>
            )}
            {extracted_data.price && (
              <div><strong>Price:</strong> ₹{extracted_data.price}</div>
            )}
          </div>
        )}

        {/* Multiple Items (Receipt/Invoice) */}
        {extracted_data.items && extracted_data.items.length > 0 && (
          <div className="space-y-2">
            <h6 className="font-medium">Items Found:</h6>
            <div className="max-h-32 overflow-y-auto">
              {extracted_data.items.map((item, index) => (
                <div key={index} className="flex justify-between text-sm p-2 bg-white rounded border">
                  <span>{item.product_name}</span>
                  <span>{item.quantity} {item.unit}</span>
                  {item.price && <span>₹{item.price}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confidence Score */}
        <div className="pt-2">
          <Badge 
            variant={extracted_data.confidence && extracted_data.confidence > 0.7 ? "default" : "destructive"}
          >
            Overall Confidence: {Math.round((extracted_data.confidence || 0) * 100)}%
          </Badge>
        </div>
      </div>
    </div>
  );
};