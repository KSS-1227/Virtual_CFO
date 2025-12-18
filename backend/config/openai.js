const OpenAI = require("openai");
const config = require("./env");

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

// Helper function to create chat completion
const createChatCompletion = async (messages, options = {}) => {
  try {
    const completion = await openai.chat.completions.create({
      model: options.model || "gpt-4o-mini",
      messages,
      max_tokens: options.max_tokens || 1000,
      temperature: options.temperature || 0.7,
      ...options,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error("OpenAI API Error:", error);
    throw new Error("Failed to generate AI response");
  }
};

// Helper function for financial advice chat
const generateFinancialAdvice = async (userMessage, userProfile = {}) => {
  const systemPrompt = `You are a Virtual CFO assistant for small and medium businesses in India. 
  Provide practical, actionable financial advice based on the user's business context.
  
  User Business Context:
  - Business Name: ${userProfile.business_name || "Not specified"}
  - Business Type: ${userProfile.business_type || "Not specified"}
  - Location: ${userProfile.location || "India"}
  - Monthly Revenue: ₹${userProfile.monthly_revenue || "Not specified"}
  - Monthly Expenses: ₹${userProfile.monthly_expenses || "Not specified"}
  
  Guidelines:
  - Provide specific, actionable advice
  - Focus on Indian business context and regulations
  - Include relevant financial metrics and KPIs
  - Suggest practical implementation steps
  - Keep responses concise but comprehensive`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  return await createChatCompletion(messages, { max_tokens: 1500 });
};

// Helper function for business ideas
const generateBusinessIdeas = async (budget, field) => {
  const systemPrompt = `You are a business consultant specializing in trending global business ideas adapted for the Indian market.
  Provide practical, feasible business ideas that consider local market conditions, regulations, and cultural preferences.
  
  Focus on:
  - Current global business trends
  - Indian market adaptation
  - Realistic budget requirements
  - ROI potential and timelines
  - Implementation feasibility`;

  const userPrompt = `Generate trending business ideas for the ${field} industry with a budget of ₹${budget}.
  
  Requirements:
  - Budget: ₹${budget}
  - Industry: ${field}
  - Market: India
  - Focus: Trending global concepts adapted for Indian market
  
  Please provide:
  1. 3-5 specific business ideas
  2. Investment breakdown for each
  3. Market potential and target audience
  4. Implementation timeline
  5. Expected ROI and break-even period`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  return await createChatCompletion(messages, { max_tokens: 2000 });
};

// AI Product Analysis for Recommendations
const generateProductAnalysis = async (product, userContext) => {
  const systemPrompt = `You are an AI business analyst specializing in product recommendations for small and medium businesses in India.
  Analyze whether a product/service would be beneficial for a specific business based on their profile.
  
  Provide analysis in the following JSON format:
  {
    "compatibility_score": 0-100,
    "business_impact_score": 0-100,
    "summary": "Brief analysis summary",
    "benefits": ["benefit1", "benefit2"],
    "challenges": ["challenge1", "challenge2"],
    "roi_months": estimated_months_to_roi,
    "monthly_impact": estimated_monthly_financial_impact,
    "recommendation_type": "highly_recommended|recommended|suggested|not_recommended",
    "priority_level": 1-5
  }`;

  const userPrompt = `Analyze this product for the business:
  
  PRODUCT:
  Name: ${product.name}
  Description: ${product.description}
  Category: ${product.category}
  Price: ₹${product.price} (${product.pricing_model})
  Benefits: ${product.key_benefits?.join(', ') || 'Not specified'}
  
  BUSINESS PROFILE:
  Type: ${userContext.business_type}
  Size: ${userContext.business_size}
  Monthly Revenue: ₹${userContext.monthly_revenue || 0}
  Monthly Expenses: ₹${userContext.monthly_expenses || 0}
  Profit Margin: ${userContext.profit_margin || 0}%
  Location: ${userContext.location || 'India'}
  
  Analyze compatibility, potential impact, ROI, and provide specific recommendations for this business.`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  try {
    const response = await createChatCompletion(messages, { 
      max_tokens: 1500,
      temperature: 0.3 // Lower temperature for more consistent analysis
    });
    
    // Parse JSON response
    const analysis = JSON.parse(response);
    
    // Validate and set defaults
    return {
      compatibility_score: Math.min(100, Math.max(0, analysis.compatibility_score || 0)),
      business_impact_score: Math.min(100, Math.max(0, analysis.business_impact_score || 0)),
      summary: analysis.summary || 'Analysis not available',
      benefits: Array.isArray(analysis.benefits) ? analysis.benefits : [],
      challenges: Array.isArray(analysis.challenges) ? analysis.challenges : [],
      roi_months: parseInt(analysis.roi_months) || 12,
      monthly_impact: parseFloat(analysis.monthly_impact) || 0,
      recommendation_type: analysis.recommendation_type || 'suggested',
      priority_level: Math.min(5, Math.max(1, parseInt(analysis.priority_level) || 3))
    };
  } catch (error) {
    console.error('Error parsing AI analysis:', error);
    // Return default analysis if parsing fails
    return {
      compatibility_score: 50,
      business_impact_score: 50,
      summary: 'Unable to generate detailed analysis at this time',
      benefits: ['Potential business improvement'],
      challenges: ['Implementation required'],
      roi_months: 12,
      monthly_impact: 0,
      recommendation_type: 'suggested',
      priority_level: 3
    };
  }
};

// Generate business insights for onboarding
const generateBusinessInsights = async (prompt) => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 600,
      temperature: 0.7
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error generating business insights:', error);
    throw error;
  }
};

module.exports = {
  openai,
  createChatCompletion,
  generateFinancialAdvice,
  generateBusinessIdeas,
  generateProductAnalysis,
  generateBusinessInsights,
};
