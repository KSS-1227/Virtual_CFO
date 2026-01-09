const { getAuthenticatedClient } = require('../config/supabase');
const { generateCompletion } = require('./openai');
const redisService = require('./redisService');

class SmartSuggestionsService {
  constructor() {
    this.cache = new Map();
    this.suggestionTypes = {
      PRODUCT_NAME: 'product_name',
      CATEGORY: 'category',
      SUPPLIER: 'supplier',
      LOCATION: 'location',
      REORDER_POINT: 'reorder_point'
    };
  }

  // Smart autocomplete with learning
  async getSmartSuggestions(userId, type, query, context = {}) {
    try {
      const cacheKey = `suggestions:${userId}:${type}:${query}`;
      
      // Check cache first
      const cached = await redisService.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const supabase = getAuthenticatedClient();
      
      // Get user's historical data
      const { data: history } = await supabase
        .from('inventory_items')
        .select('product_name, category, brand, unit')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      // Get learning patterns (fallback to empty if table doesn't exist)
      let patterns = [];
      try {
        const { data: patternsData } = await supabase
          .from('inventory_learning_patterns')
          .select('*')
          .eq('user_id', userId)
          .eq('pattern_type', type);
        patterns = patternsData || [];
      } catch (error) {
        console.log('Learning patterns table not available, using fallback');
        patterns = [];
      }

      let suggestions = [];

      switch (type) {
        case this.suggestionTypes.PRODUCT_NAME:
          suggestions = await this.generateProductNameSuggestions(query, history, patterns, context);
          break;
        case this.suggestionTypes.CATEGORY:
          suggestions = await this.generateCategorySuggestions(query, history, patterns);
          break;
        case this.suggestionTypes.SUPPLIER:
          suggestions = await this.generateSupplierSuggestions(query, history, patterns);
          break;
        case this.suggestionTypes.LOCATION:
          suggestions = await this.generateLocationSuggestions(query, history, patterns);
          break;
        case this.suggestionTypes.REORDER_POINT:
          suggestions = await this.generateReorderSuggestions(query, history, context);
          break;
      }

      // Cache results
      await redisService.setex(cacheKey, 300, JSON.stringify(suggestions)); // 5 min cache

      return suggestions;
    } catch (error) {
      console.error('Smart suggestions error:', error);
      return [];
    }
  }

  async generateProductNameSuggestions(query, history, patterns, context) {
    const suggestions = [];
    
    // Fuzzy match from history
    const fuzzyMatches = history
      .filter(item => item.product_name && item.product_name.toLowerCase().includes(query.toLowerCase()))
      .map(item => ({
        text: item.product_name,
        confidence: this.calculateFuzzyScore(query, item.product_name),
        source: 'history',
        metadata: { category: item.category, brand: item.brand }
      }))
      .slice(0, 5);

    suggestions.push(...fuzzyMatches);

    // AI-powered suggestions based on context
    if (context.category || context.supplier) {
      const aiSuggestions = await this.generateAISuggestions(query, context, history);
      suggestions.push(...aiSuggestions);
    }

    // Pattern-based suggestions
    const patternSuggestions = patterns
      .filter(p => p.pattern_data.query_patterns?.includes(query.toLowerCase()))
      .map(p => ({
        text: p.pattern_data.suggested_value,
        confidence: p.confidence_score,
        source: 'pattern',
        metadata: p.pattern_data.metadata
      }));

    suggestions.push(...patternSuggestions);

    return this.rankAndDeduplicate(suggestions);
  }

  async generateCategorySuggestions(query, history, patterns) {
    const suggestions = [];
    
    // Extract unique categories from history
    const categories = [...new Set(history.map(item => item.category).filter(Boolean))];
    
    const categoryMatches = categories
      .filter(cat => cat.toLowerCase().includes(query.toLowerCase()))
      .map(cat => ({
        text: cat,
        confidence: this.calculateFuzzyScore(query, cat),
        source: 'history',
        metadata: { usage_count: history.filter(h => h.category === cat).length }
      }));

    suggestions.push(...categoryMatches);

    // Standard business categories
    const standardCategories = [
      'Electronics', 'Clothing', 'Food & Beverages', 'Office Supplies',
      'Raw Materials', 'Finished Goods', 'Tools & Equipment', 'Packaging'
    ];

    const standardMatches = standardCategories
      .filter(cat => cat.toLowerCase().includes(query.toLowerCase()))
      .map(cat => ({
        text: cat,
        confidence: this.calculateFuzzyScore(query, cat),
        source: 'standard',
        metadata: { type: 'standard_category' }
      }));

    suggestions.push(...standardMatches);

    return this.rankAndDeduplicate(suggestions);
  }

