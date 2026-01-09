import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { User, Bot, CheckCircle2, TrendingUp, Lightbulb, Target, Zap } from "lucide-react";

interface ChatBubbleProps {
  message: string;
  type: "user" | "ai";
  timestamp?: string;
  className?: string;
  isTyping?: boolean;
  actions?: string[];
  knowledgeContext?: {
    entities_extracted?: number;
    knowledge_retrieved?: number;
    relationships_found?: number;
  };
}

// Enhanced function to format text with markdown-like styling
const formatMessage = (text: string): JSX.Element[] => {
  if (!text) return [<span key="empty"></span>];
  
  const lines = text.split('\n');
  const elements: JSX.Element[] = [];
  let listItems: string[] = [];
  
  const flushListItems = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="space-y-1.5 my-2 list-none">
          {listItems.map((item, idx) => (
            <li key={idx} className="flex gap-2 ml-2">
              <span className="text-primary mt-0.5">▸</span>
              <span className="text-sm">{item.replace(/^[•🔹⚡\-\d+\.\s]+/, '').trim()}</span>
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };
  
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    
    // Skip markdown underlines
    if (trimmedLine.match(/^[=\-]{3,}$/)) {
      return;
    }
    
    // Section headers with underline
    if (trimmedLine && lines[index + 1]?.match(/^={3,}$/)) {
      flushListItems();
      elements.push(
        <h3 key={index} className="font-bold text-base mt-3 mb-2 text-primary flex items-center gap-2">
          <Zap className="h-4 w-4" />
          {trimmedLine}
        </h3>
      );
      return;
    }
    
    // Subsection headers
    if (trimmedLine && lines[index + 1]?.match(/^-{3,}$/)) {
      flushListItems();
      elements.push(
        <h4 key={index} className="font-semibold text-sm mt-2 mb-1.5 text-primary/90 flex items-center gap-2">
          <Lightbulb className="h-3.5 w-3.5" />
          {trimmedLine}
        </h4>
      );
      return;
    }
    
    // Numbered headers (e.g., "1. Quick Answer")
    if (trimmedLine.match(/^\d+\.\s+[A-Z]/)) {
      flushListItems();
      const number = trimmedLine.match(/^\d+/)?.[0];
      const text = trimmedLine.replace(/^\d+\.\s+/, '');
      const headerIcons: { [key: string]: any } = {
        '1': <Zap className="h-4 w-4" />,
        '2': <TrendingUp className="h-4 w-4" />,
        '3': <Target className="h-4 w-4" />,
        '4': <Lightbulb className="h-4 w-4" />,
        '5': <CheckCircle2 className="h-4 w-4" />
      };
      
      elements.push(
        <h4 key={index} className="font-semibold text-sm mt-2.5 mb-1.5 text-primary flex items-center gap-2">
          {headerIcons[number] || <span className="font-bold text-primary">{number}</span>}
          {text}
        </h4>
      );
      return;
    }
    
    // Emoji section headers
    const emojiHeaders = ['🤖', '💼', '🧠', '❓', '🎯', '📊', '💡', '🔍', '💰', '💸', '📍', '🏢', '📋', '📈', '🚀', '⚡'];
    if (emojiHeaders.some(emoji => trimmedLine.startsWith(emoji))) {
      flushListItems();
      elements.push(
        <h4 key={index} className="font-semibold text-sm mt-2.5 mb-1.5 flex items-center gap-2 text-foreground">
          {trimmedLine}
        </h4>
      );
      return;
    }
    
    // Bullet points and list items
    if (trimmedLine.match(/^[•🔹⚡\-\d+\.]/)) {
      listItems.push(trimmedLine);
      return;
    }
    
    // Regular text with formatting
    if (trimmedLine !== '') {
      flushListItems();
      elements.push(
        <p key={index} className="mb-1.5 text-sm leading-relaxed">
          {trimmedLine}
        </p>
      );
    } else {
      // Empty line
      flushListItems();
      elements.push(<div key={index} className="h-2" />);
    }
  });
  
  flushListItems();
  return elements;
};

export function ChatBubble({ 
  message, 
  type, 
  timestamp, 
  className,
  isTyping = false,
  actions,
  knowledgeContext
}: ChatBubbleProps) {
  const isUser = type === "user";
  
  return (
    <div className={cn(
      "flex gap-3 max-w-[85%] animate-slide-up",
      isUser ? "ml-auto flex-row-reverse" : "mr-auto",
      className
    )}>
      <Avatar className="h-8 w-8 flex-shrink-0 ring-2 ring-offset-2" style={{
        ringColor: isUser ? "hsl(var(--primary))" : "hsl(var(--muted))"
      }}>
        <AvatarFallback className={cn(
          "text-xs font-bold",
          isUser 
            ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground" 
            : "bg-gradient-to-br from-blue-500 to-blue-600 text-white"
        )}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      
      <div className={cn(
        "flex flex-col gap-1.5",
        isUser ? "items-end" : "items-start"
      )}>
        <div className={cn(
          "rounded-2xl px-4 py-3 max-w-full break-words shadow-sm transition-all",
          isUser 
            ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-none" 
            : "bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 text-foreground border border-slate-200 dark:border-slate-700 rounded-bl-none",
          isTyping && "chat-typing"
        )}>
          {isTyping ? (
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-2.5 h-2.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-2.5 h-2.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          ) : (
            <div className="text-sm leading-relaxed whitespace-pre-wrap space-y-1">
              {formatMessage(message)}
            </div>
          )}
        </div>
        
        {timestamp && !isTyping && (
          <span className="text-xs text-muted-foreground px-2">
            {timestamp}
          </span>
        )}
        
        {/* Knowledge Context Indicator for AI messages */}
        {type === "ai" && knowledgeContext && (
          <div className="text-xs flex items-center gap-2 flex-wrap mt-1 px-1">
            {knowledgeContext.entities_extracted > 0 && (
              <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {knowledgeContext.entities_extracted} concepts
              </span>
            )}
            {knowledgeContext.knowledge_retrieved > 0 && (
              <span className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {knowledgeContext.knowledge_retrieved} insights
              </span>
            )}
            {knowledgeContext.relationships_found > 0 && (
              <span className="bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                <Target className="h-3 w-3" />
                {knowledgeContext.relationships_found} connections
              </span>
            )}
          </div>
        )}
        
        {/* Action Buttons for AI messages */}
        {type === 'ai' && actions && actions.length > 0 && !isTyping && (
          <div className="flex flex-wrap gap-2 mt-2">
            {actions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="text-xs h-8 hover:bg-primary/10 hover:border-primary/40"
                onClick={() => {
                  // Handle action click - could trigger new messages or functions
                  console.log(`Action clicked: ${action}`);
                }}
              >
                {action}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}