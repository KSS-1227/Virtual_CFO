/**
 * Secure API Service
 * Replaces direct API calls with secure server-side proxied calls
 * Ensures no API keys are exposed in client-side code
 */

import { apiSecurityManager } from './apiSecurity';
import { rateLimiter } from './rateLimiter';

export interface SecureAPIOptions extends RequestInit {
  skipRateLimit?: boolean;
  skipAuth?: boolean;
  timeout?: number;
}

export interface SecureAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  rateLimitInfo?: {
    remaining: number;
    resetTime: Date;
    retryAfter?: number;
  };
}

export class SecureAPIService {
  private readonly baseURL: string;
  private readonly defaultTimeout = 30000; // 30 seconds

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  }

  /**
   * Makes a secure API call with rate limiting and authentication
   */
  async call<T = any>(
    endpoint: string, 
    options: SecureAPIOptions = {}
  ): Promise<SecureAPIResponse<T>> {
    const {
      skipRateLimit = false,
      skipAuth = false,
      timeout = this.defaultTimeout,
      ...requestOptions
    } = options;

    try {
      // Get user ID for rate limiting
      const userId = await this.getCurrentUserId();
      
      // Check rate limits unless skipped
      if (!skipRateLimit && userId) {
        const rateLimitResult = await rateLimiter.checkLimit(userId, 'api');
        
        if (!rateLimitResult.allowed) {
          return {
            success: false,
            error: `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds.`,
            rateLimitInfo: {
              remaining: rateLimitResult.remainingRequests,
              resetTime: rateLimitResult.resetTime,
              retryAfter: rateLimitResult.retryAfter
            }
          };
        }
      }

      // Make the secure API call
      const response = await this.makeSecureRequest(endpoint, requestOptions, timeout);
      
      // Record successful request for rate limiting
      if (!skipRateLimit && userId && response.ok) {
        await rateLimiter.recordRequest(userId, 'api');
      }

      // Parse response
      const result = await this.parseResponse<T>(response);
      
      return {
        success: response.ok,
        data: response.ok ? result : undefined,
        error: response.ok ? undefined : result.error || `HTTP ${response.status}: ${response.statusText}`,
        rateLimitInfo: await this.extractRateLimitInfo(response)
      };

    } catch (error) {
      console.error('Secure API call failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred'
      };
    }
  }

  /**
   * Secure GET request
   */
  async get<T = any>(endpoint: string, options: SecureAPIOptions = {}): Promise<SecureAPIResponse<T>> {
    return this.call<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * Secure POST request
   */
  async post<T = any>(
    endpoint: string, 
    data?: any, 
    options: SecureAPIOptions = {}
  ): Promise<SecureAPIResponse<T>> {
    const body = data ? JSON.stringify(data) : undefined;
    return this.call<T>(endpoint, {
      ...options,
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  }

  /**
   * Secure PUT request
   */
  async put<T = any>(
    endpoint: string, 
    data?: any, 
    options: SecureAPIOptions = {}
  ): Promise<SecureAPIResponse<T>> {
    const body = data ? JSON.stringify(data) : undefined;
    return this.call<T>(endpoint, {
      ...options,
      method: 'PUT',
      body,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  }

  /**
   * Secure DELETE request
   */
  async delete<T = any>(endpoint: string, options: SecureAPIOptions = {}): Promise<SecureAPIResponse<T>> {
    return this.call<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Secure file upload
   */
  async uploadFile<T = any>(
    endpoint: string,
    file: File,
    additionalData?: Record<string, any>,
    options: SecureAPIOptions = {}
  ): Promise<SecureAPIResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, typeof value === 'string' ? value : JSON.stringify(value));
      });
    }

    return this.call<T>(endpoint, {
      ...options,
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type for FormData - browser will set it with boundary
        ...options.headers
      }
    });
  }

  /**
   * Makes the actual secure request through the security manager
   */
  private async makeSecureRequest(
    endpoint: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Use the security manager to make the request
      const response = await apiSecurityManager.validateServerSideAuth(endpoint, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      
      throw error;
    }
  }

  /**
   * Parses API response safely
   */
  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      try {
        return await response.json();
      } catch (error) {
        throw new Error('Invalid JSON response from server');
      }
    }
    
    // For non-JSON responses, return text
    const text = await response.text();
    return text as unknown as T;
  }

  /**
   * Extracts rate limit information from response headers
   */
  private async extractRateLimitInfo(response: Response): Promise<{
    remaining: number;
    resetTime: Date;
    retryAfter?: number;
  } | undefined> {
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');
    const retryAfter = response.headers.get('Retry-After');

    if (remaining !== null || reset !== null) {
      return {
        remaining: remaining ? parseInt(remaining, 10) : 0,
        resetTime: reset ? new Date(parseInt(reset, 10) * 1000) : new Date(),
        retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined
      };
    }

    return undefined;
  }

  /**
   * Gets the current user ID for rate limiting
   */
  private async getCurrentUserId(): Promise<string | null> {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    } catch {
      return null;
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<SecureAPIResponse<{ status: string; timestamp: string }>> {
    return this.get('/health', { skipRateLimit: true });
  }

  /**
   * Gets API configuration (without sensitive data)
   */
  async getAPIInfo(): Promise<SecureAPIResponse<{ version: string; features: string[] }>> {
    return this.get('/api/info', { skipRateLimit: true });
  }
}

/**
 * Legacy API wrapper for backward compatibility
 * Gradually replace direct API calls with secure versions
 */
export class LegacyAPIWrapper {
  private secureAPI: SecureAPIService;

  constructor() {
    this.secureAPI = new SecureAPIService();
  }

  /**
   * Wraps the old apiCall function with security
   */
  async apiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
    const result = await this.secureAPI.call(endpoint, options);
    
    if (!result.success) {
      throw new Error(result.error || 'API call failed');
    }
    
    return result.data;
  }

  /**
   * Secure OpenAI API proxy (no keys exposed)
   */
  async openAICall(prompt: string, options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  } = {}): Promise<any> {
    return this.secureAPI.post('/api/ai/openai', {
      prompt,
      ...options
    });
  }

  /**
   * Secure document processing (no keys exposed)
   */
  async processDocument(file: File, options: {
    extractText?: boolean;
    analyzeContent?: boolean;
  } = {}): Promise<any> {
    return this.secureAPI.uploadFile('/api/documents/process', file, options);
  }

  /**
   * Secure image analysis (no keys exposed)
   */
  async analyzeImage(file: File, prompt?: string): Promise<any> {
    return this.secureAPI.uploadFile('/api/ai/vision', file, { prompt });
  }
}

// Export instances
export const secureAPI = new SecureAPIService();
export const legacyAPI = new LegacyAPIWrapper();

// Export helper functions for migration
export const migrateToSecureAPI = {
  /**
   * Replace fetch calls with secure API calls
   */
  replaceFetch: (url: string, options?: RequestInit) => {
    const endpoint = url.replace(secureAPI['baseURL'], '');
    return secureAPI.call(endpoint, options);
  },

  /**
   * Replace direct OpenAI calls with secure proxy
   */
  replaceOpenAI: (prompt: string, options?: any) => {
    return legacyAPI.openAICall(prompt, options);
  },

  /**
   * Replace document processing with secure version
   */
  replaceDocumentProcessing: (file: File, options?: any) => {
    return legacyAPI.processDocument(file, options);
  }
};