  async generateSupplierSuggestions(query, history, patterns) {
    const suggestions = [];
    
    // Extract suppliers from history with performance metrics
    const suppliers = history.reduce((acc, item) => {
      if (item.supplier) {
        if (!acc[item.supplier]) {
          acc[item.supplier] = { count: 0, items: [] };
        }
        acc[item.supplier].count++;
        acc[item.supplier].items.push(item);
      }
      return acc;
    }, {});

    const supplierMatches = Object.entries(suppliers)
      .filter(([supplier]) => supplier.toLowerCase().includes(query.toLowerCase()))
      .map(([supplier, data]) => ({
        text: supplier,
        confidence: this.calculateFuzzyScore(query, supplier),
        source: 'history',
        metadata: {
          order_count: data.count,
          categories: [...new Set(data.items.map(i => i.category))],
          reliability_score: this.calculateSupplierReliability(data.items)
        }
      }));

    suggestions.push(...supplierMatches);

    return this.rankAndDeduplicate(suggestions);
  }

  async generateLocationSuggestions(query, history, patterns) {
    const suggestions = [];
    
    // Extract locations from history
    const locations = [...new Set(history.map(item => item.location).filter(Boolean))];
    
    const locationMatches = locations
      .filter(loc => loc.toLowerCase().includes(query.toLowerCase()))
      .map(loc => ({
        text: loc,
        confidence: this.calculateFuzzyScore(query, loc),
        source: 'history',
        metadata: { usage_count: history.filter(h => h.location === loc).length }
      }));

    suggestions.push(...locationMatches);

    // Standard warehouse locations
    const standardLocations = [
      'Warehouse A', 'Warehouse B', 'Main Storage', 'Cold Storage',
      'Shelf A1', 'Shelf A2', 'Ground Floor', 'First Floor'
    ];

    const standardMatches = standardLocations
      .filter(loc => loc.toLowerCase().includes(query.toLowerCase()))
      .map(loc => ({
        text: loc,
        confidence: this.calculateFuzzyScore(query, loc),
        source: 'standard',
        metadata: { type: 'standard_location' }
      }));

    suggestions.push(...standardMatches);

    return this.rankAndDeduplicate(suggestions);
  }

  async generateReorderSuggestions(query, history, context) {
    if (!context.productName) return [];

    // Find similar products
    const similarProducts = history.filter(item => 
      item.name.toLowerCase().includes(context.productName.toLowerCase()) ||
      item.category === context.category
    );

    if (similarProducts.length === 0) return [];

    // Calculate average reorder point
    const avgReorderPoint = Math.round(
      similarProducts.reduce((sum, item) => sum + (item.reorder_point || 0), 0) / similarProducts.length
    );

    // AI-powered reorder calculation
    const aiRecommendation = await this.calculateAIReorderPoint(context, similarProducts);

    return [
      {
        text: avgReorderPoint.toString(),
        confidence: 0.8,
        source: 'historical_average',
        metadata: { 
          based_on: similarProducts.length,
          range: `${Math.min(...similarProducts.map(p => p.reorder_point || 0))}-${Math.max(...similarProducts.map(p => p.reorder_point || 0))}`
        }
      },
      {
        text: aiRecommendation.toString(),
        confidence: 0.9,
        source: 'ai_calculation',
        metadata: { 
          factors: ['demand_velocity', 'seasonality', 'lead_time'],
          explanation: 'AI-calculated based on usage patterns'
        }
      }
    ];
  }

