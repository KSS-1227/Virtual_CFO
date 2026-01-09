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

// Enhanced Multi-Modal Vision Analysis with Financial Classification
const analyzeReceiptImage = async (imageBase64, userProfile = {}) => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `You are an expert financial data extraction system for Indian businesses. Extract and classify financial transactions from receipts/bills in Hindi/English. Use the extract_financial_data function to return structured data.`
      }, {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extract financial data from this ${userProfile.business_type || 'business'} receipt/bill. Classify as expense, revenue, or profit distribution. Handle Hindi/English mixed text.`
          },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
          }
        ]
      }],
      functions: [{
        name: "extract_financial_data",
        description: "Extract and classify financial data from receipt OCR text (Hindi/English). Automatically determine if transaction is expense, revenue, or profit.",
        parameters: {
          type: "object",
          properties: {
            amount: { type: "number", description: "Total transaction amount" },
            currency: { type: "string", description: "Currency code (INR)" },
            date: { type: ["string", "null"], description: "ISO date (YYYY-MM-DD) or null" },
            vendor: { type: ["string", "null"], description: "Vendor/business name" },
            category: { type: "string", description: "Transaction category" },
            transaction_type: { 
              type: "string", 
              enum: ["expense", "revenue", "profit_distribution"],
              description: "Classify as business expense, revenue earned, or profit taken"
            },
            expense_type: {
              type: ["string", "null"],
              enum: ["inventory", "operational", "equipment", "rent", "utilities", "salary", "other"],
              description: "Type of expense if transaction_type is expense"
            },
            revenue_source: {
              type: ["string", "null"], 
              enum: ["sales", "service", "commission", "other"],
              description: "Source of revenue if transaction_type is revenue"
            },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  amount: { type: "number" },
                  quantity: { type: ["number", "null"] }
                },
                required: ["name", "amount"]
              }
            },
            confidence: { type: "number", description: "Extraction confidence 0-1" },
            review_required: { type: "boolean", description: "Whether manual review is needed" },
            notes: { type: "string", description: "Additional extraction notes" }
          },
          required: ["amount", "transaction_type", "confidence"]
        }
      }],
      function_call: { name: "extract_financial_data" },
      max_tokens: 1500,
      temperature: 0.1
    });

    const functionCall = response?.choices?.[0]?.function_call;
    if (functionCall && functionCall.name === "extract_financial_data") {
      let extractedData = null;
      try {
        extractedData = JSON.parse(functionCall.arguments || '{}');
      } catch (err) {
        console.error('Failed to parse function_call.arguments:', err, functionCall.arguments);
      }

      if (extractedData) {
        // Normalize confidence: allow either number or object
        if (typeof extractedData.confidence === 'number') {
          extractedData.confidence = { overall: extractedData.confidence };
        }

        // Keep date null if missing (prefer conservative nulls)
        const normalizedDate = extractedData.date || null;

        // Determine review requirement conservatively
        const reviewRequired = extractedData.review_required === true || !normalizedDate || !extractedData.amount;

        // Enhance with business logic
        return {
          ...extractedData,
          currency: extractedData.currency || "INR",
          date: normalizedDate,
          vendor: extractedData.vendor || null,
          category: extractedData.category || "General",

          // Business classification for database storage
          is_business_expense: extractedData.transaction_type === "expense",
          is_revenue: extractedData.transaction_type === "revenue",
          is_profit_distribution: extractedData.transaction_type === "profit_distribution",

          // Financial impact calculation
          revenue_amount: extractedData.transaction_type === "revenue" ? extractedData.amount : 0,
          expense_amount: extractedData.transaction_type === "expense" ? extractedData.amount : 0,
          profit_impact: extractedData.transaction_type === "revenue" ? extractedData.amount : 
                        extractedData.transaction_type === "expense" ? -extractedData.amount : 0,

          review_required: reviewRequired
        };
      }
    }

    // Fallback if function calling fails or parsing failed
    console.warn('Function calling did not return valid extracted data, falling back to text extraction.');
    throw new Error("Function calling failed or returned invalid data");
    
  } catch (error) {
    console.error("Enhanced Vision API Error:", error);
    // Fallback to basic extraction
    return await extractFinancialDataFromText(`Amount extraction failed for image`, userProfile);
  }
};

// Voice to Financial Action Processing
const processVoiceCommand = async (transcription, userProfile = {}) => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "system",
        content: `You are a Hindi-English financial assistant for Indian small businesses. Extract financial actions from voice commands. Support code-switching between Hindi and English.
        
        Business context: ${userProfile.business_type || 'General'}, Monthly Revenue: ₹${userProfile.monthly_revenue || 0}
        
        Return JSON with:
        - action: "add_expense" | "add_income" | "get_summary" | "ask_question"
        - amount: number (if applicable)
        - category: string (if applicable)
        - description: string
        - confidence: number (0-1)
        - language_detected: "hindi" | "english" | "mixed"`
      }, {
        role: "user",
        content: `Voice command: "${transcription}"`
      }],
      functions: [{
        name: "process_financial_command",
        description: "Process voice command for financial action",
        parameters: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["add_expense", "add_income", "get_summary", "ask_question"] },
            amount: { type: "number" },
            category: { type: "string" },
            description: { type: "string" },
            confidence: { type: "number" },
            language_detected: { type: "string" }
          },
          required: ["action", "description", "confidence"]
        }
      }],
      function_call: { name: "process_financial_command" },
      temperature: 0.3
    });

    return JSON.parse(response.choices[0].function_call.arguments);
  } catch (error) {
    console.error("Voice processing error:", error);
    throw new Error("Failed to process voice command");
  }
};

// Inventory-specific Voice Command Processing
// Interprets Hindi/English inventory commands like
// "Aaj 50 pieces bread aaye" or "10 kg chawal becha".
const interpretInventoryVoiceCommand = async (transcription, userProfile = {}) => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an inventory command interpreter for Indian shop owners. " +
            "Understand Hindi, English, and mixed Hinglish phrases. " +
            "Return JSON only describing the stock action. Allowed actions: 'stock_in', 'stock_out', 'check_stock'. " +
            "Extract: product_name (string), quantity (number), unit (string, optional), action, confidence (0-1). \n" +
            "Examples: 'Aaj 50 pieces bread aaye' => stock_in, product_name 'bread', quantity 50, unit 'pieces'. " +
            "'10 kg chawal becha' => stock_out, product_name 'chawal', quantity 10, unit 'kg'.",
        },
        {
          role: "user",
          content: `Voice command: "${transcription}"\nUser business type: ${
            userProfile.business_type || "General"
          }`,
        },
      ],
      functions: [
        {
          name: "process_inventory_command",
          description: "Normalize inventory voice command into structured action",
          parameters: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["stock_in", "stock_out", "check_stock"],
              },
              product_name: { type: "string" },
              quantity: { type: ["number", "null"] },
              unit: { type: ["string", "null"] },
              confidence: { type: "number" },
              notes: { type: ["string", "null"] },
            },
            required: ["action", "product_name", "confidence"],
          },
        },
      ],
      function_call: { name: "process_inventory_command" },
      temperature: 0.2,
    });

    const fnCall = response.choices[0]?.function_call;
    if (!fnCall || !fnCall.arguments) {
      throw new Error("No function call for inventory command");
    }

    const parsed = JSON.parse(fnCall.arguments);
    return {
      action: parsed.action,
      product_name: parsed.product_name,
      quantity: parsed.quantity ?? null,
      unit: parsed.unit || null,
      confidence: parsed.confidence ?? 0.5,
      notes: parsed.notes || null,
    };
  } catch (error) {
    console.error("Inventory voice processing error:", error);
    throw new Error("Failed to interpret inventory voice command");
  }
};

// Business Photo Analysis
const analyzeBusinessPhoto = async (imageBase64, userProfile = {}) => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this ${userProfile.business_type || 'business'} photo for business insights. Provide:
            
            1. Inventory assessment (if applicable)
            2. Customer traffic indicators
            3. Store condition and organization
            4. Potential improvements
            5. Business opportunities
            6. Cost optimization suggestions
            
            Focus on actionable insights for a ${userProfile.business_type || 'small business'} in ${userProfile.location || 'India'}.`
          },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
          }
        ]
      }],
      max_tokens: 1500,
      temperature: 0.4
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Business photo analysis error:", error);
    throw new Error("Failed to analyze business photo");
  }
};

