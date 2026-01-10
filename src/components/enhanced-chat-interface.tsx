import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { chatAPI, handleAPIError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  History, 
  Trash2, 
  Copy,
  ThumbsUp,
  ThumbsDown,
  Brain,
  Zap,
  TrendingUp,
  DollarSign,
  BarChart3,
  MessageCircle,
  Clock,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  conversationId?: string;
  metadata?: {
    tokenCount?: number;
    model?: string;
    contextUsed?: any;
    knowledgeUsed?: any;
  };
}

interface ConversationHistory {
  id: string;
  message_type: 'user' | 'ai';
  message_content: string;
  created_at: string;
  conversation_id: string;
  entities_extracted?: any;
  knowledge_used?: any;
}

export function EnhancedChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ConversationHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversation history on mount
  useEffect(() => {
    loadConversationHistory();
  }, []);

  const loadConversationHistory = async () => {
    try {
      const response = await chatAPI.getChatHistory();
      if (response.success) {
        setConversationHistory(response.data.history || []);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setIsStreaming(true);

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      // Create AI message placeholder
      const aiMessageId = (Date.now() + 1).toString();
      const aiMessage: Message = {
        id: aiMessageId,
        type: 'ai',
        content: '',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);

      let fullResponse = '';
      let metadata: any = {};

      // Use streaming API with Graph RAG
      await chatAPI.streamAIResponse(
        userMessage.content,
        (token) => {
          fullResponse += token.text;
          setMessages(prev => 
            prev.map(msg => 
              msg.id === aiMessageId 
                ? { ...msg, content: fullResponse }
                : msg
            )
          );
        },
        (meta) => {
          metadata = meta;
          setCurrentConversationId(meta.conversation_id);
          setMessages(prev => 
            prev.map(msg => 
              msg.id === aiMessageId 
                ? { ...msg, metadata: meta }
                : msg
            )
          );
        },
        (error) => {
          toast({
            title: "Error",
            description: error,
            variant: "destructive",
          });
        },
        abortControllerRef.current.signal
      );

      // Reload conversation history to include new messages
      await loadConversationHistory();

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = handleAPIError(error);
      
      toast({
        title: "Chat Error",
        description: errorMessage,
        variant: "destructive",
      });

      // Remove the placeholder AI message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const cancelStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setCurrentConversationId(null);
    toast({
      title: "Chat Cleared",
      description: "Conversation has been cleared.",
    });
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Copied",
      description: "Message copied to clipboard.",
    });
  };

  const loadHistoryConversation = (conversationId: string) => {
    const conversationMessages = conversationHistory
      .filter(msg => msg.conversation_id === conversationId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map(msg => ({
        id: `${msg.conversation_id}-${msg.message_type}-${msg.created_at}`,
        type: msg.message_type as 'user' | 'ai',
        content: msg.message_content,
        timestamp: new Date(msg.created_at),
        conversationId: msg.conversation_id,
        metadata: msg.knowledge_used || msg.entities_extracted,
      }));

    setMessages(conversationMessages);
    setCurrentConversationId(conversationId);
    setShowHistory(false);
  };

  // Get unique conversations from history
  const uniqueConversations = conversationHistory.reduce((acc, msg) => {
    if (!acc.find(conv => conv.conversation_id === msg.conversation_id)) {
      acc.push({
        conversation_id: msg.conversation_id,
        created_at: msg.created_at,
        preview: msg.message_content.substring(0, 50) + '...',
        message_count: conversationHistory.filter(m => m.conversation_id === msg.conversation_id).length
      });
    }
    return acc;
  }, [] as any[]).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="flex h-[600px] bg-background border rounded-lg overflow-hidden">
      {/* Chat History Sidebar */}
      {showHistory && (
        <div className="w-80 border-r bg-muted/30">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <History className="h-4 w-4" />
                Chat History
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(false)}
              >
                ×
              </Button>
            </div>
          </div>
          <ScrollArea className="h-[calc(600px-80px)]">
            <div className="p-2 space-y-2">
              {uniqueConversations.map((conv) => (
                <Card
                  key={conv.conversation_id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => loadHistoryConversation(conv.conversation_id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {conv.preview}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {conv.message_count} messages
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(conv.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {uniqueConversations.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No conversation history</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <Brain className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="font-semibold">AI CFO Assistant</h2>
                <p className="text-sm text-muted-foreground">
                  Powered by Graph RAG • {messages.length} messages
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-2"
              >
                <History className="h-4 w-4" />
                History
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearChat}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Brain className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Welcome to AI CFO Assistant</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  I'm your intelligent financial advisor powered by Graph RAG. Ask me about your business finances, get insights, and receive personalized recommendations.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                  {[
                    { icon: TrendingUp, text: "Analyze my cash flow trends", color: "text-green-600" },
                    { icon: DollarSign, text: "How can I reduce expenses?", color: "text-blue-600" },
                    { icon: BarChart3, text: "Show me profit margin insights", color: "text-purple-600" },
                    { icon: Zap, text: "Generate financial forecast", color: "text-orange-600" },
                  ].map((suggestion, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="h-auto p-3 text-left justify-start"
                      onClick={() => setInput(suggestion.text)}
                    >
                      <suggestion.icon className={cn("h-4 w-4 mr-2", suggestion.color)} />
                      <span className="text-sm">{suggestion.text}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3 max-w-4xl",
                  message.type === 'user' ? "ml-auto flex-row-reverse" : ""
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                  message.type === 'user' 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                )}>
                  {message.type === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>

                <div className={cn(
                  "flex-1 space-y-2",
                  message.type === 'user' ? "text-right" : ""
                )}>
                  <div className={cn(
                    "inline-block p-3 rounded-lg max-w-full",
                    message.type === 'user'
                      ? "bg-primary text-primary-foreground ml-auto"
                      : "bg-muted"
                  )}>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{message.timestamp.toLocaleTimeString()}</span>
                    
                    {message.metadata && (
                      <>
                        <Separator orientation="vertical" className="h-3" />
                        <div className="flex items-center gap-1">
                          <Brain className="h-3 w-3" />
                          <span>{message.metadata.model || 'GPT-4'}</span>
                        </div>
                        {message.metadata.tokenCount && (
                          <>
                            <Separator orientation="vertical" className="h-3" />
                            <span>{message.metadata.tokenCount} tokens</span>
                          </>
                        )}
                        {message.metadata.contextUsed?.knowledge_entities_used > 0 && (
                          <>
                            <Separator orientation="vertical" className="h-3" />
                            <Badge variant="outline" className="text-xs">
                              <Zap className="h-2 w-2 mr-1" />
                              Graph RAG
                            </Badge>
                          </>
                        )}
                      </>
                    )}

                    <div className="flex items-center gap-1 ml-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyMessage(message.content)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      {message.type === 'ai' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                          >
                            <ThumbsUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                          >
                            <ThumbsDown className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <div className="bg-muted p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">
                        {isStreaming ? "AI is thinking..." : "Processing your request..."}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div ref={messagesEndRef} />
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t bg-muted/30">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask your AI CFO anything about your business finances..."
                disabled={isLoading}
                className="pr-12"
              />
              {isStreaming && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-8 w-8 p-0"
                  onClick={cancelStreaming}
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                </Button>
              )}
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              className="px-6"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>Press Enter to send, Shift+Enter for new line</span>
              {currentConversationId && (
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span>Conversation saved</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Brain className="h-3 w-3" />
              <span>Powered by Graph RAG</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}