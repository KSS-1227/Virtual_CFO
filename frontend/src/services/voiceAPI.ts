import { supabase } from '@/integrations/supabase/client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Get auth token
const getAuthToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
};

export const voiceAPI = {
  // Process voice command (text)
  processCommand: async (command: string) => {
    const token = await getAuthToken();
    
    const response = await fetch(`${API_BASE_URL}/api/voice/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ command })
    });

    if (!response.ok) {
      throw new Error('Failed to process voice command');
    }

    return response.json();
  },

  // Generate speech from text
  generateSpeech: async (text: string, language: 'en' | 'hi' = 'hi') => {
    const token = await getAuthToken();
    
    const response = await fetch(`${API_BASE_URL}/api/voice/speech`, {
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

    return response.blob();
  },

  // Process audio file
  processAudio: async (audioBlob: Blob) => {
    const token = await getAuthToken();
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice.wav');
    
    const response = await fetch(`${API_BASE_URL}/api/voice/audio`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error('Failed to process audio');
    }

    return response.json();
  }
};

// Voice utilities
export const voiceUtils = {
  // Record audio
  recordAudio: (duration: number = 5000): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const audioChunks: Blob[] = [];

        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          stream.getTracks().forEach(track => track.stop());
          resolve(audioBlob);
        };

        mediaRecorder.start();
        setTimeout(() => mediaRecorder.stop(), duration);
      } catch (error) {
        reject(error);
      }
    });
  },

  // Play audio
  playAudio: (audioBlob: Blob): Promise<void> => {
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