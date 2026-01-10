const OpenAI = require("openai");
const config = require("../config/env");

// Simple wrapper that exports an `openai` client used by vectorService
const openai = new OpenAI({ apiKey: config.openai.apiKey });

// Generate completion function
const generateCompletion = async (prompt, options = {}) => {
  try {
    const response = await openai.chat.completions.create({
      model: options.model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options.max_tokens || 150,
      temperature: options.temperature || 0.7
    });
    
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
};

module.exports = { openai, generateCompletion };
