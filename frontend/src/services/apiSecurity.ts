/**
 * API Security Service
 * Handles secure API communication and authentication failure logging
 */

export interface AuthenticationResult {
  success: boolean;
  token?: string;
  error?: string;
  retryAfter?: number;
}

export interface SecurityEvent {
  type: 'AUTH_FAILURE' | 'RATE_LIMIT_EXCEEDED' | 'INVALID_REQUEST' | 'SUSPICIOUS_ACTIVITY';
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint: string;
  timestamp: Date;
  details?: any;
}

export interface APISecurityConfig {
  maxFailedAttempts: number;
  lockoutDuration: number; // in milliseconds
  logSecurityEvents: boolean;
  blockSuspiciousIPs: boolean;
}

export class APISecurityManager {
  private failedAttempts = new Map<string, { count: number; lastAttempt: Date; lockedUntil?: Date }>();
  private blockedIPs = new Set<string>();
  private securityEvents: SecurityEvent[] = [];
  
  private readonly config: APISecurityConfig = {
    maxFailedAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    logSecurityEvents: true,
    blockSuspiciousIPs: true
  };

  /**
   * Validates server-side authentication without exposing API keys
   */
  async validateServerSideAuth(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const userKey = this.getUserKey();
    const ipAddress = await this.getClientIP();
    
    // Check if IP is blocked
    if (this.isIPBlocked(ipAddress)) {
      const error = new Error('Access denied from this IP address');
      this.logSecurityEvent({
        type: 'SUSPICIOUS_ACTIVITY',
        ipAddress,
        endpoint,
        timestamp: new Date(),
        details: { reason: 'Blocked IP attempted access' }
      });
      throw error;
    }

    // Check if user is locked out
    if (this.isUserLockedOut(userKey)) {
      const lockInfo = this.failedAttempts.get(userKey);
      const retryAfter = lockInfo?.lockedUntil ? 
        Math.ceil((lockInfo.lockedUntil.getTime() - Date.now()) / 1000) : 0;
      
      const error = new Error(`Account temporarily locked. Try again in ${retryAfter} seconds.`);
      this.logSecurityEvent({
        type: 'AUTH_FAILURE',
        userId: userKey,
        ipAddress,
        endpoint,
        timestamp: new Date(),
        details: { reason: 'Attempted access while locked out', retryAfter }
      });
      throw error;
    }

    try {
      // Make the API call through our secure proxy
      const response = await this.makeSecureAPICall(endpoint, options);
      
      // Reset failed attempts on successful authentication
      if (response.ok) {
        this.resetFailedAttempts(userKey);
      }
      
      return response;
      
    } catch (error) {
      // Handle authentication failures
      await this.handleAuthenticationFailure(userKey, ipAddress, endpoint, error);
      throw error;
    }
  }

  /**
   * Makes API calls through server-side proxy to hide API keys
   */
  private async makeSecureAPICall(endpoint: string, options: RequestInit = {}): Promise<Response> {
    // Get authentication token from Supabase (secure)
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('User not authenticated');
    }