// Text-to-Speech for AI responses
const generateSpeechResponse = async (text, language = 'en') => {
  try {
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text,
      response_format: "mp3"
    });

    return response;
  } catch (error) {
    console.error("Text-to-speech error:", error);
    throw new Error("Failed to generate speech");
  }
};

// Enhanced fallback text extraction with financial classification
const extractFinancialDataFromText = async (text, userProfile = {}) => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a financial data extraction expert. Use the extract_financial_data function to classify transactions." },
        { role: "user", content: `Extract and classify financial data from: "${text}"\n\nBusiness: ${userProfile.business_type || 'General'}` }
      ],
      functions: [{
        name: "extract_financial_data",
        description: "Extract and classify financial data",
        parameters: {
          type: "object",
          properties: {
            amount: { type: "number" },
            transaction_type: { type: "string", enum: ["expense", "revenue", "profit_distribution"] },
            category: { type: "string" },
            confidence: { type: "number" },
            notes: { type: "string" }
          },
          required: ["amount", "transaction_type", "confidence"]
        }
      }],
      function_call: { name: "extract_financial_data" },
      temperature: 0.1
    });
    
    const functionCall = response.choices[0].function_call;
    if (functionCall) {
      const parsed = JSON.parse(functionCall.arguments);
      return {
        amount: parsed.amount || 0,
        date: new Date().toISOString().split('T')[0],
        vendor: "Unknown",
        category: parsed.category || "General",
        transaction_type: parsed.transaction_type || "expense",
        confidence: parsed.confidence || 0.3,
        is_business_expense: parsed.transaction_type === "expense",
        is_revenue: parsed.transaction_type === "revenue",
        revenue_amount: parsed.transaction_type === "revenue" ? parsed.amount : 0,
        expense_amount: parsed.transaction_type === "expense" ? parsed.amount : 0,
        extracted_text: text
      };
    }
  } catch (error) {
    console.error('Fallback extraction error:', error);
  }
  
  // Final fallback - manual regex extraction (improved)
  // Match common currency patterns and decimals, e.g., '₹ 250.50', 'Rs. 250', '250 INR'
  const amountMatch = text.match(/(?:₹|Rs\.?|INR)?\s*([0-9]+(?:[.,][0-9]{1,2})?)/i);
  let amount = 0;
  if (amountMatch && amountMatch[1]) {
    amount = parseFloat(amountMatch[1].replace(/,/g, '')) || 0;
  }

  return {
    amount,
    date: null, // Prefer null over guessing
    vendor: "Unknown",
    category: "General",
    transaction_type: "expense", // Default to expense when unknown
    confidence: 0.2,
    is_business_expense: true,
    is_revenue: false,
    revenue_amount: 0,
    expense_amount: amount,
    extracted_text: text,
    notes: 'Fallback regex extraction used; low confidence'
  };
};

