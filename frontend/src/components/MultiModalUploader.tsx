import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { multiModalAPI, mediaUtils } from '@/services/multiModalAPI';
import { 
  Camera, 
  Mic, 
  Upload, 
  Eye, 
  CheckCircle, 
  AlertCircle,
  Play,
  Square,
  Image as ImageIcon,
  FileText,
  Zap
} from 'lucide-react';

interface ExtractedData {
  amount: number;
  date: string;
  vendor: string;
  category: string;
  confidence: string;
  auto_saved: boolean;
}

// Image quality validation before processing
const validateImageQuality = async (base64: string): Promise<{score: number, reason: string}> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      let brightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        brightness += (data[i] + data[i+1] + data[i+2]) / 3;
      }
      brightness /= (data.length / 4);
      
      // Brightness between 80-180 is ideal
      const score = brightness > 80 && brightness < 180 ? 1 : 0.4;
      const reason = brightness < 80 ? "too dark" : brightness > 180 ? "too bright" : "unclear";
      
      resolve({ score, reason });
    };
    img.src = `data:image/jpeg;base64,${base64}`;
  });
};

const MultiModalUploader = () => {
  const [activeTab, setActiveTab] = useState('camera');
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceResult, setVoiceResult] = useState<any>(null);
  const [cameraTimeout, setCameraTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Camera functionality with auto-stop
  const startCamera = async () => {
    try {
      const stream = await mediaUtils.startCamera();
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // Auto-stop camera after 2 minutes to save battery
      const timeoutId = setTimeout(() => {
        stopCamera();
        alert("Camera auto-stopped after 2 minutes to save battery");
      }, 2 * 60 * 1000);
      setCameraTimeout(timeoutId);
    } catch (error) {
      console.error('Camera error:', error);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (cameraTimeout) {
      clearTimeout(cameraTimeout);
      setCameraTimeout(null);
    }
  };

  const captureReceipt = async () => {
    if (!videoRef.current) return;
    
    setIsProcessing(true);
    try {
      const imageBase64 = mediaUtils.captureImageFromVideo(videoRef.current);
      
      // CRITICAL FIX: Check image quality before processing
      const quality = await validateImageQuality(imageBase64);
      if (quality.score < 0.6) {
        alert(`Image ${quality.reason}. Please retake for better results.`);
        setIsProcessing(false);
        return;
      }
      
      const result = await multiModalAPI.processReceiptFromCamera(imageBase64);
      
      if (result.success) {
        setExtractedData(result.data.extracted_data);
      }
    } catch (error) {
      console.error('Receipt processing error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Voice functionality with timeout
  const startVoiceRecording = async () => {
    try {
      const stream = await mediaUtils.startMicrophone();
      setIsRecording(true);
      
      // Limit recording to 15 seconds max
      const MAX_RECORDING_TIME = 15000;
      const audioBlob = await mediaUtils.recordAudio(stream, MAX_RECORDING_TIME);
      setIsRecording(false);
      
      setIsProcessing(true);
      const result = await multiModalAPI.processVoiceCommand(audioBlob);
      
      if (result.success) {
        setVoiceResult(result.data);
        
        // Play voice response if available
        if (result.data.response_text) {
          const audioResponse = await multiModalAPI.generateVoiceResponse(
            result.data.response_text, 
            result.data.language_detected === 'hindi' ? 'hi' : 'en'
          );
          await mediaUtils.playAudioResponse(audioResponse);
        }
      }
    } catch (error) {
      console.error('Voice processing error:', error);
      setIsRecording(false);
    } finally {
      setIsProcessing(false);
    }
  };

  // File upload functionality
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      if (file.type.startsWith('image/')) {
        const result = await multiModalAPI.processReceiptImage(file);
        if (result.success) {
          setExtractedData(result.data.extracted_data);
        }
      }
    } catch (error: any) {
      console.error('File processing error:', error);
      if (error.message?.includes('Please log in')) {
        alert('Please log in to your account first to use AI features.');
      } else if (error.message?.includes('Failed to fetch')) {
        alert('Unable to connect to server. Please check if you are logged in and try again.');
      } else {
        alert('Error processing file: ' + error.message);
      }
    } finally {
      setIsProcessing(false);
    }
  };



  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
          <Zap className="h-8 w-8 text-blue-600" />
          Multi-Modal AI Assistant
        </h1>
        <p className="text-gray-600">
          Take photos, speak commands, or upload files - AI handles everything instantly
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="camera" className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Camera
          </TabsTrigger>
          <TabsTrigger value="voice" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Voice
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
        </TabsList>

        {/* Camera Tab */}
        <TabsContent value="camera" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Receipt Camera
              </CardTitle>
              <CardDescription>
                Point your camera at any receipt - AI will extract all financial data instantly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full max-w-md mx-auto rounded-lg border"
                  style={{ display: activeTab === 'camera' ? 'block' : 'none' }}
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>
              
              <div className="flex gap-4 justify-center">
                <Button onClick={startCamera} variant="outline">
                  Start Camera
                </Button>
                <Button 
                  onClick={captureReceipt} 
                  disabled={isProcessing}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isProcessing ? 'Processing...' : 'Capture Receipt'}
                </Button>
                <Button onClick={stopCamera} variant="outline">
                  Stop Camera
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Voice Tab */}
        <TabsContent value="voice" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                Voice Commands
              </CardTitle>
              <CardDescription>
                Speak naturally in Hindi or English - "Maine aaj 2500 rupaye kharcha kiya"
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className={`w-32 h-32 mx-auto rounded-full border-4 flex items-center justify-center ${
                  isRecording ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-gray-50'
                }`}>
                  {isRecording ? (
                    <Square className="h-8 w-8 text-red-500" />
                  ) : (
                    <Mic className="h-8 w-8 text-gray-500" />
                  )}
                </div>
                
                <Button 
                  onClick={startVoiceRecording}
                  disabled={isProcessing || isRecording}
                  className="mt-4"
                  size="lg"
                >
                  {isRecording ? 'Recording... (10s)' : isProcessing ? 'Processing...' : 'Start Voice Command'}
                </Button>
              </div>

              {voiceResult && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Understood:</strong> {voiceResult.transcription}<br/>
                    <strong>Action:</strong> {voiceResult.command_result.description}<br/>
                    <strong>Language:</strong> {voiceResult.language_detected}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                File Upload
              </CardTitle>
              <CardDescription>
                Upload receipts, invoices, or any financial documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <ImageIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-4">Drop files here or click to upload</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <Button asChild>
                  <label htmlFor="file-upload" className="cursor-pointer">
                    Choose Files
                  </label>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


      </Tabs>

      {/* Results Display */}
      {extractedData && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Receipt Processed Successfully
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-green-100">
                {extractedData.confidence} confidence
              </Badge>
              {extractedData.auto_saved && (
                <Badge className="bg-green-600">
                  Auto-saved to earnings
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="font-medium">Amount</p>
                <p className="text-gray-600">₹{extractedData.amount}</p>
              </div>
              <div>
                <p className="font-medium">Date</p>
                <p className="text-gray-600">{extractedData.date}</p>
              </div>
              <div>
                <p className="font-medium">Vendor</p>
                <p className="text-gray-600">{extractedData.vendor}</p>
              </div>
              <div>
                <p className="font-medium">Category</p>
                <p className="text-gray-600">{extractedData.category}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Multi-Modal AI Features:</strong> This system uses GPT-4 Vision for image analysis, 
          Whisper for voice recognition, and supports Hindi/English commands for maximum accessibility.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default MultiModalUploader;