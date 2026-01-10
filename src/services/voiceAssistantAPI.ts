import { supabase } from '@/integrations/supabase/client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Enhanced Voice Assistant API with Proactive Intelligence
export const voiceAssistantAPI = {
  // Process proactive commands with business context
  processProactiveCommand: async (command: string) => {
    const token = await getAuthToken();
    
    const response = await fetch(`${API_BASE_URL}/api/voice-assistant/proactive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ 
        command,
        context: await getBusinessContext(),
        timestamp: new Date().toISOString()
      })
    });

    return response.json();
  },

  // Generate contextual business alerts
  generateBusinessAlerts: async () => {
    const token = await getAuthToken();
    
    const response = await fetch(`${API_BASE_URL}/api/voice-assistant/alerts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        business_context: await getBusinessContext(),
        alert_preferences: await getAlertPreferences()
      })
    });

    return response.json();
  },

  // Enhanced speech generation with emotional context
  generateSpeech: async (text: string, language: 'hi' | 'en' = 'hi', emotion: 'neutral' | 'urgent' | 'positive' = 'neutral') => {
    const token = await getAuthToken();
    
    const response = await fetch(`${API_BASE_URL}/api/voice-assistant/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ 
        text, 
        language, 
        emotion,
        voice_profile: 'business_assistant'
      })
    });

    return response.blob();
  },

  // Real-time business monitoring
  startBusinessMonitoring: async () => {
    const token = await getAuthToken();
    
    const response = await fetch(`${API_BASE_URL}/api/voice-assistant/monitoring/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        monitoring_preferences: {
          cash_flow_threshold: -5000,
          profit_margin_threshold: 10,
          daily_revenue_target: 10000,
          expense_spike_threshold: 20
        }
      })
    });

    return response.json();
  },

  // Execute voice-triggered actions
  addExpense: async (data: any) => {
    const token = await getAuthToken();
    
    const response = await fetch(`${API_BASE_URL}/api/earnings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount: 0,
        inventory_cost: data.amount,
        earning_date: new Date().toISOString().split('T')[0],
        processed_text: `Voice: ${data.description}`,
        doc_type: 'voice_expense'
      })
    });

    return response.json();
  },

  // Generate intelligent reports
  generateReport: async (data: any) => {
    const token = await getAuthToken();
    
    const response = await fetch(`${API_BASE_URL}/api/voice-assistant/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        report_type: data.type || 'daily_summary',
        parameters: data.parameters || {},
        delivery_method: 'voice'
      })
    });

    return response.json();
  },

  // Send business alerts
  sendBusinessAlert: async (data: any) => {
    const token = await getAuthToken();
    
    const response = await fetch(`${API_BASE_URL}/api/voice-assistant/alert/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        alert_type: data.type,
        message: data.message,
        priority: data.priority,
        channels: ['voice', 'notification']
      })
    });

    return response.json();
  }
};

// Helper functions
const getAuthToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
};

const getBusinessContext = async () => {
  try {
    const { data: profile } = await supabase.from('profiles').select('*').single();
    const { data: recentEarnings } = await supabase
      .from('earnings')
      .select('*')
      .order('earning_date', { ascending: false })
      .limit(30);
    
    return {
      profile,
      recent_performance: recentEarnings,
      current_time: new Date().toISOString(),
      business_hours: isBusinessHours()
    };
  } catch (error) {
    console.error('Error getting business context:', error);
    return {};
  }
};

const getAlertPreferences = async () => {
  try {
    const { data } = await supabase
      .from('voice_preferences')
      .select('*')
      .single();
    
    return data || {
      alert_frequency: 'daily',
      voice_language: 'hi',
      business_hours_only: true,
      critical_alerts_immediate: true
    };
  } catch (error) {
    return {
      alert_frequency: 'daily',
      voice_language: 'hi',
      business_hours_only: true,
      critical_alerts_immediate: true
    };
  }
};

const isBusinessHours = () => {
  const now = new Date();
  const hour = now.getHours();
  return hour >= 9 && hour <= 21; // 9 AM to 9 PM
};