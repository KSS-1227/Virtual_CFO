const express = require('express');
const { generateBusinessInsights } = require('../config/openai');
const router = express.Router();

router.post('/business-insights', async (req, res) => {
  try {
    const { businessName, businessType, dailySales, dailyCosts, profit, profitMargin } = req.body;

    if (!businessName || !businessType || dailySales <= 0) {
      return res.status(400).json({ error: 'Invalid business data provided' });
    }

    const prompt = `
Analyze this business and provide specific recommendations:

Business: ${businessName}
Type: ${businessType}
Daily Sales: ₹${dailySales}
Daily Costs: ₹${dailyCosts}
Daily Profit: ₹${profit}
Profit Margin: ${profitMargin.toFixed(1)}%

Provide 3 specific recommendations with realistic impact percentages and a key business insight. Focus on actionable advice for small Indian businesses.

Format as JSON:
{
  "recommendations": [
    {"name": "Recommendation Name", "impact": "+X% sales", "reason": "Why this helps"},
    {"name": "Cost Reduction Strategy", "impact": "-X% costs", "reason": "How to save money"},
    {"name": "Growth Initiative", "impact": "+X% retention", "reason": "Customer benefit"}
  ],
  "projectedIncrease": estimated_monthly_profit_increase_in_rupees,
  "keyInsight": "One key insight about this business performance and growth potential"
}`;

    const insights = await generateBusinessInsights(prompt);
    
    // Parse AI response
    let parsedInsights;
    try {
      parsedInsights = JSON.parse(insights);
    } catch (parseError) {
      // Fallback if AI doesn't return valid JSON
      parsedInsights = {
        recommendations: [
          { name: `${businessType} Digital Presence`, impact: '+20% sales', reason: 'Increase online visibility' },
          { name: 'Expense Tracking System', impact: '-12% costs', reason: 'Better cost control' },
          { name: 'Customer Loyalty Program', impact: '+15% retention', reason: 'Repeat customers' }
        ],
        projectedIncrease: Math.round(profit * 30 * 0.25),
        keyInsight: `Your ${businessType} business has a ${profitMargin.toFixed(1)}% profit margin. Focus on customer acquisition and cost optimization.`
      };
    }

    res.json({ insights: parsedInsights });
  } catch (error) {
    console.error('Error generating business insights:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

module.exports = router;