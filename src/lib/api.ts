import { supabase } from '@/integrations/supabase/client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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

// Profile API
export const profileAPI = {
  // Get user profile
  getProfile: async () => {
    return apiCall('/api/profile');
  },

  // Create or update profile
  updateProfile: async (profileData: {
    business_name: string;
    owner_name: string;
    business_type: string;
    location: string;
    monthly_revenue: number;
    monthly_expenses: number;
    preferred_language: string;
  }) => {
    return apiCall('/api/profile', {
      method: 'POST',
      body: JSON.stringify(profileData),
    });
  },

  // Get profile statistics
  getProfileStats: async () => {
    return apiCall('/api/profile/stats');
  },
};

// Document API
export const documentAPI = {
  // Get all documents
  getDocuments: async (params?: {
    page?: number;
    limit?: number;
    doc_type?: string;
    status?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.doc_type) queryParams.append('doc_type', params.doc_type);
    if (params?.status) queryParams.append('status', params.status);
    
    const endpoint = `/api/documents${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiCall(endpoint);
  },

  // Get specific document
  getDocument: async (id: string) => {
    return apiCall(`/api/documents/${id}`);
  },

  // Create document record
  createDocument: async (documentData: {
    file_name: string;
    file_url: string;
    doc_type?: string;
    extracted_text?: string;
    file_size?: number;
    mime_type?: string;
  }) => {
    return apiCall('/api/documents', {
      method: 'POST',
      body: JSON.stringify(documentData),
    });
  },

  // Update document
  updateDocument: async (id: string, documentData: {
    file_name?: string;
    doc_type?: string;
    extracted_text?: string;
    status?: string;
  }) => {
    return apiCall(`/api/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(documentData),
    });
  },

  // Delete document
  deleteDocument: async (id: string) => {
    return apiCall(`/api/documents/${id}`, {
      method: 'DELETE',
    });
  },

  // Get document statistics
  getDocumentStats: async () => {
    return apiCall('/api/documents/stats');
  },
};

