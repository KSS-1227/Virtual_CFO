/**
 * Enhanced Memory Manager
 * 
 * Provides comprehensive resource tracking, automatic cleanup,
 * camera stream management, and memory usage monitoring.
 */

export interface ResourceType {
  type: 'CAMERA_STREAM' | 'OBJECT_URL' | 'FILE_BUFFER' | 'CANVAS_CONTEXT' | 'MEDIA_RECORDER' | 'AUDIO_CONTEXT';
  cleanup: () => void;
}

export interface TrackedResource {
  id: string;
  resource: any;
  type: ResourceType;
  createdAt: number;
  size?: number;
  cleanup: () => void;
}

export interface MemoryStats {
  trackedResources: number;
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  resourcesByType: Record<string, number>;
  totalResourceSize: number;
}

export interface MemoryLimits {
  maxConcurrentStreams: number;
  maxObjectUrls: number;
  maxFileBuffers: number;
  maxTotalMemoryMB: number;
}

export interface MemoryManager {
  trackResource(resource: any, type: ResourceType): string;
  releaseResource(resourceId: string): void;
  cleanupAll(): void;
  getMemoryUsage(): MemoryStats;
  addCleanupCallback(callback: () => void): () => void;
  enforceMemoryLimits(): Promise<void>;
}

export class EnhancedMemoryManager implements MemoryManager {
  private resources = new Map<string, TrackedResource>();
  private cleanupCallbacks = new Set<() => void>();
  private resourceCounter = 0;
  
  private readonly limits: MemoryLimits = {
    maxConcurrentStreams: 3,
    maxObjectUrls: 50,
    maxFileBuffers: 10,
    maxTotalMemoryMB: 500
  };

  private cleanupInterval: number | null = null;
  private memoryCheckInterval = 30000; // 30 seconds

