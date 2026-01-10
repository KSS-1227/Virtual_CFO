const { getAuthenticatedClient } = require('../config/supabase');
const { generateCompletion } = require('./openai');
const redisService = require('./redisService');

class SeasonalDemandService {
  constructor() {
    this.seasonalPatterns = {
      SPRING: { months: [3, 4, 5], name: 'Spring' },
      SUMMER: { months: [6, 7, 8], name: 'Summer' },
      MONSOON: { months: [7, 8, 9], name: 'Monsoon' },
      AUTUMN: { months: [10, 11], name: 'Autumn' },
      WINTER: { months: [12, 1, 2], name: 'Winter' },
      FESTIVAL: { 
        periods: [
          { name: 'Diwali', months: [10, 11], boost: 2.5 },
          { name: 'Holi', months: [3], boost: 1.8 },
          { name: 'Eid', months: [4, 5, 11, 12], boost: 2.0 },
          { name: 'Christmas', months: [12], boost: 2.2 },
          { name: 'New Year', months: [1, 12], boost: 1.5 }
        ]
      }
    };
    
    this.demandFactors = {
      WEATHER: 'weather',
      FESTIVALS: 'festivals',
      ECONOMIC: 'economic',
      SUPPLY_CHAIN: 'supply_chain',
      MARKET_TRENDS: 'market_trends'
    };
  }

  // Analyze seasonal patterns for a product
  async analyzeSeasonalPatterns(userId, productName, category) {
    try {
      const supabase = getAuthenticatedClient();
      
      // Get historical data for the product
      const { data: history } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('user_id', userId)
        .or(`name.ilike.%${productName}%,category.eq.${category}`)
        .order('created_at', { ascending: true });

      if (!history?.length) {
        return await this.generateAISeasonalAnalysis(productName, category);
      }

      // Analyze monthly patterns
      const monthlyData = this.aggregateMonthlyData(history);
      const seasonalTrends = this.identifySeasonalTrends(monthlyData);
      const demandForecast = await this.generateDemandForecast(monthlyData, seasonalTrends);
      const reorderRecommendations = this.calculateSeasonalReorderPoints(seasonalTrends, demandForecast);

      return {
        productName,
        category,
        analysisDate: new Date().toISOString(),
        dataPoints: history.length,
        monthlyData,
        seasonalTrends,
        demandForecast,
        reorderRecommendations,
        insights: await this.generateSeasonalInsights(seasonalTrends, demandForecast),
        confidence: this.calculateConfidenceScore(history.length, seasonalTrends)
      };
    } catch (error) {
      console.error('Seasonal analysis error:', error);
      return { error: error.message };
    }
  }

  aggregateMonthlyData(history) {
    const monthlyData = {};
    
    history.forEach(item => {
      const date = new Date(item.created_at);
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const key = `${year}-${month.toString().padStart(2, '0')}`;
      
      if (!monthlyData[key]) {
        monthlyData[key] = {
          month,
          year,
          totalQuantity: 0,
          totalValue: 0,
          orderCount: 0,
          averagePrice: 0,
          items: []
        };
      }
      
      monthlyData[key].totalQuantity += item.quantity;
      monthlyData[key].totalValue += (item.unit_price * item.quantity);
      monthlyData[key].orderCount += 1;
      monthlyData[key].items.push(item);
    });
    
    // Calculate averages
    Object.values(monthlyData).forEach(data => {
      data.averagePrice = data.totalValue / data.totalQuantity;
      data.averageOrderSize = data.totalQuantity / data.orderCount;
    });
    
    return monthlyData;
  }

