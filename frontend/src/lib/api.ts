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

// Profile API
export const profileAPI = {
  // Get user profile with Supabase fallback
  getProfile: async () => {
    try {
      // Try backend API first
      return await apiCall('/api/profile');
    } catch (error) {
      console.log('Backend API failed, using Supabase fallback for profile');
      
      // Fallback to direct Supabase query
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const { data, error: supabaseError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (supabaseError) {
        console.error('Supabase profile query error:', supabaseError);
        // Return empty profile if no profile exists yet
        if (supabaseError.code === 'PGRST116') {
          return { 
            success: true, 
            data: {
              business_name: null,
              owner_name: null,
              business_type: null,
              location: null,
              monthly_revenue: null,
              monthly_expenses: null,
              preferred_language: 'en'
            }
          };
        }
        throw new Error(supabaseError.message);
      }
      
      return { success: true, data };
    }
  },

  // Create or update profile with Supabase fallback
  updateProfile: async (profileData: {
    business_name: string;
    owner_name: string;
    business_type: string;
    location: string;
    monthly_revenue: number;
    monthly_expenses: number;
    preferred_language: string;
  }) => {
    try {
      // Try backend API first
      return await apiCall('/api/profile', {
        method: 'POST',
        body: JSON.stringify(profileData),
      });
    } catch (error) {
      console.log('Backend API failed, using Supabase fallback for profile update');
      
      // Fallback to direct Supabase query
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const { data, error: supabaseError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          ...profileData,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (supabaseError) throw new Error(supabaseError.message);
      
      return { success: true, data };
    }
  },

  // Get profile statistics with Supabase fallback
  getProfileStats: async () => {
    try {
      // Try backend API first
      return await apiCall('/api/profile/stats');
    } catch (error) {
      console.log('Backend API failed, using Supabase fallback for profile stats');
      
      // Fallback to direct Supabase query with basic stats calculation
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Get profile data
      const { data: profile } = await supabase
        .from('profiles')
        .select('monthly_revenue, monthly_expenses')
        .eq('id', user.id)
        .single();
      
      // Get document count
      const { count: documentCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      // Calculate basic stats
      const monthlyRevenue = profile?.monthly_revenue || 0;
      const monthlyExpenses = profile?.monthly_expenses || 0;
      const profitMargin = monthlyRevenue > 0 ? 
        ((monthlyRevenue - monthlyExpenses) / monthlyRevenue) * 100 : 0;
      
      return {
        success: true,
        data: {
          profit_margin: Math.round(profitMargin * 10) / 10,
          total_documents: documentCount || 0,
          last_update: new Date().toISOString()
        }
      };
    }
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

  // Stream AI response with SSE
  streamAIResponse: async (
    prompt: string,
    onToken: (token: { text: string; tokenCount: number; timestamp: string }) => void,
    onMeta?: (meta: any) => void,
    onError?: (error: string) => void,
    signal?: AbortSignal
  ): Promise<void> => {
    // Use Graph RAG chat endpoint instead of streaming for embeddings
    try {
      const response = await chatAPI.sendMessage(prompt);
      
      // Simulate streaming by sending the response in chunks
      const text = response.data.message;
      const words = text.split(' ');
      
      for (let i = 0; i < words.length; i++) {
        if (signal?.aborted) break;
        
        const chunk = words[i] + ' ';
        onToken({
          text: chunk,
          tokenCount: i + 1,
          timestamp: new Date().toISOString()
        });
        
        // Small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Send completion metadata
      onMeta?.({
        totalTokens: words.length,
        model: 'gpt-4o-mini',
        contextUsed: response.data.context_used,
        conversation_id: response.data.conversation_id
      });
      
    } catch (error) {
      onError?.(error instanceof Error ? error.message : String(error));
    }
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
      
      // Get first and last entry dates for date range display
      const firstEntryDate = earnings && earnings.length > 0 ? earnings[earnings.length - 1].earning_date : null;
      const lastEntryDate = earnings && earnings.length > 0 ? earnings[0].earning_date : null;
      
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
            first_entry_date: firstEntryDate,
            last_entry_date: lastEntryDate,
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
    try {
      // Try backend API first
      return await apiCall('/api/products/recommendations');
    } catch (error) {
      console.log('Backend API failed, using fallback for product recommendations');
      
      // Return some sample recommendations as fallback
      return {
        success: true,
        data: [
          {
            id: 1,
            name: "Smart Inventory Manager",
            description: "Reduce overstock and improve inventory turnover automatically",
            price: 1999,
            category: "Inventory",
          },
          {
            id: 2,
            name: "AI Sales Predictor",
            description: "Predict next month sales using AI-driven insights",
            price: 2999,
            category: "Sales",
          },
          {
            id: 3,
            name: "Expense Optimization Tool",
            description: "Identify hidden costs and optimize monthly expenses",
            price: 1499,
            category: "Finance",
          },
        ]
      };
    }
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

// Streaming metrics / AI usage API
export const metricsAPI = {
  // Overall streaming metrics summary (all users)
  getStreamingMetrics: async () => {
    return apiCall('/api/metrics/streaming');
  },

  // Current user's streaming metrics
  getUserStreamingMetrics: async () => {
    return apiCall('/api/metrics/streaming/user');
  },

  // Specific stream metrics by ID (mainly for debugging/admin views)
  getStreamMetrics: async (streamId: string) => {
    return apiCall(`/api/metrics/streaming/${streamId}`);
  },
};

// Inventory API
export const inventoryAPI = {
  // Get inventory data for AI assistant
  getInventory: async () => {
    return apiCall('/api/inventory/items');
  },

  // List inventory items with current stock
  listItems: async () => {
    return apiCall('/api/inventory/items');
  },

  // Create or update an inventory item
  saveItem: async (item: {
    id?: string;
    product_name: string;
    unit?: string;
    brand?: string;
    category?: string;
    aliases?: string[];
    custom_attributes?: any;
    notes?: string;
  }) => {
    return apiCall('/api/inventory/items', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  },

  // Get a single inventory item with movements
  getItem: async (id: string) => {
    return apiCall(`/api/inventory/items/${id}`);
  },

  // Delete item
  deleteItem: async (id: string) => {
    return apiCall(`/api/inventory/items/${id}`, {
      method: 'DELETE',
    });
  },

  // Record stock movement (manual UI, or for integrating with other flows)
  recordMovement: async (movement: {
    item_id?: string;
    product_name?: string;
    direction: 'in' | 'out';
    quantity: number;
    source?: string;
    reference_id?: string;
    metadata?: any;
  }) => {
    return apiCall('/api/inventory/movements', {
      method: 'POST',
      body: JSON.stringify(movement),
    });
  },

  // Summary and insights
  getSummary: async () => {
    return apiCall('/api/inventory/summary');
  },

  getInsights: async () => {
    return apiCall('/api/inventory/insights');
  },

  // === ADVANCED DYNAMIC INVENTORY FEATURES ===

  // Voice command processing
  processVoiceCommand: async (audioFile: File, preferredLanguage = 'mixed') => {
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('preferred_language', preferredLanguage);

    return apiCall('/api/inventory/voice-command', {
      method: 'POST',
      body: formData,
      headers: {} // Remove Content-Type to let browser set it for FormData
    });
  },

  // Handle voice clarification
  handleVoiceClarification: async (originalCommand: any, clarificationResponses: any[]) => {
    return apiCall('/api/inventory/voice-clarification', {
      method: 'POST',
      body: JSON.stringify({
        original_command: originalCommand,
        clarification_responses: clarificationResponses
      }),
    });
  },

  // Image processing
  processImage: async (imageFile: File) => {
    const formData = new FormData();
    formData.append('file', imageFile);

    return apiCall('/api/inventory/image-processing', {
      method: 'POST',
      body: formData,
      headers: {} // Remove Content-Type to let browser set it for FormData
    });
  },

  // Multi-modal processing (voice + image)
  processMultiModal: async (audioFile: File, imageFile: File) => {
    const formData = new FormData();
    formData.append('audio', audioFile);
    formData.append('image', imageFile);

    return apiCall('/api/inventory/multimodal', {
      method: 'POST',
      body: formData,
      headers: {} // Remove Content-Type to let browser set it for FormData
    });
  },

  // Receipt processing for inventory updates
  processReceipt: async (receiptImage: File) => {
    const formData = new FormData();
    formData.append('file', receiptImage);

    return apiCall('/api/inventory/receipt-processing', {
      method: 'POST',
      body: formData,
      headers: {} // Remove Content-Type to let browser set it for FormData
    });
  },

  // Intelligent suggestions
  getSuggestions: async (type: 'products' | 'categories' | 'suppliers' | 'historical', query: string, context?: any) => {
    const params = new URLSearchParams({
      type,
      query,
      ...(context && { context: JSON.stringify(context) })
    });

    return apiCall(`/api/inventory/suggestions?${params}`);
  },

  // Business intelligence
  getBusinessInsights: async () => {
    return apiCall('/api/inventory/business-insights');
  },

  getReorderRecommendations: async () => {
    return apiCall('/api/inventory/reorder-recommendations');
  },

  getSeasonalPredictions: async (targetMonth: number) => {
    return apiCall(`/api/inventory/seasonal-predictions?target_month=${targetMonth}`);
  },

  getSlowMovingItems: async () => {
    return apiCall('/api/inventory/slow-movers');
  },

  getAnalyticsDashboard: async (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const queryString = params.toString();
    return apiCall(`/api/inventory/analytics-dashboard${queryString ? '?' + queryString : ''}`);
  },

  getAIOptimizationSuggestions: async () => {
    return apiCall('/api/inventory/ai-optimization', {
      method: 'POST',
    });
  },

  // Batch processing
  processBatchUpdate: async (batchData: any[]) => {
    return apiCall('/api/inventory/batch-processing', {
      method: 'POST',
      body: JSON.stringify({ batch_data: batchData }),
    });
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
  // Format date range for display
  formatDateRange: (firstDate: string | null, lastDate: string | null, monthName: string) => {
    if (!firstDate || !lastDate) {
      return monthName;
    }
    
    const first = new Date(firstDate);
    const last = new Date(lastDate);
    
    // If same date, just show the single date
    if (firstDate === lastDate) {
      return `${monthName} ${last.getDate()}`;
    }
    
    // If different dates, show range
    const firstDay = first.getDate();
    const lastDay = last.getDate();
    
    return `${monthName} ${firstDay}-${lastDay}`;
  },

  // Extract current month revenue from earnings summary
  getCurrentMonthRevenue: (summaryData: any) => {
    try {
      const monthlyTotals = summaryData?.summary?.monthly_totals || summaryData?.monthly_totals;
      if (monthlyTotals && monthlyTotals.length > 0) {
        const monthData = monthlyTotals[0];
        // First item is the most recent month
        return {
          amount: Number(monthData.total_income) || 0,
          source: 'calculated',
          monthName: monthData.month_name || monthData.month,
          daysRecorded: monthData.days_recorded || 0,
          growthPercentage: Number(monthData.growth_percentage) || 0,
          firstEntryDate: monthData.first_entry_date || null,
          lastEntryDate: monthData.last_entry_date || null,
          dateRange: monthlyRevenueHelpers.formatDateRange(
            monthData.first_entry_date, 
            monthData.last_entry_date, 
            monthData.month_name || monthData.month
          )
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
      growthPercentage: 0,
      firstEntryDate: null,
      lastEntryDate: null,
      dateRange: new Date().toLocaleString('default', { month: 'long' })
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
  // Get detailed month comparison with Supabase fallback
  getDetailedComparison: async (month: string, compareWith?: string, type: 'month' | 'quarter' | 'year' = 'month') => {
    try {
      // Try backend API first
      const params = new URLSearchParams({ month, type });
      if (compareWith) params.append('compare_with', compareWith);
      return await apiCall(`/api/comparison/detailed?${params}`);
    } catch (error) {
      console.log('Backend API failed, using Supabase fallback for comparison');
      
      // Fallback to direct Supabase calculation
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Get current month data
      const [year, m] = month.split("-").map(Number);
      const startOfMonth = `${year}-${String(m).padStart(2, "0")}-01`;
      const endOfMonth = new Date(year, m, 0).toISOString().split('T')[0];
      
      // Get previous month
      const prevMonth = m === 1 ? 12 : m - 1;
      const prevYear = m === 1 ? year - 1 : year;
      const prevStartOfMonth = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
      const prevEndOfMonth = new Date(prevYear, prevMonth, 0).toISOString().split('T')[0];
      
      // Fetch both months data
      const [currentData, previousData] = await Promise.all([
        supabase
          .from('earnings')
          .select('*')
          .eq('user_id', user.id)
          .gte('earning_date', startOfMonth)
          .lte('earning_date', endOfMonth),
        supabase
          .from('earnings')
          .select('*')
          .eq('user_id', user.id)
          .gte('earning_date', prevStartOfMonth)
          .lte('earning_date', prevEndOfMonth)
      ]);
      
      if (currentData.error || previousData.error) {
        throw new Error('Failed to fetch earnings data');
      }
      
      // Calculate metrics for both months
      const calculateMetrics = (earnings: any[]) => {
        const revenue = earnings?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
        const expenses = earnings?.reduce((sum, e) => sum + (e.inventory_cost || 0), 0) || 0;
        const profit = revenue - expenses;
        const daysRecorded = earnings?.length || 0;
        
        return {
          revenue,
          expenses,
          profit,
          profit_margin: revenue > 0 ? (profit / revenue) * 100 : 0,
          days_recorded: daysRecorded
        };
      };
      
      const current = calculateMetrics(currentData.data || []);
      const previous = calculateMetrics(previousData.data || []);
      
      // Calculate changes
      const safePercentChange = (curr: number, prev: number) => {
        if (prev === 0) return curr > 0 ? 100 : 0;
        return ((curr - prev) / prev) * 100;
      };
      
      const changes = {
        revenue: {
          absolute: current.revenue - previous.revenue,
          percentage: safePercentChange(current.revenue, previous.revenue)
        },
        expenses: {
          absolute: current.expenses - previous.expenses,
          percentage: safePercentChange(current.expenses, previous.expenses)
        },
        profit: {
          absolute: current.profit - previous.profit,
          percentage: safePercentChange(current.profit, previous.profit)
        },
        profit_margin: {
          absolute: current.profit_margin - previous.profit_margin,
          percentage: safePercentChange(current.profit_margin, previous.profit_margin)
        }
      };
      
      // Generate basic insights
      const insights = [];
      if (changes.revenue.percentage > 10) {
        insights.push({
          type: "success",
          title: "Strong Revenue Growth",
          message: `Revenue increased by ${changes.revenue.percentage.toFixed(1)}% (₹${changes.revenue.absolute.toLocaleString()})`,
          priority: "high"
        });
      } else if (changes.revenue.percentage < -10) {
        insights.push({
          type: "warning",
          title: "Revenue Decline",
          message: `Revenue decreased by ${Math.abs(changes.revenue.percentage).toFixed(1)}% (₹${Math.abs(changes.revenue.absolute).toLocaleString()})`,
          priority: "high"
        });
      }
      
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      
      return {
        success: true,
        data: {
          current: {
            month,
            month_name: monthNames[m - 1] + ' ' + year,
            ...current
          },
          previous: {
            month: `${prevYear}-${String(prevMonth).padStart(2, "0")}`,
            month_name: monthNames[prevMonth - 1] + ' ' + prevYear,
            ...previous
          },
          changes,
          insights
        }
      };
    }
  },

  // Get multi-month comparison
  getMultiMonthComparison: async (months: string[]) => {
    if (months.length < 2 || months.length > 6) {
      throw new Error('Please provide 2-6 months for comparison');
    }
    return apiCall(`/api/comparison/multi-month?months=${months.join(',')}`);
  },

  // Get custom range comparison
  getCustomRangeComparison: async (start: string, end: string, compareWithStart: string, compareWithEnd: string) => {
    const params = new URLSearchParams({
      start,
      end,
      compare_with_start: compareWithStart,
      compare_with_end: compareWithEnd
    });
    return apiCall(`/api/comparison/custom-range?${params}`);
  },

  // Get quarter comparison
  getQuarterComparison: async (month: string) => {
    return apiCall(`/api/comparison/detailed?month=${month}&type=quarter`);
  },

  // Get year-over-year comparison
  getYearOverYearComparison: async (month: string) => {
    return apiCall(`/api/comparison/detailed?month=${month}&type=year`);
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

// Advanced comparison helpers
export const comparisonHelpers = {
  // Generate month options for comparison
  getMonthOptions: (userCreatedAt?: string, maxMonths: number = 12) => {
    const options = [];
    const now = new Date();
    
    let startDate: Date;
    if (userCreatedAt) {
      const creationDate = new Date(userCreatedAt);
      startDate = new Date(creationDate.getFullYear(), creationDate.getMonth(), 1);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth() - maxMonths, 1);
    }
    
    const endDate = new Date(now.getFullYear(), now.getMonth(), 1);
    
    for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      const isCurrent = value === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      options.push({ value, label, isCurrent });
    }
    
    return options.reverse();
  },

  // Get quarter months
  getQuarterMonths: (year: number, quarter: number) => {
    const startMonth = (quarter - 1) * 3 + 1;
    return [
      `${year}-${String(startMonth).padStart(2, '0')}`,
      `${year}-${String(startMonth + 1).padStart(2, '0')}`,
      `${year}-${String(startMonth + 2).padStart(2, '0')}`
    ];
  },

  // Get comparison period suggestions
  getComparisonSuggestions: (selectedMonth: string) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    
    return {
      previousMonth: {
        value: `${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, '0')}`,
        label: 'Previous Month'
      },
      sameMonthLastYear: {
        value: `${year - 1}-${String(month).padStart(2, '0')}`,
        label: 'Same Month Last Year'
      },
      previousQuarter: {
        value: `${month <= 3 ? year - 1 : year}-${String(month <= 3 ? month + 9 : month - 3).padStart(2, '0')}`,
        label: 'Previous Quarter'
      }
    };
  },

  // Format comparison results for display
  formatComparisonData: (data: any) => {
    const formatCurrency = (value: number) => `₹${value.toLocaleString()}`;
    const formatPercentage = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
    
    return {
      ...data,
      formatted: {
        current: {
          ...data.current,
          revenue_formatted: formatCurrency(data.current.revenue),
          profit_formatted: formatCurrency(data.current.profit),
          expenses_formatted: formatCurrency(data.current.expenses)
        },
        previous: {
          ...data.previous,
          revenue_formatted: formatCurrency(data.previous.revenue),
          profit_formatted: formatCurrency(data.previous.profit),
          expenses_formatted: formatCurrency(data.previous.expenses)
        },
        changes: {
          revenue: {
            ...data.changes.revenue,
            absolute_formatted: formatCurrency(data.changes.revenue.absolute),
            percentage_formatted: formatPercentage(data.changes.revenue.percentage)
          },
          profit: {
            ...data.changes.profit,
            absolute_formatted: formatCurrency(data.changes.profit.absolute),
            percentage_formatted: formatPercentage(data.changes.profit.percentage)
          },
          expenses: {
            ...data.changes.expenses,
            absolute_formatted: formatCurrency(data.changes.expenses.absolute),
            percentage_formatted: formatPercentage(data.changes.expenses.percentage)
          }
        }
      }
    };
  }
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