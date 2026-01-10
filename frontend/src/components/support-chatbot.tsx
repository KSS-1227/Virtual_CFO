import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  MessageCircle, 
  X, 
  Send, 
  Mic, 
  Volume2, 
  VolumeX, 
  MicOff,
  HelpCircle,
  User,
  Bot
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  text: string;
  type: "user" | "bot";
  timestamp: Date;
}

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

const VIRTUALCFO_CONTEXT = `
You are a helpful support assistant for VirtualCFO, an AI-powered financial intelligence platform for Indian small businesses.

VirtualCFO Features:
- Smart Dashboard with real-time business health monitoring
- Daily Earnings Tracker for income/expense logging
- AI CFO Assistant for 24/7 financial guidance
- Document Processing with OCR-powered receipt scanning
- Analytics & Insights with automated SWOT analysis
- Smart Notifications via WhatsApp & email
- GST Reports and compliant P&L statements
- Multi-language Support (Hindi & English)
- Progressive Web App with offline capability

Key Sections:
- Overview: Business health score and key metrics
- Daily Earnings: Record daily income and expenses
- AI Assistant: Virtual CFO chat for financial guidance
- Upload: Process financial documents with AI
- Advanced: Detailed analytics and forecasting
- Reports: Generate professional financial reports
- Insights: AI-generated business recommendations
- Business Trends: Market analysis and benchmarks
- Profile: Manage business information
- Contact: Support and assistance
- Settings: Account preferences and configurations

Answer questions about VirtualCFO features, navigation, and functionality. Be helpful, concise, and professional. Support both English and Hindi queries.
`;

export function SupportChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Hello! I'm your VirtualCFO support assistant. I can help you with questions about our platform features, navigation, and functionality. What would you like to know?",
      type: "bot",
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getAIResponse = async (userMessage: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: VIRTUALCFO_CONTEXT
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "I'm sorry, I couldn't process your request. Please try again.";
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      type: "user",
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);
    
    try {
      const aiResponse = await getAIResponse(inputText.trim());
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: aiResponse,
        type: "bot",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, botMessage]);
      
      if (speechEnabled) {
        const utterance = new SpeechSynthesisUtterance(aiResponse);
        utterance.lang = 'en-US';
        
        // Set female voice preference
        const voices = speechSynthesis.getVoices();
        const femaleVoice = voices.find(voice => 
          voice.lang.includes('en') && 
          (voice.name.toLowerCase().includes('female') || 
           voice.name.toLowerCase().includes('woman') ||
           voice.name.toLowerCase().includes('samantha') ||
           voice.name.toLowerCase().includes('karen') ||
           voice.name.toLowerCase().includes('susan') ||
           voice.name.toLowerCase().includes('victoria') ||
           voice.name.toLowerCase().includes('zira'))
        ) || voices.find(voice => voice.lang.includes('en') && voice.gender === 'female');
        
        if (femaleVoice) {
          utterance.voice = femaleVoice;
        }
        
        utterance.rate = 0.9;
        utterance.pitch = 1.1;
        speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm sorry, I'm having trouble connecting right now. Please try again later or contact our support team.",
        type: "bot",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Connection Error",
        description: "Unable to get AI response. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage();
  };

  const startListening = () => {
    if ('webkitSpeechRecognition' in window) {
      const SpeechRecognitionConstructor = (window as unknown as { webkitSpeechRecognition: new () => SpeechRecognition }).webkitSpeechRecognition;
      const recognition = new SpeechRecognitionConstructor();
      recognition.lang = 'en-US';
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
      };
      recognition.start();
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  if (!isOpen) {
    return (
      <Button
        onClick={toggleChat}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-80 h-96 shadow-lg z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground">
              <HelpCircle className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-sm">Support Assistant</h3>
            <p className="text-xs text-muted-foreground">VirtualCFO Help</p>
          </div>
        </div>
        <Button
          onClick={toggleChat}
          variant="ghost"
          size="icon"
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-2",
                message.type === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.type === "bot" && (
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                    <Bot className="h-3 w-3" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                  message.type === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {message.text}
              </div>
              {message.type === "user" && (
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    <User className="h-3 w-3" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-2 justify-start">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                  <Bot className="h-3 w-3" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      
      <div className="p-4 border-t">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex gap-1">
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={startListening}
              disabled={isListening || isLoading}
              title="Voice input"
              className="h-8 w-8"
            >
              {isListening ? <MicOff className="h-3 w-3 text-destructive" /> : <Mic className="h-3 w-3" />}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => setSpeechEnabled(!speechEnabled)}
              title="Toggle speech output"
              className="h-8 w-8"
            >
              {speechEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
            </Button>
          </div>
          
          <div className="flex-1 flex gap-2">
            <Input
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask about VirtualCFO features..."
              className="h-8 text-sm"
              disabled={isLoading}
            />
            <Button 
              type="submit" 
              size="icon" 
              className="h-8 w-8"
              disabled={!inputText.trim() || isLoading}
            >
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}