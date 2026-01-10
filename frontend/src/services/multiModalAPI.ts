import { supabase } from '@/integrations/supabase/client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Helper function to get auth token
const getAuthToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
};

// Helper function for API calls
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  try {
    const token = await getAuthToken();
    
    if (!token) {
      throw new Error('Please log in to use AI features');
    }
    
    const defaultHeaders = {
      Authorization: `Bearer ${token}`,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};

// Convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = reader.result as string;
      resolve(base64.split(',')[1]); // Remove data:image/jpeg;base64, prefix
    };
    reader.onerror = error => reject(error);
  });
};

export const multiModalAPI = {
  // Process receipt image with GPT-4 Vision
  processReceiptImage: async (imageFile: File) => {
    const imageBase64 = await fileToBase64(imageFile);
    
    return apiCall('/api/multimodal/receipt/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageBase64 })
    });
  },

  // Process receipt from camera capture
  processReceiptFromCamera: async (imageBase64: string) => {
    return apiCall('/api/multimodal/receipt/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageBase64 })
    });
  },

  // Process voice command
  processVoiceCommand: async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice-command.wav');
    
    const token = await getAuthToken();
    
    const response = await fetch(`${API_BASE_URL}/api/multimodal/voice/process`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  // Analyze business photo
  analyzeBusinessPhoto: async (imageFile: File) => {
    const imageBase64 = await fileToBase64(imageFile);
    
    return apiCall('/api/multimodal/business/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageBase64 })
    });
  },

  // Generate voice response
  generateVoiceResponse: async (text: string, language: 'en' | 'hi' = 'en') => {
    const token = await getAuthToken();
    
    const response = await fetch(`${API_BASE_URL}/api/multimodal/speech/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text, language })
    });

    if (!response.ok) {
      throw new Error('Failed to generate speech');
    }

    return response.blob(); // Returns audio blob
  }
};

// Utility functions for media handling
export const mediaUtils = {
  // Start camera for receipt capture
  startCamera: async (): Promise<MediaStream> => {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
    } catch (error) {
      console.error('Camera access error:', error);
      throw new Error('Camera access denied or not available');
    }
  },

  // Start microphone for voice commands
  startMicrophone: async (): Promise<MediaStream> => {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });
    } catch (error) {
      console.error('Microphone access error:', error);
      throw new Error('Microphone access denied or not available');
    }
  },

  // Capture image from video stream
  captureImageFromVideo: (video: HTMLVideoElement): string => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');
    
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8).split(',')[1]; // Return base64 without prefix
  },

  // Record audio from microphone
  recordAudio: (stream: MediaStream, duration: number = 10000): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        resolve(audioBlob);
      };

      mediaRecorder.onerror = (error) => {
        reject(error);
      };

      mediaRecorder.start();
      
      // Auto-stop after duration
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, duration);
    });
  },

  // Play audio response
  playAudioResponse: (audioBlob: Blob): Promise<void> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      audio.src = audioUrl;
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        resolve();
      };
      audio.onerror = reject;
      
      audio.play().catch(reject);
    });
  }
};