const { createChatCompletion } = require("../config/openai");
const { getAuthenticatedClient } = require("../config/supabase");

class ReorderIntelligenceService {
  async generateReorderRecommendations(userId) {
    try {
      // Mock implementation for now - replace with actual Supabase client when available
      const mockRecommendations = [
        {
          product_name: "Sample Product",
          current_stock: 5,
          recommended_order: 20,
          urgency: "high",
          reason: "Low stock detected",
          optimal_order_date: new Date().toISOString().split('T')[0],
          confidence: 0.85
        }
      ];
      
      return mockRecommendations;
    } catch (error) {
      console.error('Reorder intelligence error:', error);
      return [];
    }
  }

  calculateCurrentStock(movements) {
    return movements.reduce((total, movement) => {
      return total + (movement.direction === 'in' ? movement.quantity : -movement.quantity);
    }, 0);
  }

  calculateVelocity(movements) {
    const outMovements = movements
      .filter(m => m.direction === 'out')
      .filter(m => new Date(m.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    
    const totalOut = outMovements.reduce((sum, m) => sum + m.quantity, 0);
    return totalOut / 30; // Daily velocity
  }

  getSeasonalMultiplier(productName, seasonalData) {
    const currentMonth = new Date().getMonth() + 1;
    const pattern = seasonalData.find(p => p.product_name === productName && p.month === currentMonth);
    return pattern?.demand_multiplier || 1.0;
  }

  async generateAIRecommendations(analysisData, userId) {
    const prompt = `Analyze inventory data and provide reorder recommendations:

${analysisData.map(item => 
  `${item.product_name}: ${item.current_stock} units, ${item.velocity.toFixed(2)} daily usage, ${item.days_of_stock.toFixed(1)} days left`
).join('\n')}

Return JSON array with:
{
  "product_name": "string",
  "current_stock": number,
  "recommended_order": number,
  "urgency": "critical|high|medium|low",
  "reason": "string",
  "optimal_order_date": "YYYY-MM-DD",
  "confidence": 0.0-1.0
}`;

    const response = await createChatCompletion([
      { role: "system", content: "You are an inventory optimization AI. Provide precise reorder recommendations based on velocity, seasonality, and stock levels." },
      { role: "user", content: prompt }
    ], { temperature: 0.2 });

    try {
      return JSON.parse(response);
    } catch {
      return analysisData
        .filter(item => item.days_of_stock < 7)
        .map(item => ({
          product_name: item.product_name,
          current_stock: item.current_stock,
          recommended_order: Math.ceil(item.velocity * 14), // 2 weeks supply
          urgency: item.days_of_stock < 3 ? 'critical' : 'high',
          reason: `${item.days_of_stock.toFixed(1)} days of stock remaining`,
          optimal_order_date: new Date(Date.now() + item.days_of_stock * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          confidence: 0.8
        }));
    }
  }
}

module.exports = { ReorderIntelligenceService };