// Helper function for financial advice chat
const generateFinancialAdvice = async (userMessage, userProfile = {}) => {
  const systemPrompt = `You are an AI CFO Assistant with integrated market intelligence for Indian SMBs. Provide comprehensive business guidance combining financial management and market analysis in every response.

CORE CAPABILITIES:
Financial Analysis:
- Cash flow management and forecasting
- Expense optimization and cost reduction
- Profit margin analysis and improvement
- Budgeting and financial planning
- ROI and investment analysis
- GST and tax compliance

Market Intelligence:
- Competitor analysis and benchmarking
- Market trends and demand forecasting
- Pricing strategy optimization
- Expansion opportunity identification
- Customer market segment analysis
- Seasonal trend analysis

USER BUSINESS CONTEXT:
- Business: ${userProfile.business_type || "Not specified"}
- Location: ${userProfile.location || "India"}
- Monthly Revenue: ₹${userProfile.monthly_revenue || "Not specified"}
- Monthly Expenses: ₹${userProfile.monthly_expenses || "Not specified"}

RESPONSE STRUCTURE (Always Follow):
1. Quick Answer: 1-2 lines direct response
2. Financial Impact: Include ₹ amounts, cash flow effects, profitability impact
3. Market Context: Relevant trends, competition, opportunities in the user's market
4. Recommendations: 3-5 specific, actionable steps tailored to Indian SMBs
5. Success Metrics: KPIs to track progress

CRITICAL RULES:
- ALWAYS provide both financial AND market insights, even for simple queries
- Use ₹ for currency amounts (India focus)
- Reference GST, local regulations, and Indian business practices
- Include competitive positioning in market context
- Suggest metrics that matter for Indian SMB success
- Keep recommendations practical and implementation-focused
- For financial queries: add market opportunity angle
- For market queries: add financial feasibility/ROI angle
- Tailor all advice to Indian business environment`;

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

module.exports = {
  openai,
  createChatCompletion,
  generateFinancialAdvice,
  generateBusinessIdeas,
  generateProductAnalysis,
  analyzeReceiptImage,
  processVoiceCommand,
  interpretInventoryVoiceCommand,
  analyzeBusinessPhoto,
  generateSpeechResponse,
};
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

// AI Market Analysis Agent
// AI Market Analysis Agent with Structured Output
const generateMarketAnalysis = async (analysisData) => {
  const { profile, earnings, monthlySummaries, business_field, time_period } = analysisData;
  
  // Data validation and cleaning
  const cleanedMonths = monthlySummaries
    .filter(m => m.total_income > 0 && m.total_profit !== undefined)
    .slice(0, 12);
  
  if (cleanedMonths.length === 0) {
    return {
      executive_summary: "Insufficient historical data for market analysis",
      key_metrics: { warning: "Need at least 2 months of data" },
      opportunities: [],
      threats: [],
      recommendations: [
        { priority: "HIGH", action: "Continue tracking daily revenue for at least 2 months", expected_benefit: "Accurate market trends" }
      ],
      confidence_level: 0.2,
      data_quality_warning: true
    };
  }

  const recentMonths = cleanedMonths.slice(0, 6);
  const avgMonthlyRevenue = recentMonths.reduce((sum, month) => sum + (month.total_income || 0), 0) / recentMonths.length;
  const avgMonthlyProfit = recentMonths.reduce((sum, month) => sum + (month.total_profit || 0), 0) / recentMonths.length;
  const profitMargin = ((avgMonthlyProfit / avgMonthlyRevenue) * 100).toFixed(1);
  
  // Calculate volatility (standard deviation)
  const revenues = recentMonths.map(m => m.total_income);
  const avgRevenue = revenues.reduce((a, b) => a + b, 0) / revenues.length;
  const variance = revenues.reduce((sum, rev) => sum + Math.pow(rev - avgRevenue, 2), 0) / revenues.length;
  const volatility = Math.sqrt(variance);
  const volatilityPercent = ((volatility / avgRevenue) * 100).toFixed(1);
  
  const growthTrend = recentMonths.length > 1 
    ? ((recentMonths[0].total_income - recentMonths[1].total_income) / recentMonths[1].total_income * 100).toFixed(2)
    : 0;

  const systemPrompt = `You are an expert AI Market Analysis Agent for Indian small businesses. Your job is to provide DATA-DRIVEN, ACTIONABLE, and CLEAR market insights.

CRITICAL INSTRUCTIONS:
1. ALWAYS respond in valid JSON format (no plain text)
2. Be SPECIFIC with numbers, percentages, and rupee amounts
3. Provide confidence levels (0-1) for all predictions
4. Use SIMPLE language - avoid jargon, use examples
5. Focus on ACTIONABLE recommendations with realistic timelines
6. Highlight RISKS with mitigation strategies
7. Include business context from ${business_field || profile?.business_type || 'General'}

OUTPUT FORMAT (STRICTLY JSON):
{
  "executive_summary": "2-3 sentence summary for non-technical stakeholders",
  "key_metrics": {
    "current_monthly_revenue": "₹X",
    "profit_margin": "Y%",
    "revenue_volatility": "Z% (stability indicator)",
    "growth_trajectory": "+/-Z% over last 6 months"
  },
  "market_position": {
    "strength": "Competitive advantage or unique position",
    "weakness": "Primary business challenge",
    "industry_context": "How your business compares to similar businesses"
  },
  "opportunities": [
    {
      "title": "Clear, specific opportunity",
      "description": "Why this matters for your business",
      "potential_revenue_impact": "₹X-₹Y monthly",
      "timeline": "Weeks/Months to implement",
      "effort_level": "LOW/MEDIUM/HIGH",
      "implementation_steps": ["Step 1", "Step 2"]
    }
  ],
  "threats": [
    {
      "title": "Specific market or business threat",
      "probability": "HIGH/MEDIUM/LOW",
      "potential_impact": "₹X monthly loss if occurs",
      "mitigation_strategy": "Specific action to reduce risk"
    }
  ],
  "predictions": {
    "revenue_forecast_3_months": { "best_case": "₹X", "realistic": "₹Y", "worst_case": "₹Z", "confidence": 0.75 },
    "growth_prediction": "+Z% with X% confidence",
    "seasonal_patterns": "Peak in [month], Low in [month]"
  },
  "recommendations": [
    {
      "priority": "CRITICAL/HIGH/MEDIUM/LOW",
      "action": "Specific, actionable recommendation",
      "why_important": "How it improves your business",
      "expected_monthly_benefit": "₹X or +Y% growth",
      "timeframe": "Weeks/Months to see results",
      "resources_needed": "What you need (money, time, people)"
    }
  ],
  "confidence_level": 0.8,
  "data_quality": "EXCELLENT/GOOD/FAIR/LIMITED"
}`;

  const userPrompt = `Analyze market trends for this Indian business with STRUCTURED, CLEAR, ACTIONABLE insights:

BUSINESS PROFILE:
- Type: ${business_field || profile?.business_type || 'General Business'}
- Location: ${profile?.location || 'India'}
- Current Monthly Revenue: ₹${avgMonthlyRevenue.toFixed(0)}
- Profit Margin: ${profitMargin}%
- Revenue Stability: ${volatilityPercent}% volatility
- 6-Month Trend: ${growthTrend}%

HISTORICAL PERFORMANCE (Last ${recentMonths.length} months):
${recentMonths.map((month, idx) => 
  `${idx + 1}. ${month.month_name} ${month.year}: ₹${month.total_income} revenue, ₹${month.total_profit} profit (${month.growth_percentage}% change)`
).join('\n')}

RECENT DAILY DATA:
- Tracked days: ${earnings?.length || 0}
- Average daily revenue: ₹${earnings?.length > 0 ? (earnings.reduce((sum, e) => sum + (e.amount || 0), 0) / earnings.length).toFixed(0) : 0}

Provide analysis for the next ${time_period} with:
1. Clear market position assessment
2. Specific, realistic revenue & growth predictions with confidence %
3. 2-3 actionable opportunities with rupee impact
4. 2-3 specific threats with mitigation plans
5. Top 5 recommendations prioritized by impact
6. Use simple Hindi-English mix where helpful for clarity

Remember: Make it UNDERSTANDABLE for a non-MBA, busy business owner.`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];

  try {
    const response = await createChatCompletion(messages, { 
      max_tokens: 3000,
      temperature: 0.2, // Lower temp for consistency
      model: "gpt-4o-mini"
    });
    
    // Parse JSON response
    const analysisObj = JSON.parse(response);
    return analysisObj;
  } catch (parseError) {
    console.error('Failed to parse market analysis JSON:', parseError);
    // Fallback to structured response
    return {
      executive_summary: response.substring(0, 300),
      key_metrics: { 
        current_monthly_revenue: `₹${avgMonthlyRevenue.toFixed(0)}`,
        profit_margin: `${profitMargin}%`,
        growth_trajectory: `${growthTrend}%`
      },
      opportunities: [],
      threats: [],
      recommendations: [],
      confidence_level: 0.5,
      data_quality: "FAIR"
    };
  }
};

