const { getAuthenticatedClient } = require("../config/supabase");
const { openai } = require("../config/openai");

/**
 * Inventory Business Intelligence Service
 * Provides personalized insights, predictions, and recommendations
 */
class InventoryBusinessIntelligenceService {
  constructor() {
    this.seasonalPatterns = {
      winter: { months: [11, 0, 1], multiplier: 1.2 },
      summer: { months: [2, 3, 4, 5], multiplier: 1.1 },
      monsoon: { months: [6, 7, 8, 9], multiplier: 0.9 },
      festival: { 
        diwali: { months: [9, 10], multiplier: 1.5 },
        holi: { months: [2, 3], multiplier: 1.3 },
        eid: { months: [4, 5, 6], multiplier: 1.4 }
      }
    };
  }

  /**
   * Generate personalized inventory insights
   */
  async generatePersonalizedInsights(userId, supabase) {
    try {
      // Gather comprehensive inventory data
      const inventoryData = await this.gatherInventoryData(userId, supabase);
      
      // Generate different types of insights
      const insights = {
        overview: await this.generateOverviewInsights(inventoryData),
        stock_analysis: await this.generateStockAnalysis(inventoryData),
        financial_insights: await this.generateFinancialInsights(inventoryData),
        operational_insights: await this.generateOperationalInsights(inventoryData),
        predictive_insights: await this.generatePredictiveInsights(inventoryData, userId, supabase),
        recommendations: await this.generateActionableRecommendations(inventoryData, userId, supabase)
      };

      // Store insights for learning
      await this.storeInsightsForLearning(userId, insights, supabase);

      return {
        success: true,
        insights,
        generated_at: new Date().toISOString(),
        data_period: inventoryData.period
      };

    } catch (error) {
      console.error("Error generating personalized insights:", error);
      throw error;
    }
  }

  /**
   * Generate reorder level recommendations based on historical usage
   */
  async generateReorderRecommendations(userId, supabase) {
    try {
      const recommendations = [];

      // Get all inventory items with movement history
      const { data: items, error: itemsError } = await supabase
        .from("inventory_items")
        .select("id, product_name, unit, category")
        .eq("user_id", userId);

      if (itemsError || !items) {
        throw new Error("Failed to fetch inventory items");
      }

      for (const item of items) {
        const reorderAnalysis = await this.analyzeReorderNeeds(item, userId, supabase);
        if (reorderAnalysis.needs_reorder) {
          recommendations.push(reorderAnalysis);
        }
      }

      // Sort by urgency
      recommendations.sort((a, b) => b.urgency_score - a.urgency_score);

      return {
        success: true,
        recommendations: recommendations.slice(0, 20), // Top 20 most urgent
        total_items_analyzed: items.length,
        items_needing_reorder: recommendations.length
      };

    } catch (error) {
      console.error("Error generating reorder recommendations:", error);
      throw error;
    }
  }

  /**
   * Predict seasonal demand changes
   */
  async predictSeasonalDemand(userId, targetMonth, supabase) {
    try {
      const predictions = [];
      const currentMonth = new Date().getMonth();

      // Get historical data for seasonal analysis
      const historicalData = await this.getHistoricalSeasonalData(userId, supabase);

      for (const [productId, productData] of Object.entries(historicalData)) {
        const seasonalPrediction = this.calculateSeasonalPrediction(
          productData, currentMonth, targetMonth
        );
        
        if (seasonalPrediction.confidence > 0.6) {
          predictions.push(seasonalPrediction);
        }
      }

      return {
        success: true,
        target_month: targetMonth,
        predictions: predictions.sort((a, b) => b.predicted_change - a.predicted_change),
        confidence_threshold: 0.6
      };

    } catch (error) {
      console.error("Error predicting seasonal demand:", error);
      throw error;
    }
  }