  constructor(customLimits?: Partial<MemoryLimits>) {
    if (customLimits) {
      this.limits = { ...this.limits, ...customLimits };
    }
    
    // Start periodic cleanup
    this.startPeriodicCleanup();
    
    // Listen for page unload to cleanup everything
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.cleanupAll());
      window.addEventListener('pagehide', () => this.cleanupAll());
    }
  }

  /**
   * Track a resource for automatic cleanup
   */
  trackResource(resource: any, type: ResourceType): string {
    const id = this.generateResourceId();
    const size = this.estimateResourceSize(resource, type);
    
    const trackedResource: TrackedResource = {
      id,
      resource,
      type,
      createdAt: Date.now(),
      size,
      cleanup: type.cleanup
    };
    
    this.resources.set(id, trackedResource);
    
    // Enforce limits after adding new resource
    this.enforceMemoryLimits().catch(error => {
      console.warn('Failed to enforce memory limits:', error);
    });
    
    return id;
  }

  /**
   * Release a specific resource
   */
  releaseResource(resourceId: string): void {
    const resource = this.resources.get(resourceId);
    if (resource) {
      try {
        resource.cleanup();
      } catch (error) {
        console.warn(`Error cleaning up resource ${resourceId}:`, error);
      }
      this.resources.delete(resourceId);
    }
  }

  /**
   * Clean up all tracked resources
   */
  cleanupAll(): void {
    for (const [id, resource] of this.resources) {
      try {
        resource.cleanup();
      } catch (error) {
        console.warn(`Error cleaning up resource ${id}:`, error);
      }
    }
    this.resources.clear();
    
    // Execute additional cleanup callbacks
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.warn('Error in cleanup callback:', error);
      }
    });
    
    // Stop periodic cleanup
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get current memory usage statistics
   */
  getMemoryUsage(): MemoryStats {
    const performance = (window as any).performance;
    const memory = performance?.memory;
    
    const resourcesByType: Record<string, number> = {};
    let totalResourceSize = 0;
    
    for (const resource of this.resources.values()) {
      const typeName = resource.type.type;
      resourcesByType[typeName] = (resourcesByType[typeName] || 0) + 1;
      totalResourceSize += resource.size || 0;
    }
    
    return {
      trackedResources: this.resources.size,
      usedJSHeapSize: memory?.usedJSHeapSize || 0,
      totalJSHeapSize: memory?.totalJSHeapSize || 0,
      jsHeapSizeLimit: memory?.jsHeapSizeLimit || 0,
      resourcesByType,
      totalResourceSize
    };
  }

  /**
   * Add a cleanup callback that will be executed during cleanup
   */
  addCleanupCallback(callback: () => void): () => void {
    this.cleanupCallbacks.add(callback);
    return () => this.cleanupCallbacks.delete(callback);
  }

  /**
   * Enforce memory limits by cleaning up old resources
   */
  async enforceMemoryLimits(): Promise<void> {
    const stats = this.getMemoryUsage();
    
    // Check stream limits
    const streamCount = stats.resourcesByType['CAMERA_STREAM'] || 0;
    if (streamCount > this.limits.maxConcurrentStreams) {
      await this.cleanupOldestResourcesByType('CAMERA_STREAM', streamCount - this.limits.maxConcurrentStreams);
    }
    
    // Check object URL limits
    const objectUrlCount = stats.resourcesByType['OBJECT_URL'] || 0;
    if (objectUrlCount > this.limits.maxObjectUrls) {
      await this.cleanupOldestResourcesByType('OBJECT_URL', objectUrlCount - this.limits.maxObjectUrls);
    }
    
    // Check file buffer limits
    const fileBufferCount = stats.resourcesByType['FILE_BUFFER'] || 0;
    if (fileBufferCount > this.limits.maxFileBuffers) {
      await this.cleanupOldestResourcesByType('FILE_BUFFER', fileBufferCount - this.limits.maxFileBuffers);
    }
    
    // Check total memory usage
    const totalMemoryMB = stats.totalResourceSize / (1024 * 1024);
    if (totalMemoryMB > this.limits.maxTotalMemoryMB) {
      await this.cleanupOldestResources(Math.ceil(this.resources.size * 0.2)); // Clean up 20% of resources
    }
    
    // Trigger garbage collection if available
    if (typeof window !== 'undefined' && (window as any).gc) {
      try {
        (window as any).gc();
      } catch (error) {
        // Ignore errors - gc() might not be available
      }
    }
  }

  /**
   * Create specialized resource trackers for common use cases
   */
  
  /**
   * Track camera stream with automatic cleanup
   */
  trackCameraStream(stream: MediaStream): string {
    return this.trackResource(stream, {
      type: 'CAMERA_STREAM',
      cleanup: () => {
        try {
          stream.getTracks().forEach(track => {
            track.stop();
          });
        } catch (error) {
          console.warn('Error stopping camera stream:', error);
        }
      }
    });
  }

  /**
   * Track object URL with automatic revocation
   */
  trackObjectUrl(url: string, blob?: Blob): string {
    return this.trackResource({ url, blob }, {
      type: 'OBJECT_URL',
      cleanup: () => {
        try {
          URL.revokeObjectURL(url);
        } catch (error) {
          console.warn('Error revoking object URL:', error);
        }
      }
    });
  }

  /**
   * Track file buffer with size estimation
   */
  trackFileBuffer(buffer: ArrayBuffer | Uint8Array, fileName?: string): string {
    return this.trackResource({ buffer, fileName }, {
      type: 'FILE_BUFFER',
      cleanup: () => {
        // Clear reference to allow garbage collection
        if ('buffer' in buffer) {
          (buffer as any).buffer = null;
        }
      }
    });
  }

  /**
   * Track canvas context with cleanup
   */
  trackCanvasContext(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D | WebGLRenderingContext): string {
    return this.trackResource({ canvas, context }, {
      type: 'CANVAS_CONTEXT',
      cleanup: () => {
        try {
          if (context instanceof CanvasRenderingContext2D) {
            context.clearRect(0, 0, canvas.width, canvas.height);
          } else if ('clear' in context) {
            (context as WebGLRenderingContext).clear((context as WebGLRenderingContext).COLOR_BUFFER_BIT);
          }
          
          // Reset canvas size to free memory
          canvas.width = 1;
          canvas.height = 1;
        } catch (error) {
          console.warn('Error cleaning up canvas context:', error);
        }
      }
    });
  }

  /**
   * Track media recorder with proper cleanup
   */
  trackMediaRecorder(recorder: MediaRecorder): string {
    return this.trackResource(recorder, {
      type: 'MEDIA_RECORDER',
      cleanup: () => {
        try {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
        } catch (error) {
          console.warn('Error stopping media recorder:', error);
        }
      }
    });
  }

  /**
   * Private helper methods
   */

  private generateResourceId(): string {
    return `resource_${Date.now()}_${++this.resourceCounter}`;
  }

  private estimateResourceSize(resource: any, type: ResourceType): number {
    switch (type.type) {
      case 'CAMERA_STREAM':
        // Estimate based on video track settings
        if (resource instanceof MediaStream) {
          const videoTrack = resource.getVideoTracks()[0];
          if (videoTrack) {
            const settings = videoTrack.getSettings();
            const width = settings.width || 640;
            const height = settings.height || 480;
            const fps = settings.frameRate || 30;
            // Rough estimate: width * height * 4 bytes per pixel * fps * buffer seconds
            return width * height * 4 * fps * 2; // 2 seconds of buffer
          }
        }
        return 1024 * 1024; // 1MB default
        
      case 'FILE_BUFFER':
        if (resource.buffer instanceof ArrayBuffer) {
          return resource.buffer.byteLength;
        }
        if (resource.buffer instanceof Uint8Array) {
          return resource.buffer.length;
        }
        return 0;
        
      case 'OBJECT_URL':
        if (resource.blob instanceof Blob) {
          return resource.blob.size;
        }
        return 1024; // 1KB default for URL string
        
      case 'CANVAS_CONTEXT':
        if (resource.canvas instanceof HTMLCanvasElement) {
          return resource.canvas.width * resource.canvas.height * 4; // 4 bytes per pixel
        }
        return 0;
        
      default:
        return 1024; // 1KB default
    }
  }

  private async cleanupOldestResourcesByType(resourceType: string, count: number): Promise<void> {
    const resourcesOfType = Array.from(this.resources.entries())
      .filter(([_, resource]) => resource.type.type === resourceType)
      .sort(([_, a], [__, b]) => a.createdAt - b.createdAt)
      .slice(0, count);

    for (const [id, _] of resourcesOfType) {
      this.releaseResource(id);
    }
  }

  private async cleanupOldestResources(count: number): Promise<void> {
    const oldestResources = Array.from(this.resources.entries())
      .sort(([_, a], [__, b]) => a.createdAt - b.createdAt)
      .slice(0, count);

    for (const [id, _] of oldestResources) {
      this.releaseResource(id);
    }
  }

  private startPeriodicCleanup(): void {
    this.cleanupInterval = window.setInterval(() => {
      this.enforceMemoryLimits().catch(error => {
        console.warn('Periodic memory cleanup failed:', error);
      });
    }, this.memoryCheckInterval);
  }

  /**
   * React hook integration helpers
   */
  
  /**
   * Create a cleanup function for React useEffect
   */
  createReactCleanup(): () => void {
    const resourceIds: string[] = [];
    
    return () => {
      resourceIds.forEach(id => this.releaseResource(id));
    };
  }

  /**
   * Get memory pressure level for adaptive behavior
   */
  getMemoryPressure(): 'low' | 'medium' | 'high' {
    const stats = this.getMemoryUsage();
    
    if (stats.usedJSHeapSize === 0) {
      return 'low'; // Memory API not available
    }
    
    const memoryUsageRatio = stats.usedJSHeapSize / stats.jsHeapSizeLimit;
    
    if (memoryUsageRatio > 0.8) {
      return 'high';
    } else if (memoryUsageRatio > 0.6) {
      return 'medium';
    } else {
      return 'low';
    }
  }
}