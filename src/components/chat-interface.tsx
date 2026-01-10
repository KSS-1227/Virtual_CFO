import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatBubble } from "@/components/ui/chat-bubble";
import { Send, Mic, Globe, Volume2, VolumeX, MicOff, Square, Zap, TrendingUp, Target, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { chatAPI, handleAPIError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { SafeStorage } from "@/lib/storage";

interface Message {
  id: string;
  text: string;
  type: "user" | "ai";
  timestamp: string;
  actions?: string[];
  knowledgeContext?: {
    entities_extracted?: number;
    knowledge_retrieved?: number;
    relationships_found?: number;
    conversation_id?: string;
  };
  isStreaming?: boolean;
  tokenCount?: number;
}

// Remove the empty interface since it's not needed
// Autopilot-style quick suggestions that blend finance + market + scenarios
const quickSuggestions = [
  { text: "Check my cash flow and profit health", icon: "💰" },
  { text: "Where can I cut costs this month?", icon: "✂️" },
  { text: "Sales dropped 20% – what happens to my cash flow?", icon: "📉" },
  { text: "Should I expand to a new location?", icon: "📍" },
  { text: "Festival season is coming – how should I prepare?", icon: "🎉" },
  { text: "Optimize my pricing versus competitors", icon: "⚖️" }
];

const sampleMessages: Message[] = [
  {
    id: "1",
    text: "Namaste! I'm your AI CFO. I've analyzed your recent transactions. How can I help you today?",
    type: "ai",
    timestamp: "10:30 AM"
  }
];

export function ChatInterface() {
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Namaste! I'm your AI CFO. I've analyzed your recent transactions. How can I help you today?",
      type: "ai",
      timestamp: "10:30 AM"
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-scroll during streaming
  useEffect(() => {
    if (isStreaming) {
      const interval = setInterval(scrollToBottom, 100);
      return () => clearInterval(interval);
    }
  }, [isStreaming]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      type: "user",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setIsStreaming(true);

    // Create AI message placeholder
    const aiMessageId = (Date.now() + 1).toString();
    const aiMessage: Message = {
      id: aiMessageId,
      text: "",
      type: "ai",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isStreaming: true,
      tokenCount: 0
    };

    setMessages(prev => [...prev, aiMessage]);

    // Create abort controller for cancellation
    const controller = new AbortController();
    setAbortController(controller);

    try {
      await chatAPI.streamAIResponse(
        text.trim(),
        // onToken callback
        (tokenData) => {
          setMessages(prev => prev.map(msg => 
            msg.id === aiMessageId 
              ? { ...msg, text: msg.text + tokenData.text, tokenCount: tokenData.tokenCount }
              : msg
          ));
        },
        // onMeta callback
        (metaData) => {
          setMessages(prev => prev.map(msg => 
            msg.id === aiMessageId 
              ? { 
                  ...msg, 
                  isStreaming: false,
                  knowledgeContext: {
                    ...metaData.contextUsed,
                    totalTokens: metaData.totalTokens
                  }
                }
              : msg
          ));
          
          // Text-to-speech for completed response
          if (speechEnabled) {
            const finalMessage = messages.find(m => m.id === aiMessageId);
            if (finalMessage?.text) {
              const cleanText = finalMessage.text.replace(/[^\w\s.,!?;:()-]/g, '');
              const utterance = new SpeechSynthesisUtterance(cleanText);
              utterance.lang = language === 'hi' ? 'hi-IN' : 'en-US';
              utterance.rate = 0.9;
              utterance.pitch = 1.1;
              speechSynthesis.speak(utterance);
            }
          }
        },
        // onError callback
        (error) => {
          setMessages(prev => prev.map(msg => 
            msg.id === aiMessageId 
              ? { ...msg, text: `Error: ${error}`, isStreaming: false }
              : msg
          ));
          
          toast({
            title: "Streaming Error",
            description: error,
            variant: "destructive"
          });
        },
        // AbortSignal
        controller.signal
      );

    } catch (error) {
      console.error('Streaming error:', error);
      
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
          ? { 
              ...msg, 
              text: "Sorry, I'm having trouble connecting. Please try again.", 
              isStreaming: false 
            }
          : msg
      ));
      
      toast({
        title: "Connection Error",
        description: handleAPIError(error),
        variant: "destructive"
      });
    } finally {
      setIsStreaming(false);
      setAbortController(null);
    }
  };

  const handleStopStreaming = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsStreaming(false);
      
      // Update the streaming message to show it was cancelled
      setMessages(prev => prev.map(msg => 
        msg.isStreaming 
          ? { ...msg, text: msg.text + " [Cancelled]", isStreaming: false }
          : msg
      ));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputText);
  };

  const startListening = () => {
    // Type definitions for SpeechRecognition
    interface SpeechRecognitionEvent extends Event {
      results: {
        [key: number]: {
          [key: number]: {
            transcript: string;
          };
        };
      };
    }

    interface SpeechRecognition extends EventTarget {
      lang: string;
      onstart: (() => void) | null;
      onend: (() => void) | null;
      onresult: ((event: SpeechRecognitionEvent) => void) | null;
      start: () => void;
    }

    if ('webkitSpeechRecognition' in window) {
      const SpeechRecognitionConstructor = (window as unknown as { webkitSpeechRecognition: new () => SpeechRecognition }).webkitSpeechRecognition;
      const recognition = new SpeechRecognitionConstructor();
      recognition.lang = language === 'hi' ? 'hi-IN' : 'en-US';
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
      };
      recognition.start();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-background via-background to-muted/30 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gradient-to-r from-primary/5 to-primary/10 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold text-sm text-foreground">AI CFO Autopilot</h2>
            <p className="text-xs text-muted-foreground">Cash flow, market context & what-if scenarios in one assistant</p>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
        {messages.map((message) => (
          <ChatBubble
            key={message.id}
            message={message.text}
            type={message.type}
            timestamp={message.timestamp}
            actions={message.actions}
            knowledgeContext={message.knowledgeContext}
          />
        ))}
        
        {isTyping && (
          <ChatBubble
            message=""
            type="ai"
            isTyping={true}
          />
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestions - Enhanced */}
      {messages.length <= 1 && (
        <div className="px-4 py-3 border-t bg-gradient-to-r from-muted/50 to-muted/30">
          <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Zap className="h-3.5 w-3.5" />
            Quick Questions
          </p>
          <div className="grid grid-cols-2 gap-2">
            {quickSuggestions.map((suggestion) => (
              <Button
                key={suggestion.text}
                variant="outline"
                size="sm"
                className="text-xs h-10 justify-start px-3 hover:bg-primary/10 hover:border-primary/40 transition-all"
                onClick={() => handleSuggestionClick(suggestion.text)}
              >
                <span className="mr-2">{suggestion.icon}</span>
                <span className="text-left line-clamp-2">{suggestion.text}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area - Enhanced */}
      <div className="p-4 border-t bg-gradient-to-t from-primary/5 to-background backdrop-blur-sm">
        {isStreaming && (
          <div className="mb-3 flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }} />
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }} />
              </div>
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">AI is analyzing your query...</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleStopStreaming}
              className="h-7 text-xs"
            >
              <Square className="h-3 w-3 mr-1" />
              Stop
            </Button>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
              title={`Switch to ${language === 'en' ? 'Hindi' : 'English'}`}
              className="h-10 w-10 flex-shrink-0 hover:bg-primary/10"
            >
              <Globe className="h-4 w-4" />
            </Button>
            <Badge variant="outline" className="text-xs px-2 py-1 my-auto font-semibold">
              {language === 'en' ? '🇬🇧 EN' : '🇮🇳 हिं'}
            </Badge>
          </div>
          
          <div className="flex-1 flex gap-2">
            <Input
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={language === 'en' ? "Ask about finances or markets..." : "वित्त या बाजार के बारे में पूछें..."}
              className="flex-1 h-10 rounded-lg border-primary/30 focus:border-primary"
              disabled={isTyping || isStreaming}
            />
            <Button 
              type="button" 
              size="icon" 
              variant="ghost"
              className="h-10 w-10 flex-shrink-0 hover:bg-orange-100 dark:hover:bg-orange-950"
              onClick={startListening}
              disabled={isListening}
              title="Voice input"
            >
              {isListening ? <MicOff className="h-4 w-4 text-red-500" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setSpeechEnabled(!speechEnabled)}
              title="Toggle speech output"
              className="h-10 w-10 flex-shrink-0 hover:bg-green-100 dark:hover:bg-green-950"
            >
              {speechEnabled ? <Volume2 className="h-4 w-4 text-green-600" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <Button 
              type="submit" 
              size="icon" 
              className="h-10 w-10 flex-shrink-0 bg-primary hover:bg-primary/90"
              disabled={!inputText.trim() || isTyping || isStreaming}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
        
        <p className="text-xs text-muted-foreground mt-2 px-2">💡 Get comprehensive financial + market insights in every response</p>
      </div>
    </div>
  );
}