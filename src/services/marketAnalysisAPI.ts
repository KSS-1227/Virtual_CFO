// Market Analysis API Service
import { supabase } from '@/integrations/supabase/client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Helper function to get auth token
const getAuthToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
};

// Helper function to make authenticated API calls
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const token = await getAuthToken();
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
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
};

export const marketAnalysisAPI = {
  // Analyze market trends
  analyzeMarketTrends: async (timePeriod = '6_months') => {
    return apiCall('/api/market-analysis/trends', {
      method: 'POST',
      body: JSON.stringify({
        time_period: timePeriod
      })
    });
  },

  // Analyze business scenarios
  analyzeScenarios: async (scenarios: string[], context = {}) => {
    return apiCall('/api/market-analysis/scenarios', {
      method: 'POST',
      body: JSON.stringify({
        scenarios,
        context
      })
    });
  },

  // Get predictive insights
  getPredictiveInsights: async (predictionType = 'revenue', timeHorizon = '3_months') => {
    return apiCall(`/api/market-analysis/predictions?prediction_type=${predictionType}&time_horizon=${timeHorizon}`);
  }
};