import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bell, BellRing, Package, AlertTriangle, TrendingUp, 
  X, Trash2, Wifi, WifiOff 
} from 'lucide-react';
import { useRealTimeNotifications } from '@/hooks/useRealTimeNotifications';

interface NotificationPanelProps {
  userId?: string;
  className?: string;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ 
  userId, 
  className = "" 
}) => {
  const { 
    notifications, 
    isConnected, 
    clearNotifications, 
    markAsRead 
  } = useRealTimeNotifications(userId);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'low_stock': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'stock_update': return <Package className="h-4 w-4 text-blue-500" />;
      case 'reorder_recommendation': return <TrendingUp className="h-4 w-4 text-orange-500" />;
      default: return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className={`w-full max-w-md ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            {notifications.length > 0 ? (
              <BellRing className="h-5 w-5" />
            ) : (
              <Bell className="h-5 w-5" />
            )}
            Notifications
            {notifications.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {notifications.length}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="h-4 w-4 text-green-500" title="Connected" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" title="Disconnected" />
            )}
            
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearNotifications}
                className="h-6 w-6 p-0"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-0">
        {notifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No new notifications</p>
            <p className="text-xs mt-1">
              {isConnected ? 'Connected and monitoring' : 'Connecting...'}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-64">
            <div className="space-y-3">
              {notifications.map((notification, index) => (
                <div
                  key={`${notification.timestamp}-${index}`}
                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm leading-tight">
                          {notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {notification.message}
                        </p>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsRead(index)}
                        className="h-6 w-6 p-0 flex-shrink-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between mt-2">
                      <Badge 
                        variant={getPriorityColor(notification.priority)}
                        className="text-xs"
                      >
                        {notification.priority}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(notification.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};