  identifySeasonalTrends(monthlyData) {
    const trends = {
      peak_months: [],
      low_months: [],
      seasonal_multipliers: {},
      growth_rate: 0,
      volatility: 0
    };
    
    const monthlyQuantities = Object.entries(monthlyData).map(([key, data]) => ({
      month: data.month,
      quantity: data.totalQuantity,
      period: key
    }));
    
    if (monthlyQuantities.length < 3) return trends;
    
    // Calculate average monthly demand
    const avgDemand = monthlyQuantities.reduce((sum, m) => sum + m.quantity, 0) / monthlyQuantities.length;
    
    // Identify peak and low months
    monthlyQuantities.forEach(m => {
      const ratio = m.quantity / avgDemand;
      
      if (ratio > 1.3) {
        trends.peak_months.push({ month: m.month, ratio, quantity: m.quantity });
      } else if (ratio < 0.7) {
        trends.low_months.push({ month: m.month, ratio, quantity: m.quantity });
      }
      
      trends.seasonal_multipliers[m.month] = ratio;
    });
    
    // Calculate growth rate (year-over-year if available)
    const yearlyData = this.aggregateYearlyData(monthlyQuantities);
    if (yearlyData.length > 1) {
      const firstYear = yearlyData[0].quantity;
      const lastYear = yearlyData[yearlyData.length - 1].quantity;
      trends.growth_rate = ((lastYear - firstYear) / firstYear) * 100;
    }
    
    // Calculate volatility (coefficient of variation)
    const stdDev = this.calculateStandardDeviation(monthlyQuantities.map(m => m.quantity));
    trends.volatility = (stdDev / avgDemand) * 100;
    
    return trends;
  }

  aggregateYearlyData(monthlyQuantities) {
    const yearlyData = {};
    
    monthlyQuantities.forEach(m => {
      const year = Math.floor(parseInt(m.period.split('-')[0]));
      if (!yearlyData[year]) {
        yearlyData[year] = { year, quantity: 0 };
      }
      yearlyData[year].quantity += m.quantity;
    });
    
    return Object.values(yearlyData).sort((a, b) => a.year - b.year);
  }