// AI Scenario Analysis Agent
// Improved Scenario Analysis with Structured Output
const generateScenarioAnalysis = async (businessData) => {
  const { profile, recentEarnings, monthlySummaries, scenarios, context } = businessData;
  
  const currentMetrics = {
    avgDailyRevenue: recentEarnings.length > 0 ? recentEarnings.reduce((sum, e) => sum + (e.amount || 0), 0) / recentEarnings.length : 0,
    avgDailyCost: recentEarnings.length > 0 ? recentEarnings.reduce((sum, e) => sum + (e.inventory_cost || 0), 0) / recentEarnings.length : 0,
    currentMonthRevenue: monthlySummaries[0]?.total_income || 0,
    profitMargin: monthlySummaries[0] ? ((monthlySummaries[0].total_profit / Math.max(monthlySummaries[0].total_income, 1)) * 100).toFixed(2) : 0
  };

  const systemPrompt = `You are an expert AI Business Scenario Analysis Agent. Analyze business scenarios with CLEAR, DATA-DRIVEN insights.

CRITICAL RULES:
1. ALWAYS respond in valid JSON (no plain text)
2. Give SPECIFIC rupee amounts, not vague percentages
3. Include PROBABILITY and TIMELINE for each impact
4. Provide ACTIONABLE steps the business owner can take TODAY
5. Explain SIMPLY - avoid business jargon

OUTPUT FORMAT (STRICTLY JSON):
{
  "scenarios": [
    {
      "scenario_name": "The exact scenario provided",
      "likelihood": "HIGH/MEDIUM/LOW",
      "severity": "CRITICAL/HIGH/MEDIUM/LOW",
      "impacts": {
        "immediate_1_30_days": {
          "revenue_impact": "₹X change or Y% change",
          "profit_impact": "₹X change or Y% change",
          "description": "Clear explanation of what happens"
        },
        "medium_term_1_3_months": { ... },
        "long_term_3_12_months": { ... }
      },
      "action_plan": [
        {
          "priority": "CRITICAL/HIGH/MEDIUM",
          "action": "Specific, actionable step",
          "timeline": "Do this TODAY/This week/This month",
          "resources_needed": "What you need (money, time, people)",
          "expected_outcome": "What happens if you do this"
        }
      ],
      "mitigation_strategies": [
        { "strategy": "Specific risk reduction action", "reduces_loss_by": "₹X or Y%" }
      ],
      "opportunities": [
        { "opportunity": "How to turn this into a positive", "potential_gain": "₹X monthly" }
      ]
    }
  ],
  "summary": "2-3 sentence overall assessment",
  "overall_risk_level": "CRITICAL/HIGH/MEDIUM/LOW"
}`;

  const userPrompt = `Analyze EACH of these ${scenarios.length} business scenarios for my ${profile?.business_type || 'business'} in ${profile?.location || 'India'}:

BUSINESS SNAPSHOT:
- Daily Revenue: ₹${currentMetrics.avgDailyRevenue.toFixed(0)} → Monthly: ₹${(currentMetrics.avgDailyRevenue * 30).toFixed(0)}
- Daily Costs: ₹${currentMetrics.avgDailyCost.toFixed(0)}
- Profit Margin: ${currentMetrics.profitMargin}%
- Current Month Revenue: ₹${currentMetrics.currentMonthRevenue}

SCENARIOS:
${scenarios.map((scenario, index) => `${index + 1}. "${scenario}"`).join('\n')}

EXTRA CONTEXT:
${context ? JSON.stringify(context) : 'None provided'}

For EACH scenario:
1. Rate likelihood & severity
2. Calculate ACTUAL rupee impact (not percentages) for each time period
3. Give 3-5 specific, immediate actions the owner can take
4. Show how to reduce losses or find opportunities
5. Use simple language - explain like you're talking to a small shop owner

Be PRACTICAL and REALISTIC about impacts.`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];

  try {
    const response = await createChatCompletion(messages, { 
      max_tokens: 4000,
      temperature: 0.2,
      model: "gpt-4o-mini"
    });
    
    return JSON.parse(response);
  } catch (parseError) {
    console.error('Failed to parse scenario analysis JSON:', parseError);
    // Return structured fallback
    return {
      scenarios: scenarios.map(s => ({
        scenario_name: s,
        likelihood: "MEDIUM",
        severity: "MEDIUM",
        impacts: {},
        action_plan: [{ priority: "HIGH", action: "Document this scenario", timeline: "TODAY" }],
        opportunities: []
      })),
      summary: "Analysis could not be fully generated. Please provide more business data.",
      overall_risk_level: "MEDIUM"
    };
  }
};

