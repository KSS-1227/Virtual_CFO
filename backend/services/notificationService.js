const { EventEmitter } = require('events');

class NotificationService extends EventEmitter {
  constructor() {
    super();
    this.clients = new Map(); // userId -> Set of response objects
  }

  // Add client for SSE
  addClient(userId, res) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId).add(res);

    // Setup SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection confirmation
    this.sendToClient(res, 'connected', { timestamp: new Date().toISOString() });

    // Handle client disconnect
    res.on('close', () => {
      this.removeClient(userId, res);
    });
  }

  removeClient(userId, res) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      userClients.delete(res);
      if (userClients.size === 0) {
        this.clients.delete(userId);
      }
    }
  }

  sendToClient(res, event, data) {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      console.error('Error sending SSE:', error);
    }
  }

  // Send notification to specific user
  notifyUser(userId, notification) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      userClients.forEach(res => {
        this.sendToClient(res, notification.type, notification);
      });
    }
  }

  // Inventory-specific notifications
  notifyLowStock(userId, item) {
    this.notifyUser(userId, {
      type: 'low_stock',
      priority: 'high',
      title: 'Low Stock Alert',
      message: `${item.product_name} is running low (${item.current_stock} left)`,
      data: item,
      timestamp: new Date().toISOString()
    });
  }

  notifyStockUpdate(userId, item, operation) {
    this.notifyUser(userId, {
      type: 'stock_update',
      priority: 'medium',
      title: 'Stock Updated',
      message: `${item.product_name} stock ${operation}`,
      data: item,
      timestamp: new Date().toISOString()
    });
  }

  notifyReorderRecommendation(userId, recommendations) {
    this.notifyUser(userId, {
      type: 'reorder_recommendation',
      priority: 'medium',
      title: 'Reorder Recommendations',
      message: `${recommendations.length} items need reordering`,
      data: recommendations,
      timestamp: new Date().toISOString()
    });
  }

  // Broadcast to all connected clients
  broadcast(notification) {
    this.clients.forEach((userClients, userId) => {
      this.notifyUser(userId, notification);
    });
  }
}

// Singleton instance
const notificationService = new NotificationService();

module.exports = { notificationService };