// AI Chat API
export const chatAPI = {
  // Send chat message with Graph RAG
  sendMessage: async (message: string) => {
    return apiCall('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  // Get financial insights with Graph RAG
  getInsights: async () => {
    return apiCall('/api/chat/insights');
  },

  // Get enhanced chat history with knowledge context
  getChatHistory: async (conversationId?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (conversationId) params.append('conversation_id', conversationId);
    if (limit) params.append('limit', limit.toString());
    
    const queryString = params.toString();
    return apiCall(`/api/chat/history${queryString ? '?' + queryString : ''}`);
  },

  // Get knowledge graph visualization data
  getKnowledgeGraph: async (limit?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    
    const queryString = params.toString();
    return apiCall(`/api/chat/knowledge-graph${queryString ? '?' + queryString : ''}`);
  },
};



// Earnings API - Aligned with your database structure
export const earningsAPI = {
  // Add daily earnings entry
  addEarnings: async (earningsData: {
    earning_date: string;
    amount: number;
    inventory_cost: number;
  }) => {
    console.log('🚀 addEarnings called with:', earningsData);
    
    const { data: user } = await supabase.auth.getUser();
    console.log('👤 User auth check:', !!user.user, user.user?.email);
    
    if (!user.user) throw new Error('User not authenticated');

    // Check if record already exists for this date
    console.log('🔍 Checking for existing record...');
    const { data: existingRecord, error: checkError } = await supabase
      .from('earnings')
      .select('id')
      .eq('user_id', user.user.id)
      .eq('earning_date', earningsData.earning_date)
      .single();

    console.log('📋 Existing record check:', { existingRecord, checkError });

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('❌ Check error:', checkError);
      throw new Error(checkError.message);
    }

    let data, error;

    if (existingRecord) {
      console.log('🔄 Updating existing record...');
      // Update existing record
      const result = await supabase
        .from('earnings')
        .update({
          amount: earningsData.amount,
          inventory_cost: earningsData.inventory_cost
        })
        .eq('id', existingRecord.id)
        .select()
        .single();
      
      data = result.data;
      error = result.error;
      console.log('📝 Update result:', { data, error });
    } else {
      console.log('➕ Inserting new record...');
      // Insert new earnings record
      const result = await supabase
        .from('earnings')
        .insert({
          user_id: user.user.id,
          earning_date: earningsData.earning_date,
          amount: earningsData.amount,
          inventory_cost: earningsData.inventory_cost
        })
        .select()
        .single();
      
      data = result.data;
      error = result.error;
      console.log('📝 Insert result:', { data, error });
    }

    if (error) {
      console.error('❌ Final error:', error);
      throw new Error(error.message);
    }
    
    console.log('✅ Success! Returning:', { success: true, data });
    return { success: true, data };
  },

  // Get earnings summary and analytics - with fallback to direct query
  getSummary: async (userId?: string, month?: string) => {
    console.log('getSummary called with userId:', userId, 'month:', month);

    // Get current user if userId not provided
    let currentUserId = userId;
    if (!currentUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      currentUserId = user.id;
    }

    // Use provided month or default to current month
    const targetMonth = month || (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    })();

    // Parse the target month
    const [year, monthNum] = targetMonth.split('-').map(Number);
    const startOfMonth = `${year}-${String(monthNum).padStart(2, '0')}-01`;
    const endOfMonth = new Date(year, monthNum, 0).toISOString().split('T')[0];

    // First try the edge function
    try {
      const token = await getAuthToken();
      const endpoint = `/functions/v1/earnings-summary/${currentUserId}`;
      console.log('Trying edge function:', `${import.meta.env.VITE_SUPABASE_URL}${endpoint}`);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqeXhnbG94aWl1Ym1kaGNub3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1NjU2NDEsImV4cCI6MjA3MTE0MTY0MX0.jrwY-sRG3YOt75UwBrRQAHS7cIL2ZuvzYO3XwA0IHRs"
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Edge function success:', result);
        return result;
      }
    } catch (error) {
      console.log('Edge function failed, trying direct query fallback:', error);
    }
    
    // Fallback to direct Supabase query with selected month
    try {
      console.log('Using direct Supabase query fallback for month:', targetMonth);
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');
      
      const { data: earnings, error } = await supabase
        .from('earnings')
        .select('*')
        .eq('user_id', user.user.id)
        .gte('earning_date', startOfMonth)
        .lte('earning_date', endOfMonth)
        .order('earning_date', { ascending: false });
      
      if (error) throw error;
      
      // Calculate monthly totals manually
      const totalIncome = earnings?.reduce((sum, earning) => sum + (earning.amount || 0), 0) || 0;
      const totalInventoryCost = earnings?.reduce((sum, earning) => sum + (earning.inventory_cost || 0), 0) || 0;
      const totalProfit = totalIncome - totalInventoryCost;
      const daysRecorded = earnings?.length || 0;
      
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      
      const result = {
        success: true,
        summary: {
          monthly_totals: [{
            month: targetMonth,
            month_name: monthNames[monthNum - 1],
            year: year,
            month_number: monthNum,
            total_income: totalIncome,
            total_inventory_cost: totalInventoryCost,
            total_profit: totalProfit,
            days_recorded: daysRecorded,
            avg_daily_income: daysRecorded > 0 ? totalIncome / daysRecorded : 0,
            avg_daily_profit: daysRecorded > 0 ? totalProfit / daysRecorded : 0,
            growth_percentage: 0 // We don't have previous month data for comparison
          }]
        }
      };
      
      console.log('Direct query result for month', targetMonth, ':', result);
      return result;
      
    } catch (fallbackError) {
      console.error('Both edge function and direct query failed:', fallbackError);
      throw fallbackError;
    }
  },

  // Get earnings for a specific date range
  getEarningsByDateRange: async (startDate: string, endDate: string) => {
    const { data, error } = await supabase
      .from('earnings')
      .select('*')
      .gte('earning_date', startDate)  // Using your column name
      .lte('earning_date', endDate)    // Using your column name
      .order('earning_date', { ascending: false });
    
    if (error) throw new Error(error.message);
    return { success: true, data };
  },

  // Update earnings (basic fields only)
  updateEarnings: async (id: string, updates: {
    earning_date?: string;
    amount?: number;
    inventory_cost?: number;
    file_url?: string;
    doc_type?: string;
    processed_text?: string;
  }) => {
    const { data, error } = await supabase
      .from('earnings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return { success: true, data };
  },

  // Delete earnings entry
  deleteEarnings: async (id: string) => {
    const { data, error } = await supabase
      .from('earnings')
      .delete()
      .eq('id', id);
    
    if (error) throw new Error(error.message);
    return { success: true, message: 'Earnings deleted successfully' };
  },

  // Test connection to earnings table
  testConnection: async () => {
    const token = await getAuthToken();
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/connection-test`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  // Helper function to create sample earnings data for testing
  createSampleData: async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');
    
    const currentDate = new Date();
    const sampleData = [];
    
    // Create 5 days of sample earnings for current month
    for (let i = 0; i < 5; i++) {
      const date = new Date(currentDate);
      date.setDate(date.getDate() - i);
      
      sampleData.push({
        user_id: user.user.id,
        earning_date: date.toISOString().split('T')[0],
        amount: Math.floor(Math.random() * 5000) + 2000, // Random amount between 2000-7000
        inventory_cost: Math.floor(Math.random() * 1500) + 500 // Random cost between 500-2000
      });
    }
    
    const { data, error } = await supabase
      .from('earnings')
      .insert(sampleData)
      .select();
    
    if (error) throw new Error(error.message);
    return { success: true, data, message: 'Sample earnings data created successfully' };
  },
};

// Profile API - Enhanced with notification settings
export const enhancedProfileAPI = {
  ...profileAPI,
  
  // Update notification preferences
  updateNotificationSettings: async (settings: {
    phone_number?: string;
    notify_whatsapp?: boolean;
    notify_email?: boolean;
  }) => {
    const { data, error } = await supabase
      .from('profiles')
      .update(settings)
      .eq('id', (await supabase.auth.getUser()).data.user?.id)
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return { success: true, data };
  },

  // Get notification settings
  getNotificationSettings: async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');
    
    const { data, error } = await supabase
      .from('profiles')
      .select('phone_number, notify_whatsapp, notify_email')
      .eq('id', user.user.id)
      .single();
    
    if (error) throw new Error(error.message);
    return { success: true, data };
  },
};

// Business Ideas API
export const businessIdeasAPI = {
  // Generate business ideas with Graph RAG
  generateIdeas: async (budget: number, field: string) => {
    return apiCall('/api/business-ideas', {
      method: 'POST',
      body: JSON.stringify({ budget, field }),
    });
  },

  // Get trending sectors with personalization
  getTrendingSectors: async () => {
    return apiCall('/api/business-ideas/trending');
  },

  // Get investment recommendations
  getInvestmentRecommendations: async (budget: number) => {
    return apiCall(`/api/business-ideas/recommendations?budget=${budget}`);
  },
};

// Products and Recommendations API

export const productsAPI = {
  getProducts: async (filters?: {
    category?: string;
    business_type?: string;
    min_price?: number;
    max_price?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.business_type) params.append('business_type', filters.business_type);
    if (filters?.min_price) params.append('min_price', String(filters.min_price));
    if (filters?.max_price) params.append('max_price', String(filters.max_price));
    if (filters?.limit) params.append('limit', String(filters.limit));

    return apiCall(`/api/products${params.toString() ? `?${params}` : ''}`);
  },

  getProduct: async (id: string) => {
    return apiCall(`/api/products/${id}`);
  },

  getRecommendations: async () => {
    return apiCall('/api/products/recommendations');
  },

  updateRecommendationInteraction: async (
    id: string,
    interaction: {
      is_viewed?: boolean;
      is_interested?: boolean;
      user_feedback?: string;
    }
  ) => {
    return apiCall(`/api/products/recommendations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(interaction),
    });
  },

  getCategories: async () => {
    return apiCall('/api/products/categories');
  },

  createProduct: async (productData: {
    name: string;
    description: string;
    category: string;
    target_business_types: string[];
    price: number;
    vendor_name: string;
  }) => {
    return apiCall('/api/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    });
  },
};
// Health check
export const healthAPI = {
  // Check API health
  checkHealth: async () => {
    return apiCall('/health');
  },

  // Get API info
  getInfo: async () => {
    return apiCall('/api');
  },
};

