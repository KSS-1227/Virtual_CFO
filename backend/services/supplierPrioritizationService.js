const { getAuthenticatedClient } = require('../config/supabase');
const { generateCompletion } = require('./openai');
const redisService = require('./redisService');

class SupplierPrioritizationService {
  constructor() {
    this.performanceMetrics = {
      DELIVERY_TIME: 'delivery_time',
      QUALITY_SCORE: 'quality_score',
      PRICE_COMPETITIVENESS: 'price_competitiveness',
      RELIABILITY: 'reliability',
      COMMUNICATION: 'communication'
    };
    
    this.categoryTypes = {
      PRODUCT_BASED: 'product_based',
      SUPPLIER_BASED: 'supplier_based',
      SEASONAL: 'seasonal',
      DEMAND_BASED: 'demand_based',
      GEOGRAPHIC: 'geographic'
    };
  }

  // Get prioritized suppliers for a product/category
  async getPrioritizedSuppliers(userId, productName, category, context = {}) {
    try {
      const supabase = getAuthenticatedClient();
      
      // Get all suppliers for this user
      const { data: suppliers } = await supabase
        .from('supplier_profiles')
        .select('*')
        .eq('user_id', userId);

      if (!suppliers?.length) {
        return await this.generateInitialSupplierSuggestions(userId, productName, category);
      }

      // Calculate performance scores
      const scoredSuppliers = await Promise.all(
        suppliers.map(supplier => this.calculateSupplierScore(userId, supplier, productName, category, context))
      );

      // Sort by priority score
      const prioritized = scoredSuppliers
        .sort((a, b) => b.priorityScore - a.priorityScore)
        .map(supplier => ({
          ...supplier,
          recommendation: this.generateRecommendation(supplier),
          suitabilityReason: this.generateSuitabilityReason(supplier, productName, category)
        }));

      return {
        suppliers: prioritized,
        totalSuppliers: suppliers.length,
        topPerformer: prioritized[0],
        averageScore: scoredSuppliers.reduce((sum, s) => sum + s.priorityScore, 0) / scoredSuppliers.length,
        recommendations: await this.generateSupplierRecommendations(userId, prioritized, context)
      };
    } catch (error) {
      console.error('Supplier prioritization error:', error);
      return { suppliers: [], error: error.message };
    }
  }

  async calculateSupplierScore(userId, supplier, productName, category, context) {
    const supabase = getAuthenticatedClient();
    
    // Get historical performance data
    const { data: orders } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('user_id', userId)
      .eq('supplier', supplier.name)
      .order('created_at', { ascending: false })
      .limit(50);

    const { data: feedback } = await supabase
      .from('supplier_feedback')
      .select('*')
      .eq('user_id', userId)
      .eq('supplier_id', supplier.id);

    // Calculate individual metrics
    const deliveryScore = this.calculateDeliveryScore(orders, feedback);
    const qualityScore = this.calculateQualityScore(feedback);
    const priceScore = this.calculatePriceCompetitiveness(orders, context);
    const reliabilityScore = this.calculateReliabilityScore(orders, feedback);
    const communicationScore = this.calculateCommunicationScore(feedback);
    const categoryFitScore = this.calculateCategoryFitScore(supplier, category, orders);
    const volumeScore = this.calculateVolumeScore(orders);

    // Weighted priority score
    const weights = {
      delivery: 0.20,
      quality: 0.25,
      price: 0.20,
      reliability: 0.15,
      communication: 0.10,
      categoryFit: 0.05,
      volume: 0.05
    };

    const priorityScore = (
      deliveryScore * weights.delivery +
      qualityScore * weights.quality +
      priceScore * weights.price +
      reliabilityScore * weights.reliability +
      communicationScore * weights.communication +
      categoryFitScore * weights.categoryFit +
      volumeScore * weights.volume
    );

    return {
      ...supplier,
      priorityScore: Math.round(priorityScore * 100) / 100,
      metrics: {
        delivery: deliveryScore,
        quality: qualityScore,
        price: priceScore,
        reliability: reliabilityScore,
        communication: communicationScore,
        categoryFit: categoryFitScore,
        volume: volumeScore
      },
      orderHistory: {
        totalOrders: orders?.length || 0,
        recentOrders: orders?.slice(0, 10) || [],
        averageOrderValue: orders?.length ? orders.reduce((sum, o) => sum + (o.unit_price * o.quantity), 0) / orders.length : 0
      },
      feedbackSummary: {
        totalFeedback: feedback?.length || 0,
        averageRating: feedback?.length ? feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length : 0,
        recentFeedback: feedback?.slice(0, 5) || []
      }
    };
  }

  calculateDeliveryScore(orders, feedback) {
    if (!orders?.length) return 0.5;
    
    // Calculate average delivery performance
    const deliveryFeedback = feedback?.filter(f => f.delivery_rating) || [];
    if (deliveryFeedback.length > 0) {
      return deliveryFeedback.reduce((sum, f) => sum + f.delivery_rating, 0) / (deliveryFeedback.length * 5);
    }
    
    // Fallback: assume good delivery if no complaints
    return 0.7;
  }