// Improved Predictive Insights Generator with Structured Output
const generatePredictiveInsights = async (predictionData) => {
  const { profile, earnings, monthlySummaries, prediction_type, time_horizon } = predictionData;
  
  // Calculate statistical metrics
  const monthlyTrends = monthlySummaries.slice(0, 12);
  const revenues = monthlyTrends.map(m => m.total_income);
  const avgMonthlyRevenue = revenues.reduce((a, b) => a + b, 0) / Math.max(revenues.length, 1);
  
  // Linear regression for trend
  let trendSlope = 0;
  if (revenues.length > 1) {
    const n = revenues.length;
    const sumX = (n * (n - 1)) / 2;
    const sumXY = revenues.reduce((sum, rev, i) => sum + i * rev, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    trendSlope = (n * sumXY - sumX * revenues.reduce((a, b) => a + b, 0)) / (n * sumX2 - sumX * sumX);
  }

  const systemPrompt = `You are an expert Predictive Analytics Agent for Indian small businesses.

CRITICAL RULES FOR ACCURACY:
1. ALWAYS respond in valid JSON format
2. Provide THREE scenarios: OPTIMISTIC, REALISTIC, PESSIMISTIC with probabilities
3. Include CONFIDENCE LEVEL (0-1) for each prediction
4. Show SPECIFIC rupee amounts, NOT vague percentages
5. Base predictions on ACTUAL historical data trends
6. Include RISK FACTORS and MITIGATION plans
7. Make it UNDERSTANDABLE for a non-finance person

OUTPUT FORMAT (STRICTLY JSON):
{
  "prediction_type": "The type of prediction requested",
  "time_horizon": "The forecast period",
  "confidence_summary": "Overall confidence in predictions (0-1)",
  "revenue_forecast": {
    "optimistic": { "amount": ₹X, "probability": "X%", "assumptions": "..." },
    "realistic": { "amount": ₹X, "probability": "X%", "assumptions": "..." },
    "pessimistic": { "amount": ₹X, "probability": "X%", "assumptions": "..." },
    "recommended_plan": "Which scenario to prepare for"
  },
  "profit_forecast": { ... similar structure ... },
  "growth_rate_prediction": "+/-X% with Y% confidence",
  "seasonal_patterns": {
    "peak_months": "Months when revenue typically highest",
    "low_months": "Months when revenue typically lowest",
    "peak_impact": "₹X higher than average",
    "low_impact": "₹X lower than average"
  },
  "key_risk_factors": [
    { "risk": "Specific risk", "probability": "HIGH/MEDIUM/LOW", "mitigation": "Action to reduce risk" }
  ],
  "opportunities": [
    { "opportunity": "Specific actionable opportunity", "potential_impact": "₹X gain" }
  ],
  "action_items": [
    { "priority": "CRITICAL/HIGH/MEDIUM", "action": "Specific action for this forecast", "timeline": "When to do it" }
  ],
  "data_quality_note": "How reliable is the prediction (based on data points)"
}`;

  const timeHorizonText = time_horizon === '3_months' ? '3 months' : 
                         time_horizon === '6_months' ? '6 months' :
                         time_horizon === '1_year' ? '1 year' : '3 months';

  const userPrompt = `Generate REALISTIC, DATA-DRIVEN ${prediction_type} predictions for ${timeHorizonText} for my ${profile?.business_type || 'business'}.

HISTORICAL DATA (Shows the trend):
${monthlyTrends.slice(0, 6).map((month, idx) => 
  `Month ${idx + 1}: ${month.month_name} ${month.year} - Revenue: ₹${month.total_income}, Profit: ₹${month.total_profit}`
).join('\n')}

CURRENT SITUATION:
- Average Monthly Revenue: ₹${avgMonthlyRevenue.toFixed(0)}
- Revenue Trend: ${trendSlope > 0 ? 'GROWING' : trendSlope < 0 ? 'DECLINING' : 'STABLE'} (₹${Math.abs(trendSlope).toFixed(0)}/month change)
- Data Quality: ${monthlyTrends.length} months of historical data
- Business Type: ${profile?.business_type}
- Location: ${profile?.location}

RECENT DAILY DATA:
- Last ${Math.min(earnings?.length || 0, 30)} days tracked
- Average daily revenue: ₹${earnings?.length > 0 ? (earnings.reduce((sum, e) => sum + (e.amount || 0), 0) / earnings.length).toFixed(0) : 0}

For the next ${timeHorizonText}, provide:
1. THREE revenue scenarios with realistic rupee amounts based on the trend
2. Probability for each scenario (must add up to 100%)
3. Profit forecasts
4. Seasonal patterns if any
5. Top 3 risks and how to manage them
6. Top 3 opportunities
7. Specific actions to take NOW

Be CONSERVATIVE and REALISTIC - not overly optimistic. Base numbers on actual historical trend.`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];

  try {
    const response = await createChatCompletion(messages, { 
      max_tokens: 3500,
      temperature: 0.15, // Very low temp for consistency
      model: "gpt-4o-mini"
    });
    
    return JSON.parse(response);
  } catch (parseError) {
    console.error('Failed to parse predictive insights JSON:', parseError);
    // Fallback with data-driven defaults
    const predictedRevenue = avgMonthlyRevenue * (1 + (trendSlope / avgMonthlyRevenue));
    return {
      prediction_type,
      time_horizon,
      confidence_summary: monthlyTrends.length >= 6 ? 0.65 : 0.35,
      revenue_forecast: {
        optimistic: { amount: (predictedRevenue * 1.15).toFixed(0), probability: "20%", assumptions: "Positive market conditions" },
        realistic: { amount: predictedRevenue.toFixed(0), probability: "60%", assumptions: "Current trend continues" },
        pessimistic: { amount: (predictedRevenue * 0.85).toFixed(0), probability: "20%", assumptions: "Negative market conditions" }
      },
      data_quality_note: `Based on ${monthlyTrends.length} months of data. More data = better predictions.`
    };
  }
};