  calculateStandardDeviation(values) {
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  async generateDemandForecast(monthlyData, seasonalTrends) {
    const currentMonth = new Date().getMonth() + 1;
    const forecast = {};
    
    // Generate 12-month forecast
    for (let i = 1; i <= 12; i++) {
      const targetMonth = ((currentMonth + i - 1) % 12) + 1;
      const seasonalMultiplier = seasonalTrends.seasonal_multipliers[targetMonth] || 1;
      
      // Base demand calculation
      const recentMonths = Object.values(monthlyData).slice(-6);
      const baseDemand = recentMonths.length > 0 
        ? recentMonths.reduce((sum, m) => sum + m.totalQuantity, 0) / recentMonths.length
        : 100;
      
      // Apply seasonal adjustment
      let forecastDemand = baseDemand * seasonalMultiplier;
      
      // Apply growth trend
      if (seasonalTrends.growth_rate !== 0) {
        const growthFactor = 1 + (seasonalTrends.growth_rate / 100) * (i / 12);
        forecastDemand *= growthFactor;
      }
      
      // Apply festival boost
      const festivalBoost = this.getFestivalBoost(targetMonth);
      forecastDemand *= festivalBoost;
      
      forecast[targetMonth] = {
        month: targetMonth,
        forecastDemand: Math.round(forecastDemand),
        seasonalMultiplier,
        festivalBoost,
        confidence: this.calculateForecastConfidence(i, seasonalTrends.volatility)
      };
    }
    
    return forecast;
  }

  getFestivalBoost(month) {
    const festivals = this.seasonalPatterns.FESTIVAL.periods;
    const applicableFestivals = festivals.filter(f => f.months.includes(month));
    
    if (applicableFestivals.length === 0) return 1.0;
    
    // Return the highest boost if multiple festivals
    return Math.max(...applicableFestivals.map(f => f.boost));
  }

  calculateForecastConfidence(monthsAhead, volatility) {
    let baseConfidence = 0.9;
    
    // Reduce confidence for longer forecasts
    baseConfidence -= (monthsAhead - 1) * 0.05;
    
    // Reduce confidence for high volatility
    if (volatility > 50) baseConfidence -= 0.2;
    else if (volatility > 30) baseConfidence -= 0.1;
    
    return Math.max(0.3, Math.min(0.95, baseConfidence));
  }

  calculateSeasonalReorderPoints(seasonalTrends, demandForecast) {
    const recommendations = {};
    
    Object.values(demandForecast).forEach(forecast => {
      const month = forecast.month;
      const demand = forecast.forecastDemand;
      
      // Base reorder point calculation
      let reorderPoint = Math.ceil(demand * 0.3); // 30% of monthly demand
      
      // Adjust for seasonality
      if (seasonalTrends.peak_months.some(p => p.month === month)) {
        reorderPoint = Math.ceil(demand * 0.5); // 50% for peak months
      } else if (seasonalTrends.low_months.some(l => l.month === month)) {
        reorderPoint = Math.ceil(demand * 0.2); // 20% for low months
      }
      
      // Adjust for volatility
      if (seasonalTrends.volatility > 30) {
        reorderPoint = Math.ceil(reorderPoint * 1.2); // 20% buffer for high volatility
      }
      
      recommendations[month] = {
        month,
        reorderPoint,
        maxStock: Math.ceil(demand * 1.5),
        orderQuantity: Math.ceil(demand * 0.8),
        leadTimeBuffer: this.calculateLeadTimeBuffer(forecast.confidence),
        reasoning: this.generateReorderReasoning(month, seasonalTrends, forecast)
      };
    });
    
    return recommendations;
  }

  calculateLeadTimeBuffer(confidence) {
    if (confidence > 0.8) return 1.1; // 10% buffer
    if (confidence > 0.6) return 1.2; // 20% buffer
    return 1.3; // 30% buffer for low confidence
  }

  generateReorderReasoning(month, seasonalTrends, forecast) {
    const reasons = [];
    
    if (seasonalTrends.peak_months.some(p => p.month === month)) {
      reasons.push('Peak demand month');
    }
    
    if (forecast.festivalBoost > 1.5) {
      const festival = this.seasonalPatterns.FESTIVAL.periods.find(f => f.months.includes(month));
      reasons.push(`Festival season (${festival?.name})`);
    }
    
    if (forecast.confidence < 0.7) {
      reasons.push('High uncertainty - increased buffer');
    }
    
    if (seasonalTrends.growth_rate > 10) {
      reasons.push('Strong growth trend');
    }
    
    return reasons.length > 0 ? reasons.join(', ') : 'Standard seasonal adjustment';
  }

  async generateSeasonalInsights(seasonalTrends, demandForecast) {
    const insights = [];
    
    // Peak season insights
    if (seasonalTrends.peak_months.length > 0) {
      const peakMonths = seasonalTrends.peak_months.map(p => this.getMonthName(p.month)).join(', ');
      insights.push({
        type: 'peak_season',
        message: `Peak demand occurs in ${peakMonths}. Consider increasing stock 2-3 weeks before.`,
        priority: 'high',
        actionable: true
      });
    }
    
    // Low season insights
    if (seasonalTrends.low_months.length > 0) {
      const lowMonths = seasonalTrends.low_months.map(l => this.getMonthName(l.month)).join(', ');
      insights.push({
        type: 'low_season',
        message: `Low demand in ${lowMonths}. Reduce inventory to minimize holding costs.`,
        priority: 'medium',
        actionable: true
      });
    }
    
    // Growth trend insights
    if (seasonalTrends.growth_rate > 15) {
      insights.push({
        type: 'growth_trend',
        message: `Strong growth trend (${seasonalTrends.growth_rate.toFixed(1)}% annually). Consider expanding supplier capacity.`,
        priority: 'high',
        actionable: true
      });
    } else if (seasonalTrends.growth_rate < -10) {
      insights.push({
        type: 'decline_trend',
        message: `Declining demand (${seasonalTrends.growth_rate.toFixed(1)}% annually). Review product strategy.`,
        priority: 'high',
        actionable: true
      });
    }
    
    // Volatility insights
    if (seasonalTrends.volatility > 40) {
      insights.push({
        type: 'high_volatility',
        message: `High demand volatility (${seasonalTrends.volatility.toFixed(1)}%). Consider flexible supplier agreements.`,
        priority: 'medium',
        actionable: true
      });
    }
    
    return insights;
  }

  async generateAISeasonalAnalysis(productName, category) {
    try {
      const prompt = `Analyze seasonal demand patterns for "${productName}" in category "${category}" for Indian market.

Consider:
1. Weather patterns in India
2. Festival seasons (Diwali, Holi, Eid, Christmas)
3. Agricultural cycles
4. Economic factors
5. Cultural preferences

Provide analysis in JSON format:
{
  "peak_months": [month numbers],
  "low_months": [month numbers],
  "seasonal_factors": {
    "weather_impact": "description",
    "festival_impact": "description",
    "cultural_factors": "description"
  },
  "demand_multipliers": {
    "1": multiplier, "2": multiplier, ... "12": multiplier
  },
  "recommendations": ["recommendation1", "recommendation2"]
}`;

      const response = await generateCompletion(prompt, { max_tokens: 800 });
      
      try {
        const aiAnalysis = JSON.parse(response);
        
        return {
          productName,
          category,
          analysisDate: new Date().toISOString(),
          isAIGenerated: true,
          seasonalTrends: {
            peak_months: aiAnalysis.peak_months?.map(m => ({ month: m, ratio: 1.5 })) || [],
            low_months: aiAnalysis.low_months?.map(m => ({ month: m, ratio: 0.7 })) || [],
            seasonal_multipliers: aiAnalysis.demand_multipliers || {},
            growth_rate: 0,
            volatility: 25
          },
          aiInsights: aiAnalysis.seasonal_factors,
          recommendations: aiAnalysis.recommendations || [],
          confidence: 0.6
        };
      } catch (parseError) {
        console.error('Error parsing AI seasonal analysis:', parseError);
        return this.getDefaultSeasonalPattern(productName, category);
      }
    } catch (error) {
      console.error('Error generating AI seasonal analysis:', error);
      return this.getDefaultSeasonalPattern(productName, category);
    }
  }

  getDefaultSeasonalPattern(productName, category) {
    // Default patterns based on common Indian business cycles
    const defaultPatterns = {
      'Electronics': { peak: [10, 11, 12], low: [6, 7, 8] },
      'Clothing': { peak: [10, 11, 3, 4], low: [7, 8, 9] },
      'Food & Beverages': { peak: [10, 11, 12, 4], low: [6, 7] },
      'Office Supplies': { peak: [3, 4, 6, 7], low: [11, 12] },
      'Raw Materials': { peak: [3, 4, 10, 11], low: [7, 8] }
    };
    
    const pattern = defaultPatterns[category] || { peak: [10, 11], low: [7, 8] };
    
    return {
      productName,
      category,
      analysisDate: new Date().toISOString(),
      isDefault: true,
      seasonalTrends: {
        peak_months: pattern.peak.map(m => ({ month: m, ratio: 1.4 })),
        low_months: pattern.low.map(m => ({ month: m, ratio: 0.8 })),
        seasonal_multipliers: this.generateDefaultMultipliers(pattern),
        growth_rate: 5,
        volatility: 20
      },
      confidence: 0.4
    };
  }

  generateDefaultMultipliers(pattern) {
    const multipliers = {};
    
    for (let month = 1; month <= 12; month++) {
      if (pattern.peak.includes(month)) {
        multipliers[month] = 1.4;
      } else if (pattern.low.includes(month)) {
        multipliers[month] = 0.8;
      } else {
        multipliers[month] = 1.0;
      }
    }
    
    return multipliers;
  }

  getMonthName(monthNumber) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthNumber - 1];
  }

  calculateConfidenceScore(dataPoints, seasonalTrends) {
    let confidence = 0.5;
    
    // More data points = higher confidence
    if (dataPoints > 50) confidence += 0.3;
    else if (dataPoints > 20) confidence += 0.2;
    else if (dataPoints > 10) confidence += 0.1;
    
    // Clear seasonal patterns = higher confidence
    if (seasonalTrends.peak_months.length > 0 && seasonalTrends.low_months.length > 0) {
      confidence += 0.2;
    }
    
    // Low volatility = higher confidence
    if (seasonalTrends.volatility < 20) confidence += 0.1;
    else if (seasonalTrends.volatility > 50) confidence -= 0.1;
    
    return Math.max(0.2, Math.min(0.95, confidence));
  }

  // Get current month recommendations
  async getCurrentMonthRecommendations(userId, productName, category) {
    try {
      const analysis = await this.analyzeSeasonalPatterns(userId, productName, category);
      const currentMonth = new Date().getMonth() + 1;
      
      if (!analysis.reorderRecommendations) return null;
      
      const currentRec = analysis.reorderRecommendations[currentMonth];
      const nextMonthRec = analysis.reorderRecommendations[((currentMonth % 12) + 1)];
      
      return {
        current_month: {
          month: currentMonth,
          ...currentRec
        },
        next_month: {
          month: ((currentMonth % 12) + 1),
          ...nextMonthRec
        },
        seasonal_context: analysis.seasonalTrends,
        confidence: analysis.confidence
      };
    } catch (error) {
      console.error('Error getting current month recommendations:', error);
      return null;
    }
  }
}

module.exports = new SeasonalDemandService();