  calculateQualityScore(feedback) {
    if (!feedback?.length) return 0.5;
    
    const qualityFeedback = feedback.filter(f => f.quality_rating);
    if (qualityFeedback.length === 0) return 0.5;
    
    return qualityFeedback.reduce((sum, f) => sum + f.quality_rating, 0) / (qualityFeedback.length * 5);
  }

  calculatePriceCompetitiveness(orders, context) {
    if (!orders?.length) return 0.5;
    
    const avgPrice = orders.reduce((sum, o) => sum + o.unit_price, 0) / orders.length;
    const marketPrice = context.marketPrice || avgPrice;
    
    if (avgPrice <= marketPrice * 0.9) return 1.0; // 10% below market
    if (avgPrice <= marketPrice) return 0.8;
    if (avgPrice <= marketPrice * 1.1) return 0.6; // 10% above market
    return 0.4;
  }

  calculateReliabilityScore(orders, feedback) {
    if (!orders?.length) return 0.5;
    
    // Calculate consistency in delivery and quality
    const reliabilityFeedback = feedback?.filter(f => f.reliability_rating) || [];
    if (reliabilityFeedback.length > 0) {
      return reliabilityFeedback.reduce((sum, f) => sum + f.reliability_rating, 0) / (reliabilityFeedback.length * 5);
    }
    
    // Fallback: based on order frequency and consistency
    const orderFrequency = orders.length / 12; // orders per month (assuming 1 year data)
    return Math.min(1.0, orderFrequency / 2); // normalize to 2 orders per month = 1.0
  }

  calculateCommunicationScore(feedback) {
    if (!feedback?.length) return 0.5;
    
    const commFeedback = feedback.filter(f => f.communication_rating);
    if (commFeedback.length === 0) return 0.5;
    
    return commFeedback.reduce((sum, f) => sum + f.communication_rating, 0) / (commFeedback.length * 5);
  }

  calculateCategoryFitScore(supplier, category, orders) {
    if (!supplier.specialties || !category) return 0.5;
    
    const specialties = supplier.specialties.toLowerCase();
    const cat = category.toLowerCase();
    
    if (specialties.includes(cat)) return 1.0;
    
    // Check if supplier has experience with this category
    const categoryOrders = orders?.filter(o => o.category?.toLowerCase() === cat) || [];
    if (categoryOrders.length > 0) return 0.8;
    
    return 0.3;
  }

  calculateVolumeScore(orders) {
    if (!orders?.length) return 0.5;
    
    const totalVolume = orders.reduce((sum, o) => sum + o.quantity, 0);
    
    // Normalize based on volume (higher volume = better relationship)
    if (totalVolume > 1000) return 1.0;
    if (totalVolume > 500) return 0.8;
    if (totalVolume > 100) return 0.6;
    return 0.4;
  }

  generateRecommendation(supplier) {
    const score = supplier.priorityScore;
    
    if (score >= 0.8) return 'Highly Recommended - Top performer across all metrics';
    if (score >= 0.7) return 'Recommended - Strong performance with minor areas for improvement';
    if (score >= 0.6) return 'Consider - Good option with some performance concerns';
    if (score >= 0.5) return 'Caution - Below average performance, monitor closely';
    return 'Not Recommended - Significant performance issues';
  }

  generateSuitabilityReason(supplier, productName, category) {
    const reasons = [];
    
    if (supplier.metrics.categoryFit > 0.8) {
      reasons.push(`Specializes in ${category}`);
    }
    
    if (supplier.metrics.quality > 0.8) {
      reasons.push('Excellent quality track record');
    }
    
    if (supplier.metrics.price > 0.8) {
      reasons.push('Competitive pricing');
    }
    
    if (supplier.metrics.delivery > 0.8) {
      reasons.push('Reliable delivery performance');
    }
    
    if (supplier.orderHistory.totalOrders > 10) {
      reasons.push('Established relationship');
    }
    
    return reasons.length > 0 ? reasons.join(', ') : 'Limited data available';
  }

  // Dynamic category management
  async createDynamicCategory(userId, categoryData) {
    try {
      const supabase = getAuthenticatedClient();
      
      const category = {
        user_id: userId,
        name: categoryData.name,
        type: categoryData.type || this.categoryTypes.PRODUCT_BASED,
        criteria: categoryData.criteria || {},
        auto_assignment_rules: categoryData.autoRules || {},
        priority_weights: categoryData.weights || {},
        created_at: new Date().toISOString()
      };
      
      const { data, error } = await supabase
        .from('dynamic_categories')
        .insert(category)
        .select()
        .single();
      
      if (error) throw error;
      
      // Apply category to existing items
      await this.applyCategoryToExistingItems(userId, data);
      
      return data;
    } catch (error) {
      console.error('Error creating dynamic category:', error);
      throw error;
    }
  }

