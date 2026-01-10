import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mic, MicOff, Volume2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VoiceCommand {
  action?: string;
  product_name?: string;
  quantity?: number;
  unit?: string;
  confidence?: number;
  needs_clarification?: boolean;
  clarifications_needed?: Array<{
    type: string;
    question: string;
    options?: string[];
    suggestions?: string[];
  }>;
}

interface VoiceInventoryInputProps {
  onCommandProcessed: (result: any) => void;
  onError: (error: string) => void;
}

export const VoiceInventoryInput: React.FC<VoiceInventoryInputProps> = ({
  onCommandProcessed,
  onError
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [voiceCommand, setVoiceCommand] = useState<VoiceCommand | null>(null);
  const [clarificationMode, setClarificationMode] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await processVoiceCommand(audioBlob);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      toast({
        title: "Recording started",
        description: "Speak your inventory command in Hindi or English",
      });

    } catch (error) {
      console.error('Error starting recording:', error);
      onError('Failed to start recording. Please check microphone permissions.');
    }
  }, [onError, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const processVoiceCommand = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'voice-command.wav');
      formData.append('preferred_language', 'mixed');

      const response = await fetch('/api/inventory/voice-command', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to process voice command');
      }

      setTranscription(result.voice_result?.transcription || '');
      setVoiceCommand(result.voice_result?.parsed_command || null);

      if (result.needs_clarification) {
        setClarificationMode(true);
      } else {
        // Command was processed successfully
        onCommandProcessed(result);
        
        // Play audio confirmation if available
        if (result.audio_confirmation) {
          setAudioUrl(result.audio_confirmation);
        }

        toast({
          title: "Voice command processed",
          description: `${result.execution_result?.operation} ${result.execution_result?.quantity} ${result.execution_result?.unit} of ${result.execution_result?.product_name}`,
        });
      }

    } catch (error) {
      console.error('Error processing voice command:', error);
      onError(error instanceof Error ? error.message : 'Failed to process voice command');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClarificationResponse = async (responses: Array<{ type: string; value: string }>) => {
    setIsProcessing(true);

    try {
      const response = await fetch('/api/inventory/voice-clarification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          original_command: voiceCommand,
          clarification_responses: responses
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to process clarification');
      }

      setClarificationMode(false);
      onCommandProcessed(result);

      toast({
        title: "Command clarified and processed",
        description: `${result.execution_result?.operation} ${result.execution_result?.quantity} ${result.execution_result?.unit} of ${result.execution_result?.product_name}`,
      });

    } catch (error) {
      console.error('Error processing clarification:', error);
      onError(error instanceof Error ? error.message : 'Failed to process clarification');
    } finally {
      setIsProcessing(false);
    }
  };

  const playAudioConfirmation = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch(console.error);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          Voice Inventory Commands
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Recording Controls */}
        <div className="flex items-center justify-center gap-4">
          <Button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            variant={isRecording ? "destructive" : "default"}
            size="lg"
            className="min-w-[120px]"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : isRecording ? (
              <MicOff className="h-4 w-4 mr-2" />
            ) : (
              <Mic className="h-4 w-4 mr-2" />
            )}
            {isProcessing ? 'Processing...' : isRecording ? 'Stop Recording' : 'Start Recording'}
          </Button>

          {audioUrl && (
            <Button
              onClick={playAudioConfirmation}
              variant="outline"
              size="sm"
            >
              <Volume2 className="h-4 w-4 mr-2" />
              Play Confirmation
            </Button>
          )}
        </div>

        {/* Recording Status */}
        {isRecording && (
          <Alert>
            <Mic className="h-4 w-4" />
            <AlertDescription>
              Recording... Speak your inventory command in Hindi or English.
              <br />
              <em>Examples: "Aaj 50 pieces bread aaye", "Maine 10 kg rice kharida"</em>
            </AlertDescription>
          </Alert>
        )}

        {/* Transcription Display */}
        {transcription && (
          <div className="space-y-2">
            <h4 className="font-medium">What you said:</h4>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">{transcription}</p>
            </div>
          </div>
        )}

        {/* Parsed Command Display */}
        {voiceCommand && !clarificationMode && (
          <div className="space-y-2">
            <h4 className="font-medium">Understood command:</h4>
            <div className="flex flex-wrap gap-2">
              {voiceCommand.action && (
                <Badge variant="default">Action: {voiceCommand.action}</Badge>
              )}
              {voiceCommand.product_name && (
                <Badge variant="secondary">Product: {voiceCommand.product_name}</Badge>
              )}
              {voiceCommand.quantity && (
                <Badge variant="outline">Quantity: {voiceCommand.quantity}</Badge>
              )}
              {voiceCommand.unit && (
                <Badge variant="outline">Unit: {voiceCommand.unit}</Badge>
              )}
              {voiceCommand.confidence && (
                <Badge variant={voiceCommand.confidence > 0.7 ? "default" : "destructive"}>
                  Confidence: {Math.round(voiceCommand.confidence * 100)}%
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Clarification Mode */}
        {clarificationMode && voiceCommand?.clarifications_needed && (
          <ClarificationDialog
            clarifications={voiceCommand.clarifications_needed}
            onRespond={handleClarificationResponse}
            onCancel={() => setClarificationMode(false)}
          />
        )}

        {/* Usage Tips */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Voice Command Examples:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>"Aaj 50 pieces bread aaye" (Today 50 pieces of bread came)</li>
            <li>"Maine 10 kg rice kharida" (I bought 10 kg rice)</li>
            <li>"25 packets biscuit sold kiye" (Sold 25 packets of biscuits)</li>
            <li>"Office ke liye 100 pens chahiye" (Need 100 pens for office)</li>
          </ul>
        </div>

      </CardContent>
    </Card>
  );
};

interface ClarificationDialogProps {
  clarifications: Array<{
    type: string;
    question: string;
    options?: string[];
    suggestions?: string[];
  }>;
  onRespond: (responses: Array<{ type: string; value: string }>) => void;
  onCancel: () => void;
}

const ClarificationDialog: React.FC<ClarificationDialogProps> = ({
  clarifications,
  onRespond,
  onCancel
}) => {
  const [responses, setResponses] = useState<Record<string, string>>({});

  const handleResponseChange = (type: string, value: string) => {
    setResponses(prev => ({ ...prev, [type]: value }));
  };

  const handleSubmit = () => {
    const responseArray = Object.entries(responses).map(([type, value]) => ({
      type,
      value
    }));
    onRespond(responseArray);
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-yellow-50">
      <h4 className="font-medium text-yellow-800">Need clarification:</h4>
      
      {clarifications.map((clarification, index) => (
        <div key={index} className="space-y-2">
          <p className="text-sm font-medium">{clarification.question}</p>
          
          {clarification.options && (
            <div className="flex flex-wrap gap-2">
              {clarification.options.map((option) => (
                <Button
                  key={option}
                  variant={responses[clarification.type] === option ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleResponseChange(clarification.type, option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          )}

          {clarification.suggestions && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Suggestions:</p>
              <div className="flex flex-wrap gap-1">
                {clarification.suggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => handleResponseChange(clarification.type, suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="flex gap-2 pt-2">
        <Button onClick={handleSubmit} size="sm">
          Submit Clarification
        </Button>
        <Button onClick={onCancel} variant="outline" size="sm">
          Cancel
        </Button>
      </div>
    </div>
  );
};