// Proactive Voice Assistant with Business Intelligence
const generateProactiveResponse = async (command, businessContext) => {
  const systemPrompt = `You are an advanced AI CFO assistant with proactive business intelligence capabilities.
  
  BUSINESS CONTEXT:
  - Business: ${businessContext.profile?.business_name || 'Unknown'}
  - Type: ${businessContext.profile?.business_type || 'General'}
  - Current Health Score: ${businessContext.business_health?.score || 0}/100
  - Today's Revenue: ₹${businessContext.recent_performance?.[0]?.amount || 0}
  - Cash Flow Status: ${businessContext.business_health?.status || 'unknown'}
  
  CAPABILITIES:
  1. Proactive business monitoring and alerts
  2. Real-time financial analysis and recommendations
  3. Predictive insights and trend analysis
  4. Automated action execution (expenses, reports, alerts)
  5. Contextual business advice in Hindi/English
  
  RESPONSE FORMAT (JSON):
  {
    "message": "Response in Hindi/English based on user preference",
    "action": "add_expense|generate_report|send_alert|analyze_trends|null",
    "data": { action_specific_data },
    "priority": 1-5,
    "confidence": 0.1-1.0,
    "immediate_action": { type, data } or null,
    "follow_up_suggestions": ["suggestion1", "suggestion2"]
  }
  
  Be proactive, intelligent, and business-focused. Provide actionable insights.`;

  const userPrompt = `Voice Command: "${command}"
  
  Current Time: ${businessContext.timestamp}
  Business Hours: ${businessContext.business_hours ? 'Yes' : 'No'}
  
  Analyze the command and provide intelligent response with appropriate actions.`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];

  try {
    const response = await createChatCompletion(messages, { 
      max_tokens: 1500,
      temperature: 0.3,
      model: "gpt-4o-mini"
    });
    
    return JSON.parse(response);
  } catch (error) {
    console.error('Proactive response generation error:', error);
    return {
      message: "मुझे समझने में कुछ समस्या हुई है। कृपया दोबारा कोशिश करें।",
      action: null,
      priority: 1,
      confidence: 0.1
    };
  }
};