  async applyCategoryToExistingItems(userId, category) {
    try {
      const supabase = getAuthenticatedClient();
      
      if (!category.auto_assignment_rules) return;
      
      const { data: items } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('user_id', userId);
      
      const updates = [];
      
      for (const item of items || []) {
        if (this.itemMatchesCategory(item, category)) {
          updates.push({
            id: item.id,
            dynamic_category: category.name,
            category_type: category.type
          });
        }
      }
      
      if (updates.length > 0) {
        await supabase
          .from('inventory_items')
          .upsert(updates);
      }
      
    } catch (error) {
      console.error('Error applying category to existing items:', error);
    }
  }

  itemMatchesCategory(item, category) {
    const rules = category.auto_assignment_rules;
    
    if (rules.name_contains) {
      const nameMatches = rules.name_contains.some(keyword => 
        item.name.toLowerCase().includes(keyword.toLowerCase())
      );
      if (!nameMatches) return false;
    }
    
    if (rules.supplier_includes) {
      if (!rules.supplier_includes.includes(item.supplier)) return false;
    }
    
    if (rules.price_range) {
      const price = item.unit_price;
      if (price < rules.price_range.min || price > rules.price_range.max) return false;
    }
    
    if (rules.quantity_range) {
      const qty = item.quantity;
      if (qty < rules.quantity_range.min || qty > rules.quantity_range.max) return false;
    }
    
    return true;
  }

  async generateSupplierRecommendations(userId, suppliers, context) {
    try {
      const topSuppliers = suppliers.slice(0, 3);
      const recommendations = [];
      
      // Diversification recommendation
      if (suppliers.length > 1) {
        const topScore = suppliers[0].priorityScore;
        const secondScore = suppliers[1].priorityScore;
        
        if (topScore - secondScore < 0.1) {
          recommendations.push({
            type: 'diversification',
            message: 'Consider splitting orders between top 2 suppliers to reduce risk',
            suppliers: [suppliers[0].name, suppliers[1].name],
            confidence: 0.8
          });
        }
      }
      
      // New supplier recommendation
      if (suppliers.every(s => s.orderHistory.totalOrders > 20)) {
        recommendations.push({
          type: 'exploration',
          message: 'Consider exploring new suppliers to potentially improve terms',
          action: 'search_new_suppliers',
          confidence: 0.6
        });
      }
      
      // Performance improvement
      const lowPerformers = suppliers.filter(s => s.priorityScore < 0.6);
      if (lowPerformers.length > 0) {
        recommendations.push({
          type: 'performance_improvement',
          message: `${lowPerformers.length} suppliers need performance review`,
          suppliers: lowPerformers.map(s => s.name),
          confidence: 0.9
        });
      }
      
      return recommendations;
    } catch (error) {
      console.error('Error generating supplier recommendations:', error);
      return [];
    }
  }

  async generateInitialSupplierSuggestions(userId, productName, category) {
    try {
      const prompt = `Suggest 5 potential suppliers for "${productName}" in category "${category}". 
      
      For each supplier, provide:
      - Name
      - Specialties
      - Estimated reliability (1-5)
      - Typical price range
      - Geographic focus
      
      Format as JSON array with objects containing: name, specialties, reliability, priceRange, geographic`;

      const response = await generateCompletion(prompt, { max_tokens: 500 });
      
      try {
        const suggestions = JSON.parse(response);
        return {
          suppliers: suggestions.map(s => ({
            ...s,
            priorityScore: s.reliability / 5,
            isAISuggestion: true,
            metrics: {
              delivery: s.reliability / 5,
              quality: s.reliability / 5,
              price: 0.7,
              reliability: s.reliability / 5,
              communication: 0.7,
              categoryFit: 0.8,
              volume: 0.5
            }
          })),
          totalSuppliers: suggestions.length,
          isInitialSuggestion: true
        };
      } catch (parseError) {
        console.error('Error parsing AI supplier suggestions:', parseError);
        return { suppliers: [], error: 'Failed to generate supplier suggestions' };
      }
    } catch (error) {
      console.error('Error generating initial supplier suggestions:', error);
      return { suppliers: [], error: error.message };
    }
  }

  // Record supplier feedback
  async recordSupplierFeedback(userId, supplierId, feedback) {
    try {
      const supabase = getAuthenticatedClient();
      
      await supabase.from('supplier_feedback').insert({
        user_id: userId,
        supplier_id: supplierId,
        delivery_rating: feedback.delivery,
        quality_rating: feedback.quality,
        communication_rating: feedback.communication,
        reliability_rating: feedback.reliability,
        overall_rating: feedback.overall,
        comments: feedback.comments,
        order_reference: feedback.orderReference,
        created_at: new Date().toISOString()
      });
      
      // Clear supplier cache
      await redisService.del(`supplier_scores:${userId}`);
      
      return { success: true };
    } catch (error) {
      console.error('Error recording supplier feedback:', error);
      throw error;
    }
  }
}

module.exports = new SupplierPrioritizationService();