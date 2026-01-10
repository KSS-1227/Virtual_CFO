/**
 * Client-Side Rate Limiter Service
 * Provides rate limiting functionality to prevent API abuse
 */

export interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: Date;
  retryAfter?: number;
}

export interface RateLimitConfig {
  requests: number;
  window: number; // in milliseconds
}

export interface RequestRecord {
  timestamp: number;
  userId: string;
  action: string;
}

export class ClientSideRateLimiter {
  private requests = new Map<string, RequestRecord[]>();
  private readonly limits: Record<string, RateLimitConfig> = {
    upload: { requests: 10, window: 60000 }, // 10 uploads per minute
    process: { requests: 20, window: 60000 }, // 20 processing requests per minute
    download: { requests: 50, window: 60000 }, // 50 downloads per minute
    api: { requests: 100, window: 60000 } // 100 general API calls per minute
  };

  /**
   * Checks if a request is allowed under current rate limits
   */
  async checkLimit(userId: string, action: string): Promise<RateLimitResult> {
    const limit = this.limits[action];
    if (!limit) {
      // If no limit is configured for this action, allow it
      return { 
        allowed: true, 
        remainingRequests: Infinity, 
        resetTime: new Date(Date.now() + 60000) 
      };
    }

    const key = `${userId}:${action}`;
    const userRequests = this.requests.get(key) || [];
    const now = Date.now();
    const windowStart = now - limit.window;
    
    // Clean old requests outside the current window
    const recentRequests = userRequests.filter(req => req.timestamp > windowStart);
    this.requests.set(key, recentRequests);
    
    const allowed = recentRequests.length < limit.requests;
    const remainingRequests = Math.max(0, limit.requests - recentRequests.length);
    const resetTime = new Date(now + limit.window);
    
    let retryAfter: number | undefined;
    if (!allowed && recentRequests.length > 0) {
      // Calculate when the oldest request in the window will expire
      const oldestRequest = recentRequests[0];
      retryAfter = Math.ceil((oldestRequest.timestamp + limit.window - now) / 1000);
    }
    
    return {
      allowed,
      remainingRequests,
      resetTime,
      retryAfter
    };
  }

  /**
   * Records a request for rate limiting tracking
   */
  async recordRequest(userId: string, action: string): Promise<void> {
    const key = `${userId}:${action}`;
    const userRequests = this.requests.get(key) || [];
    
    const requestRecord: RequestRecord = {
      timestamp: Date.now(),
      userId,
      action
    };
    
    userRequests.push(requestRecord);
    this.requests.set(key, userRequests);
    
    // Clean up old requests to prevent memory leaks
    this.cleanupOldRequests();
  }

  /**
   * Gets the number of remaining requests for a user and action
   */
  async getRemainingRequests(userId: string, action: string): Promise<number> {
    const result = await this.checkLimit(userId, action);
    return result.remainingRequests;
  }

  /**
   * Gets the current rate limit configuration for an action
   */
  getLimitConfig(action: string): RateLimitConfig | null {
    return this.limits[action] || null;
  }

  /**
   * Updates the rate limit configuration for an action
   */
  setLimitConfig(action: string, config: RateLimitConfig): void {
    this.limits[action] = config;
  }

  /**
   * Gets all current request records for debugging/monitoring
   */
  getRequestRecords(userId?: string, action?: string): RequestRecord[] {
    const allRecords: RequestRecord[] = [];
    
    for (const [key, records] of this.requests.entries()) {
      const [recordUserId, recordAction] = key.split(':');
      
      // Filter by userId and/or action if specified
      if (userId && recordUserId !== userId) continue;
      if (action && recordAction !== action) continue;
      
      allRecords.push(...records);
    }
    
    return allRecords.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Clears all rate limit data for a specific user
   */
  clearUserData(userId: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.requests.keys()) {
      if (key.startsWith(`${userId}:`)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.requests.delete(key));
  }

  /**
   * Clears all rate limit data
   */
  clearAllData(): void {
    this.requests.clear();
  }

  /**
   * Gets rate limit status for all actions for a user
   */
  async getUserRateLimitStatus(userId: string): Promise<Record<string, RateLimitResult>> {
    const status: Record<string, RateLimitResult> = {};
    
    for (const action of Object.keys(this.limits)) {
      status[action] = await this.checkLimit(userId, action);
    }
    
    return status;
  }

  /**
   * Checks if a user is currently rate limited for any action
   */
  async isUserRateLimited(userId: string): Promise<boolean> {
    const status = await this.getUserRateLimitStatus(userId);
    return Object.values(status).some(result => !result.allowed);
  }

  /**
   * Gets the time until a user can make requests again for a specific action
   */
  async getTimeUntilReset(userId: string, action: string): Promise<number> {
    const result = await this.checkLimit(userId, action);
    if (result.allowed) {
      return 0;
    }
    return result.retryAfter || 0;
  }

  /**
   * Formats rate limit information for display to users
   */
  formatRateLimitMessage(result: RateLimitResult, action: string): string {
    if (result.allowed) {
      return `${result.remainingRequests} ${action} requests remaining`;
    } else {
      const retryAfter = result.retryAfter || 0;
      const minutes = Math.floor(retryAfter / 60);
      const seconds = retryAfter % 60;
      
      if (minutes > 0) {
        return `Rate limit exceeded. Try again in ${minutes}m ${seconds}s`;
      } else {
        return `Rate limit exceeded. Try again in ${seconds} seconds`;
      }
    }
  }

  /**
   * Cleans up old request records to prevent memory leaks
   */
  private cleanupOldRequests(): void {
    const now = Date.now();
    const maxAge = Math.max(...Object.values(this.limits).map(l => l.window)) * 2; // Keep records for 2x the longest window
    
    for (const [key, records] of this.requests.entries()) {
      const validRecords = records.filter(record => now - record.timestamp < maxAge);
      
      if (validRecords.length === 0) {
        this.requests.delete(key);
      } else if (validRecords.length !== records.length) {
        this.requests.set(key, validRecords);
      }
    }
  }

  /**
   * Gets memory usage statistics for monitoring
   */
  getMemoryStats(): { totalRecords: number; totalUsers: number; totalActions: number } {
    let totalRecords = 0;
    const users = new Set<string>();
    const actions = new Set<string>();
    
    for (const [key, records] of this.requests.entries()) {
      const [userId, action] = key.split(':');
      totalRecords += records.length;
      users.add(userId);
      actions.add(action);
    }
    
    return {
      totalRecords,
      totalUsers: users.size,
      totalActions: actions.size
    };
  }
}

// Export singleton instance
export const rateLimiter = new ClientSideRateLimiter();