    // Prepare secure headers (no API keys exposed)
    const secureHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'X-Client-Version': '1.0.0',
      'X-Request-ID': this.generateRequestId(),
      ...options.headers
    };

    // Remove any potentially exposed API keys from headers
    delete secureHeaders['X-API-Key'];
    delete secureHeaders['OpenAI-API-Key'];
    delete secureHeaders['VITE_OPENAI_API_KEY'];

    // Make request to our secure backend proxy
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: secureHeaders
    });

    // Log security events for failed requests
    if (!response.ok) {
      const userKey = this.getUserKey();
      const ipAddress = await this.getClientIP();
      
      this.logSecurityEvent({
        type: response.status === 401 ? 'AUTH_FAILURE' : 'INVALID_REQUEST',
        userId: userKey,
        ipAddress,
        endpoint,
        timestamp: new Date(),
        details: { 
          status: response.status, 
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        }
      });
    }

    return response;
  }

  /**
   * Handles authentication failures and implements security measures
   */
  private async handleAuthenticationFailure(
    userKey: string, 
    ipAddress: string, 
    endpoint: string, 
    error: any
  ): Promise<void> {
    const now = new Date();
    const userAttempts = this.failedAttempts.get(userKey) || { count: 0, lastAttempt: now };
    
    // Increment failed attempts
    userAttempts.count++;
    userAttempts.lastAttempt = now;
    
    // Check if user should be locked out
    if (userAttempts.count >= this.config.maxFailedAttempts) {
      userAttempts.lockedUntil = new Date(now.getTime() + this.config.lockoutDuration);
      
      // Consider blocking IP if multiple users from same IP are failing
      if (this.config.blockSuspiciousIPs) {
        const recentFailuresFromIP = this.getRecentFailuresFromIP(ipAddress);
        if (recentFailuresFromIP >= 10) { // 10 failures from same IP in recent time
          this.blockedIPs.add(ipAddress);
        }
      }
    }
    
    this.failedAttempts.set(userKey, userAttempts);
    
    // Log the security event
    this.logSecurityEvent({
      type: 'AUTH_FAILURE',
      userId: userKey,
      ipAddress,
      endpoint,
      timestamp: now,
      details: {
        failedAttemptCount: userAttempts.count,
        isLockedOut: !!userAttempts.lockedUntil,
        lockoutUntil: userAttempts.lockedUntil?.toISOString(),
        error: error.message
      }
    });
  }

  /**
   * Logs security events for monitoring and analysis
   */
  private logSecurityEvent(event: SecurityEvent): void {
    if (!this.config.logSecurityEvents) return;
    
    // Add to in-memory log
    this.securityEvents.push(event);
    
    // Keep only recent events (last 1000)
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-1000);
    }
    
    // Log to console in development
    if (import.meta.env.DEV) {
      console.warn('Security Event:', event);
    }
    
    // In production, this would send to a security monitoring service
    this.sendToSecurityMonitoring(event);
  }

  /**
   * Sends security events to monitoring service (placeholder for production implementation)
   */
  private async sendToSecurityMonitoring(event: SecurityEvent): Promise<void> {
    try {
      // In production, this would send to your security monitoring service
      // For now, we'll store in localStorage for demonstration
      const existingEvents = JSON.parse(localStorage.getItem('securityEvents') || '[]');
      existingEvents.push({
        ...event,
        timestamp: event.timestamp.toISOString()
      });
      
      // Keep only last 100 events in localStorage
      const recentEvents = existingEvents.slice(-100);
      localStorage.setItem('securityEvents', JSON.stringify(recentEvents));
      
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  /**
   * Checks if a user is currently locked out
   */
  private isUserLockedOut(userKey: string): boolean {
    const userAttempts = this.failedAttempts.get(userKey);
    if (!userAttempts?.lockedUntil) return false;
    
    const now = new Date();
    if (now < userAttempts.lockedUntil) {
      return true;
    }
    
    // Lockout period has expired, reset the user
    this.resetFailedAttempts(userKey);
    return false;
  }

  /**
   * Checks if an IP address is blocked
   */
  private isIPBlocked(ipAddress: string): boolean {
    return this.blockedIPs.has(ipAddress);
  }

  /**
   * Resets failed attempts for a user
   */
  private resetFailedAttempts(userKey: string): void {
    this.failedAttempts.delete(userKey);
  }

  /**
   * Gets recent failures from a specific IP address
   */
  private getRecentFailuresFromIP(ipAddress: string): number {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return this.securityEvents.filter(event => 
      event.ipAddress === ipAddress && 
      event.type === 'AUTH_FAILURE' && 
      event.timestamp > oneHourAgo
    ).length;
  }

  /**
   * Gets a unique key for the current user
   */
  private getUserKey(): string {
    // In a real implementation, this would be the user ID
    // For now, we'll use a combination of user agent and session storage
    const sessionId = sessionStorage.getItem('sessionId') || this.generateSessionId();
    return `${navigator.userAgent.slice(0, 50)}-${sessionId}`;
  }

  /**
   * Gets the client IP address (best effort)
   */
  private async getClientIP(): Promise<string> {
    try {
      // In a real implementation, this would be provided by the server
      // For client-side, we can only get limited information
      return 'client-ip-unknown';
    } catch {
      return 'ip-detection-failed';
    }
  }

  /**
   * Generates a unique request ID for tracking
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generates a session ID
   */
  private generateSessionId(): string {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('sessionId', sessionId);
    return sessionId;
  }

  /**
   * Gets security statistics for monitoring
   */
  getSecurityStats(): {
    totalEvents: number;
    failedAttempts: number;
    blockedIPs: number;
    lockedUsers: number;
    recentEvents: SecurityEvent[];
  } {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const recentEvents = this.securityEvents.filter(event => event.timestamp > oneHourAgo);
    const lockedUsers = Array.from(this.failedAttempts.values())
      .filter(attempt => attempt.lockedUntil && now < attempt.lockedUntil).length;
    
    return {
      totalEvents: this.securityEvents.length,
      failedAttempts: this.securityEvents.filter(e => e.type === 'AUTH_FAILURE').length,
      blockedIPs: this.blockedIPs.size,
      lockedUsers,
      recentEvents
    };
  }

  /**
   * Clears security data (for testing or admin purposes)
   */
  clearSecurityData(): void {
    this.failedAttempts.clear();
    this.blockedIPs.clear();
    this.securityEvents.length = 0;
    localStorage.removeItem('securityEvents');
  }

  /**
   * Unblocks an IP address (admin function)
   */
  unblockIP(ipAddress: string): void {
    this.blockedIPs.delete(ipAddress);
  }

  /**
   * Unlocks a user (admin function)
   */
  unlockUser(userKey: string): void {
    this.resetFailedAttempts(userKey);
  }

  /**
   * Updates security configuration
   */
  updateConfig(newConfig: Partial<APISecurityConfig>): void {
    Object.assign(this.config, newConfig);
  }
}

// Export singleton instance
export const apiSecurityManager = new APISecurityManager();