// Duplicate Detection API
export const duplicateAPI = {
  // Check if a document is a duplicate
  checkDuplicate: async (duplicateData: {
    fileHash: string;
    fileName: string;
    fileSize: number;
    extractedData?: any;
    userId: string;
  }) => {
    return apiCall('/api/duplicates/check', {
      method: 'POST',
      body: JSON.stringify(duplicateData),
    });
  },

  // Register a processed document
  registerDocument: async (documentData: {
    fileHash: string;
    contentHash?: string;
    fileName: string;
    fileSize: number;
    extractedData?: any;
    userId: string;
  }) => {
    return apiCall('/api/duplicates/register', {
      method: 'POST',
      body: JSON.stringify(documentData),
    });
  },

  // Get duplicate statistics
  getStats: async (userId: string) => {
    return apiCall(`/api/duplicates/stats/${userId}`);
  },

  // Clear all processed documents
  clearProcessedDocuments: async (userId: string) => {
    return apiCall(`/api/duplicates/clear/${userId}`, {
      method: 'DELETE',
    });
  },
};

// Monthly Revenue Helper Functions
export const monthlyRevenueHelpers = {
  // Extract current month revenue from earnings summary
  getCurrentMonthRevenue: (summaryData: any) => {
    try {
      const monthlyTotals = summaryData?.summary?.monthly_totals || summaryData?.monthly_totals;
      if (monthlyTotals && monthlyTotals.length > 0) {
        // First item is the most recent month
        return {
          amount: Number(monthlyTotals[0].total_income) || 0,
          source: 'calculated',
          monthName: monthlyTotals[0].month_name || monthlyTotals[0].month,
          daysRecorded: monthlyTotals[0].days_recorded || 0,
          growthPercentage: Number(monthlyTotals[0].growth_percentage) || 0
        };
      }
      return null;
    } catch (error) {
      console.error('Error extracting current month revenue:', error);
      return null;
    }
  },

  // Get fallback revenue from profile data
  getFallbackRevenue: (profileData: any) => {
    return {
      amount: Number(profileData?.monthly_revenue) || 0,
      source: 'estimated',
      monthName: new Date().toLocaleString('default', { month: 'long' }),
      daysRecorded: 0,
      growthPercentage: 0
    };
  },

  // Get the best available monthly revenue data
  getBestMonthlyRevenue: (summaryData: any, profileData: any) => {
    const calculatedRevenue = monthlyRevenueHelpers.getCurrentMonthRevenue(summaryData);
    
    if (calculatedRevenue && calculatedRevenue.amount > 0) {
      return calculatedRevenue;
    }
    
    return monthlyRevenueHelpers.getFallbackRevenue(profileData);
  }
};

