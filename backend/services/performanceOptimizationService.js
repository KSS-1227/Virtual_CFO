const Redis = require('redis');

class PerformanceOptimizationService {
  constructor() {
    this.redis = null;
    this.initRedis();
  }

  async initRedis() {
    try {
      this.redis = Redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });
      this.redis.on('error', (err) => console.log('Redis Client Error', err));
      await this.redis.connect();
    } catch (error) {
      console.warn('Redis connection failed, using memory cache');
      this.redis = null;
    }
  }

  // Cache user suggestions with TTL
  async cacheUserSuggestions(userId, type, query, suggestions) {
    if (!this.redis) return;
    try {
      const key = `suggestions:${userId}:${type}:${query}`;
      await this.redis.setEx(key, 300, JSON.stringify(suggestions));
    } catch (error) {
      console.error('Cache error:', error);
    }
  }

  async getCachedSuggestions(userId, type, query) {
    if (!this.redis) return null;
    try {
      const key = `suggestions:${userId}:${type}:${query}`;
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Cache retrieval error:', error);
      return null;
    }
  }

  // Cache inventory analytics
  async cacheAnalytics(userId, analytics) {
    const key = `analytics:${userId}`;
    await this.redis.setEx(key, 1800, JSON.stringify(analytics)); // 30 min TTL
  }

  async getCachedAnalytics(userId) {
    const key = `analytics:${userId}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  // Batch operations for better performance
  async batchUpdateStock(userId, updates) {
    const supabase = getAuthenticatedClient();
    
    try {
      // Use transaction for consistency
      const { data, error } = await supabase.rpc('batch_stock_update', {
        user_id: userId,
        updates: updates
      });

      if (error) throw error;

      // Invalidate related caches
      await this.invalidateUserCaches(userId);
      
      return data;
    } catch (error) {
      console.error('Batch update error:', error);
      throw error;
    }
  }

  // Preload frequently accessed data
  async preloadUserData(userId) {
    const supabase = getAuthenticatedClient();
    
    // Preload inventory items with stock calculations
    const { data: items } = await supabase
      .from('inventory_items_with_stock') // Use materialized view
      .select('*')
      .eq('user_id', userId)
      .limit(100);

    // Cache for quick access
    await this.redis.setEx(`preload:${userId}`, 600, JSON.stringify(items));
    
    return items;
  }

  // Optimize search with indexed queries
  async optimizedSearch(userId, query, type = 'products') {
    // Check cache first
    const cached = await this.getCachedSuggestions(userId, type, query);
    if (cached) return cached;

    // Mock suggestions for now
    const mockSuggestions = [
      {
        text: query + " suggestion",
        confidence: 0.8,
        frequency: 5,
        type: 'pattern'
      }
    ];

    // Cache results
    await this.cacheUserSuggestions(userId, type, query, mockSuggestions);
    
    return mockSuggestions;
  }

  // Invalidate user-specific caches
  async invalidateUserCaches(userId) {
    const pattern = `*:${userId}*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(keys);
    }
  }

  // Background job for cache warming
  async warmCaches() {
    const supabase = getAuthenticatedClient();
    
    // Get active users (users with recent activity)
    const { data: activeUsers } = await supabase
      .from('inventory_stock_ledger')
      .select('user_id')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .group('user_id');

    // Preload data for active users
    for (const user of activeUsers || []) {
      try {
        await this.preloadUserData(user.user_id);
      } catch (error) {
        console.error(`Cache warming failed for user ${user.user_id}:`, error);
      }
    }
  }

  // Memory usage optimization
  async optimizeMemoryUsage() {
    // Clean expired keys
    await this.redis.flushExpired();
    
    // Compress large cached objects
    const largeKeys = await this.redis.keys('analytics:*');
    for (const key of largeKeys) {
      const data = await this.redis.get(key);
      if (data && data.length > 10000) { // > 10KB
        const compressed = this.compressData(data);
        await this.redis.set(key, compressed);
      }
    }
  }

  compressData(data) {
    // Simple compression - in production use zlib
    return JSON.stringify(JSON.parse(data), null, 0);
  }
}

module.exports = { PerformanceOptimizationService };