import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { 
  MessageSquare, 
  Plus, 
  Search, 
  MoreHorizontal, 
  Trash2, 
  Edit3,
  Calendar,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Conversation {
  id: string;
  conversation_id: string;
  title: string;
  last_message: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

interface ChatHistoryProps {
  currentConversationId?: string;
  onConversationSelect: (conversationId: string) => void;
  onNewChat: () => void;
  isOpen: boolean;
}

export function ChatHistory({ 
  currentConversationId, 
  onConversationSelect, 
  onNewChat,
  isOpen 
}: ChatHistoryProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen]);

  const loadConversations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('conversation_history')
        .select(`
          conversation_id,
          message_content,
          created_at
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const conversationMap = new Map<string, Conversation>();
      
      data?.forEach((msg) => {
        const convId = msg.conversation_id;
        if (!conversationMap.has(convId)) {
          conversationMap.set(convId, {
            id: convId,
            conversation_id: convId,
            title: generateTitle(msg.message_content),
            last_message: msg.message_content,
            created_at: msg.created_at,
            updated_at: msg.created_at,
            message_count: 1
          });
        } else {
          const conv = conversationMap.get(convId)!;
          conv.message_count++;
          if (new Date(msg.created_at) > new Date(conv.updated_at)) {
            conv.last_message = msg.message_content;
            conv.updated_at = msg.created_at;
          }
        }
      });

      const sortedConversations = Array.from(conversationMap.values())
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

      setConversations(sortedConversations);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateTitle = (message: string): string => {
    const words = message.trim().split(' ').slice(0, 6);
    return words.join(' ') + (words.length === 6 ? '...' : '');
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('conversation_history')
        .delete()
        .eq('user_id', user.id)
        .eq('conversation_id', conversationId);

      setConversations(prev => prev.filter(c => c.conversation_id !== conversationId));
      
      if (currentConversationId === conversationId) {
        onNewChat();
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const updateTitle = async (conversationId: string, newTitle: string) => {
    setConversations(prev => prev.map(c => 
      c.conversation_id === conversationId ? { ...c, title: newTitle } : c
    ));
    setEditingId(null);
  };

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.last_message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupConversationsByDate = (conversations: Conversation[]) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const groups = {
      today: [] as Conversation[],
      yesterday: [] as Conversation[],
      lastWeek: [] as Conversation[],
      older: [] as Conversation[]
    };

    conversations.forEach(conv => {
      const date = new Date(conv.updated_at);
      if (date.toDateString() === today.toDateString()) {
        groups.today.push(conv);
      } else if (date.toDateString() === yesterday.toDateString()) {
        groups.yesterday.push(conv);
      } else if (date > lastWeek) {
        groups.lastWeek.push(conv);
      } else {
        groups.older.push(conv);
      }
    });

    return groups;
  };

  const groups = groupConversationsByDate(filteredConversations);

  const ConversationItem = ({ conversation }: { conversation: Conversation }) => (
    <div
      className={cn(
        "group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:bg-gray-100 dark:hover:bg-gray-800",
        currentConversationId === conversation.conversation_id && "bg-gray-100 dark:bg-gray-800"
      )}
      onClick={() => onConversationSelect(conversation.conversation_id)}
    >
      <MessageSquare className="h-4 w-4 text-gray-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        {editingId === conversation.id ? (
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={() => updateTitle(conversation.conversation_id, editTitle)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                updateTitle(conversation.conversation_id, editTitle);
              } else if (e.key === 'Escape') {
                setEditingId(null);
              }
            }}
            className="h-6 text-sm"
            autoFocus
          />
        ) : (
          <>
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {conversation.title}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {conversation.last_message}
            </p>
          </>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setEditingId(conversation.id);
                setEditTitle(conversation.title);
              }}
            >
              <Edit3 className="h-3 w-3 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                deleteConversation(conversation.conversation_id);
              }}
              className="text-red-600 dark:text-red-400"
            >
              <Trash2 className="h-3 w-3 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  const GroupSection = ({ title, conversations, icon }: { 
    title: string; 
    conversations: Conversation[];
    icon: React.ReactNode;
  }) => {
    if (conversations.length === 0) return null;
    
    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {icon}
          {title}
        </div>
        <div className="space-y-1">
          {conversations.map((conversation) => (
            <ConversationItem key={conversation.id} conversation={conversation} />
          ))}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <Button
          onClick={onNewChat}
          className="w-full justify-start gap-2 mb-3 bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
            </div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs">Start a new chat to begin</p>
          </div>
        ) : (
          <div className="space-y-2">
            <GroupSection 
              title="Today" 
              conversations={groups.today} 
              icon={<Clock className="h-3 w-3" />}
            />
            <GroupSection 
              title="Yesterday" 
              conversations={groups.yesterday} 
              icon={<Calendar className="h-3 w-3" />}
            />
            <GroupSection 
              title="Last 7 days" 
              conversations={groups.lastWeek} 
              icon={<Calendar className="h-3 w-3" />}
            />
            <GroupSection 
              title="Older" 
              conversations={groups.older} 
              icon={<Calendar className="h-3 w-3" />}
            />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}