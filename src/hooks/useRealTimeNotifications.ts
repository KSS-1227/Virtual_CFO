import { useEffect, useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

interface Notification {
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  data?: any;
  timestamp: string;
}

export const useRealTimeNotifications = (userId?: string) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!userId) return;

    const connectSSE = () => {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const eventSource = new EventSource(`/api/notifications/stream`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      eventSource.onopen = () => {
        setIsConnected(true);
        console.log('SSE connected');
      };

      eventSource.onmessage = (event) => {
        try {
          const notification: Notification = JSON.parse(event.data);
          
          setNotifications(prev => [notification, ...prev.slice(0, 49)]); // Keep last 50
          
          // Show toast for important notifications
          if (notification.priority === 'high' || notification.priority === 'critical') {
            toast({
              title: notification.title,
              description: notification.message,
              variant: notification.priority === 'critical' ? 'destructive' : 'default',
              duration: notification.priority === 'critical' ? 10000 : 5000
            });
          }
        } catch (error) {
          console.error('Error parsing notification:', error);
        }
      };

      eventSource.addEventListener('connected', () => {
        setIsConnected(true);
      });

      eventSource.addEventListener('low_stock', (event) => {
        const data = JSON.parse(event.data);
        toast({
          title: "⚠️ Low Stock Alert",
          description: `${data.data.product_name} is running low (${data.data.current_stock} left)`,
          variant: "destructive",
          duration: 8000
        });
      });

      eventSource.addEventListener('stock_update', (event) => {
        const data = JSON.parse(event.data);
        // Subtle notification for stock updates
        console.log('Stock updated:', data);
      });

      eventSource.addEventListener('reorder_recommendation', (event) => {
        const data = JSON.parse(event.data);
        toast({
          title: "📦 Reorder Recommendations",
          description: `${data.data.length} items need reordering`,
          duration: 6000
        });
      });

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        setIsConnected(false);
        
        // Reconnect after 5 seconds
        setTimeout(() => {
          if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
            connectSSE();
          }
        }, 5000);
      };

      eventSourceRef.current = eventSource;
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        setIsConnected(false);
      }
    };
  }, [userId, toast]);

  const clearNotifications = () => {
    setNotifications([]);
  };

  const markAsRead = (index: number) => {
    setNotifications(prev => prev.filter((_, i) => i !== index));
  };

  return {
    notifications,
    isConnected,
    clearNotifications,
    markAsRead
  };
};