// Generate Business Alerts with AI
const generateBusinessAlerts = async (alertData) => {
  const { metrics, context, preferences, user_id } = alertData;
  
  const systemPrompt = `You are an AI business monitoring system. Analyze business metrics and generate intelligent alerts.
  
  CURRENT METRICS:
  - Today's Revenue: ₹${metrics.today?.revenue || 0}
  - Today's Expenses: ₹${metrics.today?.expenses || 0}
  - Cash Flow: ₹${metrics.summary?.cash_flow || 0}
  - Daily Target Progress: ${metrics.summary?.daily_target_progress || 0}%
  
  ALERT CRITERIA:
  - Generate alerts for significant changes (>20% variance)
  - Prioritize cash flow issues (priority 4-5)
  - Consider business hours and user preferences
  - Provide actionable recommendations
  
  Return array of alerts in JSON format:
  [{
    "type": "cash_flow|revenue|expense|opportunity|warning",
    "message": "Alert message in Hindi/English",
    "priority": 1-5,
    "action_required": "Specific action needed",
    "impact": "Potential business impact",
    "urgency": "immediate|today|this_week"
  }]`;

  const userPrompt = `Analyze current business state and generate relevant alerts.
  
  Business Context: ${JSON.stringify(context, null, 2)}
  Alert Preferences: ${JSON.stringify(preferences, null, 2)}
  
  Focus on actionable insights that can improve business performance.`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];

  try {
    const response = await createChatCompletion(messages, { 
      max_tokens: 2000,
      temperature: 0.2,
      model: "gpt-4o-mini"
    });
    
    return JSON.parse(response);
  } catch (error) {
    console.error('Business alerts generation error:', error);
    return [];
  }
};