  /**
   * Identify slow-moving inventory
   */
  async identifySlowMovingInventory(userId, supabase) {
    try {
      const slowMovers = [];
      const thresholdDays = 30; // Items with no movement in 30 days
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - thresholdDays);

      // Get items with their last movement dates
      const { data: itemsWithMovements, error } = await supabase
        .from("inventory_items")
        .select(`
          id, product_name, unit, category, custom_attributes,
          inventory_stock_ledger (
            created_at, direction, quantity
          )
        `)
        .eq("user_id", userId);

      if (error || !itemsWithMovements) {
        throw new Error("Failed to fetch inventory movement data");
      }

      for (const item of itemsWithMovements) {
        const analysis = this.analyzeItemMovement(item, thresholdDate);
        
        if (analysis.is_slow_moving) {
          const recommendations = await this.generateSlowMoverRecommendations(
            item, analysis, userId, supabase
          );
          
          slowMovers.push({
            ...item,
            movement_analysis: analysis,
            recommendations
          });
        }
      }

      return {
        success: true,
        slow_moving_items: slowMovers,
        threshold_days: thresholdDays,
        total_items_analyzed: itemsWithMovements.length
      };

    } catch (error) {
      console.error("Error identifying slow-moving inventory:", error);
      throw error;
    }
  }

  /**
   * Generate user-specific analytics dashboard data
   */
  async generateAnalyticsDashboard(userId, dateRange, supabase) {
    try {
      const analytics = {
        summary: await this.generateSummaryMetrics(userId, dateRange, supabase),
        trends: await this.generateTrendAnalysis(userId, dateRange, supabase),
        categories: await this.generateCategoryAnalysis(userId, dateRange, supabase),
        suppliers: await this.generateSupplierAnalysis(userId, dateRange, supabase),
        efficiency: await this.generateEfficiencyMetrics(userId, dateRange, supabase),
        alerts: await this.generateAlerts(userId, supabase)
      };

      return {
        success: true,
        analytics,
        date_range: dateRange,
        generated_at: new Date().toISOString()
      };

    } catch (error) {
      console.error("Error generating analytics dashboard:", error);
      throw error;
    }
  }

  /**
   * AI-powered inventory optimization suggestions
   */
  async generateAIOptimizationSuggestions(userId, supabase) {
    try {
      // Gather comprehensive data for AI analysis
      const inventoryData = await this.gatherInventoryData(userId, supabase);
      const businessContext = await this.getBusinessContext(userId, supabase);

      // Create AI prompt for optimization suggestions
      const prompt = this.createOptimizationPrompt(inventoryData, businessContext);

      // Get AI suggestions
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert inventory management consultant for Indian SMBs. Provide specific, actionable recommendations based on the user's actual inventory data and business context."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500
      });

      const suggestions = this.parseAISuggestions(aiResponse.choices[0].message.content);

      return {
        success: true,
        ai_suggestions: suggestions,
        confidence: 0.8,
        generated_at: new Date().toISOString()
      };

    } catch (error) {
      console.error("Error generating AI optimization suggestions:", error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  async gatherInventoryData(userId, supabase) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [itemsResult, movementsResult, categoriesResult] = await Promise.all([
      supabase
        .from("inventory_items")
        .select("*")
        .eq("user_id", userId),
      
      supabase
        .from("inventory_stock_ledger")
        .select("*")
        .eq("user_id", userId)
        .gte("created_at", thirtyDaysAgo.toISOString()),
      
      supabase
        .from("user_categories")
        .select("*")
        .eq("user_id", userId)
    ]);

    return {
      items: itemsResult.data || [],
      movements: movementsResult.data || [],
      categories: categoriesResult.data || [],
      period: {
        start: thirtyDaysAgo.toISOString(),
        end: new Date().toISOString()
      }
    };
  }

  async generateOverviewInsights(inventoryData) {
    const totalItems = inventoryData.items.length;
    const totalMovements = inventoryData.movements.length;
    const activeItems = new Set(inventoryData.movements.map(m => m.item_id)).size;
    
    // Calculate current stock levels
    const stockLevels = this.calculateCurrentStockLevels(inventoryData);
    const lowStockItems = Object.values(stockLevels).filter(item => item.current_stock <= 0).length;

    return {
      total_products: totalItems,
      active_products: activeItems,
      inactive_products: totalItems - activeItems,
      total_movements: totalMovements,
      low_stock_items: lowStockItems,
      stock_health_score: this.calculateStockHealthScore(stockLevels)
    };
  }

  async generateStockAnalysis(inventoryData) {
    const stockLevels = this.calculateCurrentStockLevels(inventoryData);
    
    const analysis = {
      out_of_stock: [],
      low_stock: [],
      healthy_stock: [],
      overstock: []
    };

    for (const [itemId, stockData] of Object.entries(stockLevels)) {
      if (stockData.current_stock <= 0) {
        analysis.out_of_stock.push(stockData);
      } else if (stockData.current_stock <= stockData.reorder_level) {
        analysis.low_stock.push(stockData);
      } else if (stockData.current_stock > stockData.max_level) {
        analysis.overstock.push(stockData);
      } else {
        analysis.healthy_stock.push(stockData);
      }
    }

    return analysis;
  }

  async generateFinancialInsights(inventoryData) {
    // This would calculate inventory value, turnover rates, etc.
    // Simplified implementation
    return {
      total_inventory_value: 0, // Would calculate from cost prices
      turnover_rate: 0, // Would calculate from movements
      dead_stock_value: 0, // Would calculate from slow movers
      optimization_potential: 0 // Potential savings
    };
  }

  async generateOperationalInsights(inventoryData) {
    const movementsByDay = this.groupMovementsByDay(inventoryData.movements);
    const avgDailyMovements = Object.values(movementsByDay).reduce((a, b) => a + b, 0) / Object.keys(movementsByDay).length;

    return {
      avg_daily_movements: avgDailyMovements,
      busiest_day: this.findBusiestDay(movementsByDay),
      movement_patterns: this.analyzeMovementPatterns(inventoryData.movements),
      efficiency_score: this.calculateEfficiencyScore(inventoryData)
    };
  }

  async generatePredictiveInsights(inventoryData, userId, supabase) {
    // Simplified predictive analysis
    const predictions = [];
    
    for (const item of inventoryData.items) {
      const itemMovements = inventoryData.movements.filter(m => m.item_id === item.id);
      if (itemMovements.length >= 3) {
        const prediction = this.predictItemDemand(item, itemMovements);
        predictions.push(prediction);
      }
    }

    return {
      demand_predictions: predictions.slice(0, 10),
      seasonal_adjustments: await this.getSeasonalAdjustments(userId, supabase),
      trend_analysis: this.analyzeTrends(inventoryData.movements)
    };
  }

  async generateActionableRecommendations(inventoryData, userId, supabase) {
    const recommendations = [];

    // Reorder recommendations
    const reorderRecs = await this.generateReorderRecommendations(userId, supabase);
    recommendations.push(...reorderRecs.recommendations.slice(0, 5));

    // Category optimization
    const categoryRecs = this.generateCategoryOptimizationRecommendations(inventoryData);
    recommendations.push(...categoryRecs);

    // Supplier optimization
    const supplierRecs = await this.generateSupplierOptimizationRecommendations(userId, supabase);
    recommendations.push(...supplierRecs);

    return recommendations.sort((a, b) => b.priority - a.priority).slice(0, 10);
  }

  async analyzeReorderNeeds(item, userId, supabase) {
    // Get movement history for this item
    const { data: movements, error } = await supabase
      .from("inventory_stock_ledger")
      .select("*")
      .eq("user_id", userId)
      .eq("item_id", item.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !movements) {
      return { needs_reorder: false, reason: "No movement data" };
    }

    // Calculate current stock
    const currentStock = this.calculateCurrentStock(movements);
    
    // Calculate average usage rate
    const usageRate = this.calculateUsageRate(movements);
    
    // Calculate lead time (simplified)
    const leadTime = 7; // days
    
    // Calculate reorder point
    const reorderPoint = usageRate * leadTime * 1.2; // 20% safety stock

    const needsReorder = currentStock <= reorderPoint;
    const urgencyScore = needsReorder ? (reorderPoint - currentStock) / reorderPoint : 0;

    return {
      item_id: item.id,
      product_name: item.product_name,
      current_stock: currentStock,
      usage_rate: usageRate,
      reorder_point: reorderPoint,
      suggested_quantity: usageRate * 30, // 30 days supply
      needs_reorder: needsReorder,
      urgency_score: urgencyScore,
      days_until_stockout: currentStock / (usageRate || 1)
    };
  }

  calculateCurrentStock(movements) {
    return movements.reduce((stock, movement) => {
      return movement.direction === 'in' 
        ? stock + Number(movement.quantity)
        : stock - Number(movement.quantity);
    }, 0);
  }

  calculateUsageRate(movements) {
    const outMovements = movements.filter(m => m.direction === 'out');
    if (outMovements.length === 0) return 0;

    const totalOut = outMovements.reduce((sum, m) => sum + Number(m.quantity), 0);
    const daysCovered = this.calculateDaysCovered(outMovements);
    
    return daysCovered > 0 ? totalOut / daysCovered : 0;
  }

  calculateDaysCovered(movements) {
    if (movements.length === 0) return 0;
    
    const oldest = new Date(movements[movements.length - 1].created_at);
    const newest = new Date(movements[0].created_at);
    
    return Math.max(1, Math.ceil((newest - oldest) / (1000 * 60 * 60 * 24)));
  }

  calculateCurrentStockLevels(inventoryData) {
    const stockLevels = {};
    
    for (const item of inventoryData.items) {
      const itemMovements = inventoryData.movements.filter(m => m.item_id === item.id);
      const currentStock = this.calculateCurrentStock(itemMovements);
      
      stockLevels[item.id] = {
        ...item,
        current_stock: currentStock,
        reorder_level: 5, // Simplified
        max_level: 100 // Simplified
      };
    }
    
    return stockLevels;
  }

  calculateStockHealthScore(stockLevels) {
    const items = Object.values(stockLevels);
    if (items.length === 0) return 0;

    const healthyItems = items.filter(item => 
      item.current_stock > 0 && item.current_stock <= item.max_level
    ).length;

    return (healthyItems / items.length) * 100;
  }

  // Additional helper methods would be implemented here...
  groupMovementsByDay(movements) {
    const grouped = {};
    for (const movement of movements) {
      const day = new Date(movement.created_at).toDateString();
      grouped[day] = (grouped[day] || 0) + 1;
    }
    return grouped;
  }

  findBusiestDay(movementsByDay) {
    return Object.entries(movementsByDay)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'No data';
  }

  analyzeMovementPatterns(movements) {
    const inMovements = movements.filter(m => m.direction === 'in').length;
    const outMovements = movements.filter(m => m.direction === 'out').length;
    
    return {
      total_in: inMovements,
      total_out: outMovements,
      ratio: inMovements > 0 ? outMovements / inMovements : 0
    };
  }

  calculateEfficiencyScore(inventoryData) {
    // Simplified efficiency calculation
    const activeItems = new Set(inventoryData.movements.map(m => m.item_id)).size;
    const totalItems = inventoryData.items.length;
    
    return totalItems > 0 ? (activeItems / totalItems) * 100 : 0;
  }

  async storeInsightsForLearning(userId, insights, supabase) {
    try {
      await supabase
        .from("generated_insights")
        .insert({
          user_id: userId,
          insights_data: insights,
          generated_at: new Date().toISOString()
        });
    } catch (error) {
      console.error("Error storing insights for learning:", error);
    }
  }

  createOptimizationPrompt(inventoryData, businessContext) {
    return `
Analyze this Indian SMB's inventory data and provide specific optimization recommendations:

Business Context:
- Business Type: ${businessContext.business_type || 'General Retail'}
- Location: ${businessContext.location || 'India'}
- Monthly Revenue: ₹${businessContext.monthly_revenue || 'Not specified'}

Inventory Summary:
- Total Products: ${inventoryData.items.length}
- Recent Movements: ${inventoryData.movements.length}
- Categories: ${inventoryData.categories.length}

Key Issues to Address:
1. Stock optimization (overstocking/understocking)
2. Category management
3. Supplier efficiency
4. Seasonal planning
5. Cost reduction opportunities

Provide 5-7 specific, actionable recommendations with expected impact and implementation steps.
`;
  }

  parseAISuggestions(aiContent) {
    // Parse AI response into structured suggestions
    const suggestions = [];
    const lines = aiContent.split('\n').filter(line => line.trim());
    
    let currentSuggestion = null;
    
    for (const line of lines) {
      if (line.match(/^\d+\./)) {
        if (currentSuggestion) {
          suggestions.push(currentSuggestion);
        }
        currentSuggestion = {
          title: line.replace(/^\d+\.\s*/, ''),
          description: '',
          priority: 'medium',
          category: 'optimization'
        };
      } else if (currentSuggestion && line.trim()) {
        currentSuggestion.description += line.trim() + ' ';
      }
    }
    
    if (currentSuggestion) {
      suggestions.push(currentSuggestion);
    }
    
    return suggestions;
  }

  async getBusinessContext(userId, supabase) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("business_type, location, monthly_revenue")
      .eq("id", userId)
      .single();

    return profile || {};
  }

  // Additional methods for seasonal analysis, trend prediction, etc. would be implemented here...
}

module.exports = { InventoryBusinessIntelligenceService };