  async generateAISuggestions(query, context, history) {
    try {
      const prompt = `Based on the following context, suggest 3 relevant product names for "${query}":
      
Context:
- Category: ${context.category || 'Not specified'}
- Supplier: ${context.supplier || 'Not specified'}
- Business type: ${context.businessType || 'General'}

Historical products: ${history.slice(0, 10).map(h => h.name).join(', ')}

Provide suggestions that are:
1. Relevant to the query
2. Appropriate for the category/supplier
3. Commonly used in business

Format: Just list 3 product names, one per line.`;

      const response = await generateCompletion(prompt, { max_tokens: 100 });
      
      return response.split('\n')
        .filter(line => line.trim())
        .slice(0, 3)
        .map(suggestion => ({
          text: suggestion.trim().replace(/^\d+\.\s*/, ''),
          confidence: 0.7,
          source: 'ai_generated',
          metadata: { context_used: true }
        }));
    } catch (error) {
      console.error('AI suggestion generation error:', error);
      return [];
    }
  }

  calculateFuzzyScore(query, target) {
    const q = query.toLowerCase();
    const t = target.toLowerCase();
    
    if (t === q) return 1.0;
    if (t.startsWith(q)) return 0.9;
    if (t.includes(q)) return 0.7;
    
    // Levenshtein distance based scoring
    const distance = this.levenshteinDistance(q, t);
    const maxLength = Math.max(q.length, t.length);
    return Math.max(0, 1 - (distance / maxLength));
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  calculateSupplierReliability(items) {
    // Simple reliability score based on consistency
    const avgQuantity = items.reduce((sum, item) => sum + item.quantity, 0) / items.length;
    const variance = items.reduce((sum, item) => sum + Math.pow(item.quantity - avgQuantity, 2), 0) / items.length;
    return Math.max(0.1, 1 - (variance / (avgQuantity * avgQuantity)));
  }

  async calculateAIReorderPoint(context, similarProducts) {
    const avgQuantity = similarProducts.reduce((sum, item) => sum + item.quantity, 0) / similarProducts.length;
    const avgReorder = similarProducts.reduce((sum, item) => sum + (item.reorder_point || 0), 0) / similarProducts.length;
    
    // Simple AI calculation - can be enhanced with more sophisticated ML
    const baseReorder = Math.max(avgReorder, avgQuantity * 0.2);
    const seasonalFactor = context.seasonal ? 1.3 : 1.0;
    const demandFactor = context.highDemand ? 1.5 : 1.0;
    
    return Math.round(baseReorder * seasonalFactor * demandFactor);
  }

  rankAndDeduplicate(suggestions) {
    // Remove duplicates
    const unique = suggestions.reduce((acc, suggestion) => {
      const existing = acc.find(s => s.text.toLowerCase() === suggestion.text.toLowerCase());
      if (!existing || existing.confidence < suggestion.confidence) {
        acc = acc.filter(s => s.text.toLowerCase() !== suggestion.text.toLowerCase());
        acc.push(suggestion);
      }
      return acc;
    }, []);

    // Sort by confidence and source priority
    return unique
      .sort((a, b) => {
        const sourcePriority = { history: 3, pattern: 2, ai_generated: 1, standard: 0 };
        if (Math.abs(a.confidence - b.confidence) < 0.1) {
          return (sourcePriority[b.source] || 0) - (sourcePriority[a.source] || 0);
        }
        return b.confidence - a.confidence;
      })
      .slice(0, 8);
  }

  // Learn from user selections
  async recordUserSelection(userId, type, query, selectedSuggestion, context = {}) {
    try {
      const supabase = getAuthenticatedClient();
      
      await supabase.from('inventory_learning_patterns').upsert({
        user_id: userId,
        pattern_type: type,
        pattern_data: {
          query: query,
          selected_value: selectedSuggestion.text,
          context: context,
          confidence_improvement: selectedSuggestion.confidence < 0.8 ? 0.1 : 0.05
        },
        confidence_score: Math.min(1.0, selectedSuggestion.confidence + 0.1),
        usage_count: 1
      }, {
        onConflict: 'user_id,pattern_type,pattern_data->query',
        ignoreDuplicates: false
      });

      // Clear related cache
      const cachePattern = `suggestions:${userId}:${type}:*`;
      await redisService.deletePattern(cachePattern);
      
    } catch (error) {
      console.error('Error recording user selection:', error);
    }
  }
}

module.exports = new SmartSuggestionsService();