// Comparison API
export const comparisonAPI = {
  // Get detailed month comparison
  getDetailedComparison: async (month: string) => {
    return apiCall(`/api/comparison/detailed?month=${month}`);
  },
};

// Revenue API
export const revenueAPI = {
  // Get monthly revenue
  getMonthlyRevenue: async (month: string) => {
    return apiCall(`/api/revenue/monthly?month=${month}`);
  },

  // Get revenue comparison
  getRevenueComparison: async (month: string) => {
    return apiCall(`/api/revenue/compare?month=${month}`);
  },

  // Get revenue breakdown
  getRevenueBreakdown: async (month: string) => {
    return apiCall(`/api/revenue/breakdown?month=${month}`);
  },

  // Get revenue insights
  getRevenueInsights: async (month: string) => {
    return apiCall(`/api/revenue/insight?month=${month}`);
  },
};

// Error handling utility
export const handleAPIError = (error: unknown) => {
  console.error('API Error:', error);
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  if (errorMessage?.includes('token')) {
    return 'Authentication required. Please log in again.';
  }
  
  if (errorMessage?.includes('rate limit')) {
    return 'Too many requests. Please try again in a moment.';
  }
  
  if (errorMessage?.includes('Network error')) {
    return 'Network error. Please check your connection.';
  }
  
  return errorMessage || 'An unexpected error occurred.';
};