import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Volume2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { voiceAPI, voiceUtils } from '@/services/voiceAPI';
import { useToast } from '@/hooks/use-toast';

interface VoiceStatus {
  state: 'idle' | 'listening' | 'processing' | 'speaking' | 'success' | 'error';
  message: string;
  progress: number;
}

export function FloatingVoiceAssistant() {
  const [status, setStatus] = useState<VoiceStatus>({
    state: 'idle',
    message: 'Click to start voice command',
    progress: 0
  });
  const [lastResponse, setLastResponse] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();

  const updateStatus = (state: VoiceStatus['state'], message: string, progress: number = 0) => {
    setStatus({ state, message, progress });
  };

  const handleVoiceCommand = async () => {
    if (status.state !== 'idle') return;

    try {
      // Step 1: Start listening
      updateStatus('listening', 'Listening... Speak now!', 20);
      setIsExpanded(true);
      
      toast({
        title: "🎤 Listening",
        description: "Speak your command now (5 seconds)",
      });
      
      // Record audio for 5 seconds
      const audioBlob = await voiceUtils.recordAudio(5000);
      
      // Step 2: Processing audio
      updateStatus('processing', 'Converting speech to text...', 40);
      
      toast({
        title: "🔄 Processing",
        description: "Converting your voice to text...",
      });
      
      // Process audio to text
      const transcriptionResult = await voiceAPI.processAudio(audioBlob);
      const command = transcriptionResult.data.transcription;
      
      if (!command || command.trim().length === 0) {
        throw new Error('No speech detected. Please try again.');
      }
      
      // Step 3: Processing command
      updateStatus('processing', `Processing: "${command}"`, 60);
      
      toast({
        title: "🧠 Understanding",
        description: `Processing: "${command}"`,
      });
      
      // Process the command
      const commandResult = await voiceAPI.processCommand(command);
      
      // Step 4: Generating response
      updateStatus('processing', 'Generating AI response...', 80);
      
      const responseMessage = commandResult.data.message;
      setLastResponse(responseMessage);
      
      // Step 5: Speaking response
      updateStatus('speaking', 'Speaking response...', 90);
      
      toast({
        title: "🔊 Responding",
        description: "Playing AI response...",
      });
      
      // Generate and play speech response
      const speechBlob = await voiceAPI.generateSpeech(responseMessage, 'hi');
      await voiceUtils.playAudio(speechBlob);
      
      // Step 6: Success
      updateStatus('success', 'Command completed successfully!', 100);
      
      toast({
        title: "✅ Success",
        description: commandResult.data.action ? 
          `Action completed: ${commandResult.data.action}` : 
          "Command processed successfully",
      });
      
      // Reset after 3 seconds
      setTimeout(() => {
        updateStatus('idle', 'Click to start voice command', 0);
        setIsExpanded(false);
      }, 3000);
      
    } catch (error) {
      console.error('Voice command error:', error);
      
      updateStatus('error', error.message || 'Something went wrong', 0);
      
      toast({
        title: "❌ Error",
        description: error.message || 'Failed to process voice command',
        variant: "destructive"
      });
      
      // Reset after 3 seconds
      setTimeout(() => {
        updateStatus('idle', 'Click to start voice command', 0);
        setIsExpanded(false);
      }, 3000);
    }
  };

  const getButtonStyle = () => {
    switch (status.state) {
      case 'listening':
        return 'bg-red-500 hover:bg-red-600 animate-pulse';
      case 'processing':
        return 'bg-blue-500 hover:bg-blue-600';
      case 'speaking':
        return 'bg-green-500 hover:bg-green-600 animate-bounce';
      case 'success':
        return 'bg-green-600 hover:bg-green-700';
      case 'error':
        return 'bg-red-600 hover:bg-red-700';
      default:
        return 'bg-primary hover:bg-primary/90';
    }
  };

  const getIcon = () => {
    switch (status.state) {
      case 'listening':
        return <Mic className="h-6 w-6 animate-pulse" />;
      case 'processing':
        return <Loader2 className="h-6 w-6 animate-spin" />;
      case 'speaking':
        return <Volume2 className="h-6 w-6" />;
      case 'success':
        return <CheckCircle className="h-6 w-6" />;
      case 'error':
        return <AlertCircle className="h-6 w-6" />;
      default:
        return <Mic className="h-6 w-6" />;
    }
  };

  return (
    <div className="fixed bottom-20 left-4 z-50">
      {/* Main Voice Button */}
      <div className="relative">
        <Button
          onClick={handleVoiceCommand}
          disabled={status.state !== 'idle'}
          className={`w-16 h-16 rounded-full shadow-lg transition-all duration-300 ${getButtonStyle()}`}
        >
          {getIcon()}
        </Button>
        
        {/* Status Badge */}
        <Badge 
          className={`absolute -top-2 -right-2 text-xs ${
            status.state === 'success' ? 'bg-green-500' :
            status.state === 'error' ? 'bg-red-500' :
            status.state === 'idle' ? 'bg-gray-500' : 'bg-blue-500'
          }`}
        >
          {status.state === 'idle' ? '💤' :
           status.state === 'listening' ? '🎤' :
           status.state === 'processing' ? '🔄' :
           status.state === 'speaking' ? '🔊' :
           status.state === 'success' ? '✅' : '❌'}
        </Badge>
      </div>
      
      {/* Status Panel */}
      {(isExpanded || status.state !== 'idle') && (
        <Card className="absolute bottom-20 left-0 w-80 p-4 shadow-xl animate-slide-up">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Voice Assistant</h3>
              <Badge variant="outline" className="text-xs">
                {status.state.toUpperCase()}
              </Badge>
            </div>
            
            {/* Progress Bar */}
            {status.progress > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${
                    status.state === 'success' ? 'bg-green-500' :
                    status.state === 'error' ? 'bg-red-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${status.progress}%` }}
                />
              </div>
            )}
            
            {/* Status Message */}
            <p className={`text-sm ${
              status.state === 'success' ? 'text-green-600' :
              status.state === 'error' ? 'text-red-600' :
              status.state === 'listening' ? 'text-red-600 font-medium' :
              'text-gray-600'
            }`}>
              {status.message}
            </p>
            
            {/* Last Response */}
            {lastResponse && status.state === 'success' && (
              <div className="mt-3 p-2 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs text-green-800 font-medium">AI Response:</p>
                <p className="text-sm text-green-700 mt-1">{lastResponse}</p>
              </div>
            )}
            
            {/* Instructions */}
            {status.state === 'idle' && (
              <div className="text-xs text-gray-500 space-y-1">
                <p>💡 <strong>Try saying:</strong></p>
                <p>• "Add expense of 500 rupees"</p>
                <p>• "Maine 1000 rupaye kharcha kiya"</p>
                <p>• "Show my profit margin"</p>
              </div>
            )}
            
            {/* Listening Instructions */}
            {status.state === 'listening' && (
              <div className="text-xs text-red-600 font-medium animate-pulse">
                🎤 Speak clearly into your microphone now!
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}