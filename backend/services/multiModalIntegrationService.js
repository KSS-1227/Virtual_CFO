const { getAuthenticatedClient } = require('../config/supabase');
const { generateCompletion, generateVisionCompletion } = require('./openai');
const { processVoiceCommand } = require('./advancedVoiceService');
const smartSuggestionsService = require('./smartSuggestionsService');
const audioConfirmationService = require('./audioConfirmationService');
const redisService = require('./redisService');

class MultiModalIntegrationService {
  constructor() {
    this.processingModes = {
      IMAGE_ONLY: 'image_only',
      VOICE_ONLY: 'voice_only',
      TEXT_ONLY: 'text_only',
      IMAGE_VOICE: 'image_voice',
      IMAGE_TEXT: 'image_text',
      VOICE_TEXT: 'voice_text',
      ALL_MODES: 'all_modes'
    };
    
    this.workflowTypes = {
      INVENTORY_ADD: 'inventory_add',
      INVENTORY_UPDATE: 'inventory_update',
      STOCK_CHECK: 'stock_check',
      REORDER_ANALYSIS: 'reorder_analysis',
      SUPPLIER_EVALUATION: 'supplier_evaluation'
    };
  }

  // Main multi-modal processing endpoint
  async processMultiModalInput(userId, inputs, workflowType = this.workflowTypes.INVENTORY_ADD) {
    try {
      const sessionId = this.generateSessionId();
      
      // Validate inputs
      const validatedInputs = await this.validateInputs(inputs);
      if (!validatedInputs.isValid) {
        return { error: validatedInputs.error, sessionId };
      }

      // Determine processing mode
      const processingMode = this.determineProcessingMode(inputs);
      
      // Process each input type
      const processedData = await this.processInputsByType(userId, inputs, processingMode);
      
      // Integrate and resolve conflicts
      const integratedData = await this.integrateProcessedData(processedData, workflowType);
      
      // Generate smart suggestions
      const suggestions = await this.generateContextualSuggestions(userId, integratedData, processingMode);
      
      // Create conversational flow
      const conversationalFlow = await this.createConversationalFlow(userId, integratedData, suggestions, sessionId);
      
      // Store session data
      await this.storeSessionData(userId, sessionId, {
        inputs,
        processedData,
        integratedData,
        suggestions,
        conversationalFlow,
        workflowType,
        processingMode
      });

      return {
        sessionId,
        processingMode,
        integratedData,
        suggestions,
        conversationalFlow,
        confidence: this.calculateOverallConfidence(processedData),
        nextSteps: this.generateNextSteps(integratedData, suggestions),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Multi-modal processing error:', error);
      return { error: error.message };
    }
  }

  async validateInputs(inputs) {
    const errors = [];
    
    if (!inputs || Object.keys(inputs).length === 0) {
      return { isValid: false, error: 'No inputs provided' };
    }
    
    // Validate image inputs
    if (inputs.images) {
      if (!Array.isArray(inputs.images)) {
        errors.push('Images must be an array');
      } else {
        inputs.images.forEach((img, index) => {
          if (!img.data && !img.url) {
            errors.push(`Image ${index + 1} missing data or URL`);
          }
        });
      }
    }
    
    // Validate voice inputs
    if (inputs.voice) {
      if (!inputs.voice.data && !inputs.voice.url) {
        errors.push('Voice input missing data or URL');
      }
    }
    
    // Validate text inputs
    if (inputs.text && typeof inputs.text !== 'string') {
      errors.push('Text input must be a string');
    }
    
    return {
      isValid: errors.length === 0,
      error: errors.length > 0 ? errors.join(', ') : null
    };
  }

  determineProcessingMode(inputs) {
    const hasImage = inputs.images && inputs.images.length > 0;
    const hasVoice = inputs.voice && (inputs.voice.data || inputs.voice.url);
    const hasText = inputs.text && inputs.text.trim().length > 0;
    
    if (hasImage && hasVoice && hasText) return this.processingModes.ALL_MODES;
    if (hasImage && hasVoice) return this.processingModes.IMAGE_VOICE;
    if (hasImage && hasText) return this.processingModes.IMAGE_TEXT;
    if (hasVoice && hasText) return this.processingModes.VOICE_TEXT;
    if (hasImage) return this.processingModes.IMAGE_ONLY;
    if (hasVoice) return this.processingModes.VOICE_ONLY;
    if (hasText) return this.processingModes.TEXT_ONLY;
    
    throw new Error('No valid inputs detected');
  }

  async processInputsByType(userId, inputs, processingMode) {
    const processedData = {
      image: null,
      voice: null,
      text: null,
      confidence: {},
      metadata: {}
    };

    // Process images
    if (inputs.images) {
      processedData.image = await this.processImageInputs(userId, inputs.images);
      processedData.confidence.image = processedData.image.confidence;
    }

    // Process voice
    if (inputs.voice) {
      processedData.voice = await this.processVoiceInput(userId, inputs.voice);
      processedData.confidence.voice = processedData.voice.confidence;
    }

    // Process text
    if (inputs.text) {
      processedData.text = await this.processTextInput(userId, inputs.text);
      processedData.confidence.text = processedData.text.confidence;
    }

    return processedData;
  }

  async processImageInputs(userId, images) {
    try {
      const results = [];
      
      for (const image of images) {
        const prompt = `Analyze this inventory-related image and extract:
        1. Product name(s)
        2. Quantity visible
        3. Category/type
        4. Condition assessment
        5. Any visible text/labels
        6. Estimated value/price if visible
        7. Storage location clues
        
        Format as JSON: {
          "products": [{"name": "", "quantity": 0, "category": "", "condition": "", "confidence": 0.0}],
          "text_detected": "",
          "location_clues": "",
          "overall_assessment": ""
        }`;

        const visionResult = await generateVisionCompletion(prompt, image.data || image.url);
        
        try {
          const parsed = JSON.parse(visionResult);
          results.push({
            ...parsed,
            imageIndex: results.length,
            processingTime: new Date().toISOString()
          });
        } catch (parseError) {
          console.error('Error parsing vision result:', parseError);
          results.push({
            products: [],
            text_detected: visionResult.substring(0, 200),
            error: 'Failed to parse structured data',
            imageIndex: results.length
          });
        }
      }

      return {
        results,
        totalImages: images.length,
        confidence: this.calculateImageConfidence(results),
        extractedProducts: this.consolidateImageProducts(results)
      };
    } catch (error) {
      console.error('Image processing error:', error);
      return { error: error.message, confidence: 0 };
    }
  }

  async processVoiceInput(userId, voice) {
    try {
      // Use existing voice processing service
      const voiceResult = await processVoiceCommand(userId, voice.data || voice.url, {
        context: 'inventory_management',
        expectStructuredData: true
      });

      // Extract inventory-specific information
      const inventoryData = await this.extractInventoryFromVoice(voiceResult);

      return {
        transcription: voiceResult.transcription,
        intent: voiceResult.intent,
        entities: voiceResult.entities,
        inventoryData,
        confidence: voiceResult.confidence,
        language: voiceResult.language || 'en'
      };
    } catch (error) {
      console.error('Voice processing error:', error);
      return { error: error.message, confidence: 0 };
    }
  }

  async extractInventoryFromVoice(voiceResult) {
    try {
      const prompt = `Extract inventory information from this voice command:
      
      Transcription: "${voiceResult.transcription}"
      Intent: ${voiceResult.intent}
      Entities: ${JSON.stringify(voiceResult.entities)}
      
      Extract and format as JSON:
      {
        "action": "add|update|check|reorder",
        "products": [{"name": "", "quantity": 0, "category": "", "supplier": "", "price": 0}],
        "location": "",
        "urgency": "low|medium|high",
        "additional_notes": ""
      }`;

      const response = await generateCompletion(prompt, { max_tokens: 300 });
      
      try {
        return JSON.parse(response);
      } catch (parseError) {
        return {
          action: voiceResult.intent,
          products: [],
          raw_extraction: response,
          error: 'Failed to parse structured data'
        };
      }
    } catch (error) {
      console.error('Error extracting inventory from voice:', error);
      return { error: error.message };
    }
  }

  async processTextInput(userId, text) {
    try {
      const prompt = `Analyze this inventory-related text and extract structured information:
      
      Text: "${text}"
      
      Extract and format as JSON:
      {
        "intent": "add|update|check|reorder|analyze",
        "products": [{"name": "", "quantity": 0, "category": "", "supplier": "", "price": 0}],
        "action_required": "",
        "context": "",
        "confidence": 0.0
      }`;

      const response = await generateCompletion(prompt, { max_tokens: 400 });
      
      try {
        const parsed = JSON.parse(response);
        return {
          ...parsed,
          originalText: text,
          processingTime: new Date().toISOString()
        };
      } catch (parseError) {
        return {
          intent: 'unknown',
          products: [],
          originalText: text,
          raw_extraction: response,
          confidence: 0.3,
          error: 'Failed to parse structured data'
        };
      }
    } catch (error) {
      console.error('Text processing error:', error);
      return { error: error.message, confidence: 0 };
    }
  }

  async integrateProcessedData(processedData, workflowType) {
    const integrated = {
      products: [],
      actions: [],
      conflicts: [],
      confidence: 0,
      metadata: {}
    };

    // Collect all products from different sources
    const allProducts = [];
    
    if (processedData.image?.extractedProducts) {
      allProducts.push(...processedData.image.extractedProducts.map(p => ({ ...p, source: 'image' })));
    }
    
    if (processedData.voice?.inventoryData?.products) {
      allProducts.push(...processedData.voice.inventoryData.products.map(p => ({ ...p, source: 'voice' })));
    }
    
    if (processedData.text?.products) {
      allProducts.push(...processedData.text.products.map(p => ({ ...p, source: 'text' })));
    }

    // Resolve conflicts and merge similar products
    integrated.products = await this.resolveProductConflicts(allProducts);
    
    // Determine primary action
    integrated.actions = this.determineActions(processedData, workflowType);
    
    // Calculate overall confidence
    integrated.confidence = this.calculateIntegrationConfidence(processedData, integrated.conflicts);
    
    // Add metadata
    integrated.metadata = {
      processingMode: this.determineProcessingMode(processedData),
      workflowType,
      sourcesUsed: Object.keys(processedData).filter(key => processedData[key] && !processedData[key].error),
      timestamp: new Date().toISOString()
    };

    return integrated;
  }

  async resolveProductConflicts(allProducts) {
    const resolvedProducts = [];
    const productGroups = {};

    // Group similar products
    allProducts.forEach(product => {
      const key = this.generateProductKey(product.name);
      if (!productGroups[key]) {
        productGroups[key] = [];
      }
      productGroups[key].push(product);
    });

    // Resolve conflicts within each group
    for (const [key, products] of Object.entries(productGroups)) {
      if (products.length === 1) {
        resolvedProducts.push(products[0]);
      } else {
        const resolved = await this.mergeConflictingProducts(products);
        resolvedProducts.push(resolved);
      }
    }

    return resolvedProducts;
  }

  async mergeConflictingProducts(products) {
    const merged = {
      name: this.selectBestValue(products, 'name'),
      quantity: this.selectBestValue(products, 'quantity', 'number'),
      category: this.selectBestValue(products, 'category'),
      supplier: this.selectBestValue(products, 'supplier'),
      price: this.selectBestValue(products, 'price', 'number'),
      sources: products.map(p => p.source),
      confidence: products.reduce((sum, p) => sum + (p.confidence || 0.5), 0) / products.length,
      conflicts: this.identifyConflicts(products)
    };

    return merged;
  }

  selectBestValue(products, field, type = 'string') {
    const values = products
      .map(p => p[field])
      .filter(v => v !== null && v !== undefined && v !== '');

    if (values.length === 0) return type === 'number' ? 0 : '';
    if (values.length === 1) return values[0];

    // For numbers, take average or most common
    if (type === 'number') {
      const numbers = values.filter(v => typeof v === 'number' && !isNaN(v));
      if (numbers.length === 0) return 0;
      return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    }

    // For strings, take most common or highest confidence source
    const valueCounts = {};
    values.forEach(v => {
      valueCounts[v] = (valueCounts[v] || 0) + 1;
    });

    return Object.entries(valueCounts)
      .sort(([,a], [,b]) => b - a)[0][0];
  }

  identifyConflicts(products) {
    const conflicts = [];
    const fields = ['name', 'quantity', 'category', 'supplier', 'price'];

    fields.forEach(field => {
      const values = [...new Set(products.map(p => p[field]).filter(v => v))];
      if (values.length > 1) {
        conflicts.push({
          field,
          values,
          sources: products.map(p => ({ source: p.source, value: p[field] }))
        });
      }
    });

    return conflicts;
  }

  determineActions(processedData, workflowType) {
    const actions = [];

    // Extract actions from voice
    if (processedData.voice?.inventoryData?.action) {
      actions.push({
        type: processedData.voice.inventoryData.action,
        source: 'voice',
        confidence: processedData.voice.confidence
      });
    }

    // Extract actions from text
    if (processedData.text?.intent) {
      actions.push({
        type: processedData.text.intent,
        source: 'text',
        confidence: processedData.text.confidence
      });
    }

    // Default action based on workflow type
    if (actions.length === 0) {
      actions.push({
        type: workflowType,
        source: 'default',
        confidence: 0.5
      });
    }

    return actions;
  }

  async generateContextualSuggestions(userId, integratedData, processingMode) {
    const suggestions = {
      products: [],
      categories: [],
      suppliers: [],
      locations: [],
      actions: []
    };

    // Generate suggestions for each product
    for (const product of integratedData.products) {
      if (product.name) {
        const productSuggestions = await smartSuggestionsService.getSmartSuggestions(
          userId,
          'product_name',
          product.name,
          { category: product.category, supplier: product.supplier }
        );
        suggestions.products.push(...productSuggestions);
      }

      if (product.category) {
        const categorySuggestions = await smartSuggestionsService.getSmartSuggestions(
          userId,
          'category',
          product.category
        );
        suggestions.categories.push(...categorySuggestions);
      }

      if (product.supplier) {
        const supplierSuggestions = await smartSuggestionsService.getSmartSuggestions(
          userId,
          'supplier',
          product.supplier
        );
        suggestions.suppliers.push(...supplierSuggestions);
      }
    }

    // Generate action suggestions based on processing mode
    suggestions.actions = this.generateActionSuggestions(integratedData, processingMode);

    return suggestions;
  }

  generateActionSuggestions(integratedData, processingMode) {
    const suggestions = [];

    // Suggest verification for low confidence data
    if (integratedData.confidence < 0.7) {
      suggestions.push({
        type: 'verify_data',
        message: 'Some information has low confidence. Would you like to verify the details?',
        priority: 'high'
      });
    }

    // Suggest completing missing information
    const incompleteProducts = integratedData.products.filter(p => 
      !p.name || !p.category || p.quantity === 0
    );
    
    if (incompleteProducts.length > 0) {
      suggestions.push({
        type: 'complete_information',
        message: `${incompleteProducts.length} products need additional information`,
        priority: 'medium'
      });
    }

    // Suggest conflict resolution
    if (integratedData.conflicts.length > 0) {
      suggestions.push({
        type: 'resolve_conflicts',
        message: 'Multiple sources provided different information. Please review conflicts.',
        priority: 'high'
      });
    }

    return suggestions;
  }

  async createConversationalFlow(userId, integratedData, suggestions, sessionId) {
    const flow = {
      sessionId,
      currentStep: 0,
      steps: [],
      context: integratedData,
      awaitingResponse: false
    };

    // Step 1: Confirm extracted data
    flow.steps.push({
      type: 'confirmation',
      message: await this.generateConfirmationMessage(integratedData),
      expectedResponse: 'yes_no',
      data: integratedData.products
    });

    // Step 2: Handle conflicts if any
    if (integratedData.conflicts.length > 0) {
      flow.steps.push({
        type: 'conflict_resolution',
        message: await this.generateConflictMessage(integratedData.conflicts),
        expectedResponse: 'selection',
        data: integratedData.conflicts
      });
    }

    // Step 3: Complete missing information
    const incompleteProducts = integratedData.products.filter(p => !p.name || !p.category);
    if (incompleteProducts.length > 0) {
      flow.steps.push({
        type: 'complete_data',
        message: 'Please provide missing information for the following items:',
        expectedResponse: 'structured_input',
        data: incompleteProducts
      });
    }

    // Step 4: Final confirmation and save
    flow.steps.push({
      type: 'final_save',
      message: 'Ready to save to inventory. Shall I proceed?',
      expectedResponse: 'yes_no',
      data: null
    });

    flow.awaitingResponse = flow.steps.length > 0;

    return flow;
  }

  async generateConfirmationMessage(integratedData) {
    const products = integratedData.products;
    if (products.length === 0) {
      return "I couldn't extract any product information. Could you please provide more details?";
    }

    if (products.length === 1) {
      const p = products[0];
      return `I found: ${p.name || 'Unknown item'}${p.quantity ? ` (Quantity: ${p.quantity})` : ''}${p.category ? ` in ${p.category}` : ''}. Is this correct?`;
    }

    return `I found ${products.length} items: ${products.map(p => p.name || 'Unknown').join(', ')}. Should I add these to your inventory?`;
  }

  async generateConflictMessage(conflicts) {
    const conflictDescriptions = conflicts.map(c => 
      `${c.field}: ${c.values.join(' vs ')}`
    ).join(', ');
    
    return `I found conflicting information: ${conflictDescriptions}. Which values should I use?`;
  }

  // Continue conversational flow
  async continueConversationalFlow(userId, sessionId, userResponse) {
    try {
      const sessionData = await this.getSessionData(userId, sessionId);
      if (!sessionData) {
        return { error: 'Session not found' };
      }

      const flow = sessionData.conversationalFlow;
      const currentStep = flow.steps[flow.currentStep];

      if (!currentStep) {
        return { error: 'No active step in conversation' };
      }

      // Process user response based on step type
      const processedResponse = await this.processStepResponse(
        currentStep,
        userResponse,
        sessionData
      );

      // Move to next step or complete flow
      flow.currentStep++;
      
      if (flow.currentStep >= flow.steps.length) {
        // Flow complete - execute final action
        const result = await this.executeInventoryAction(userId, sessionData);
        
        // Generate audio confirmation
        await audioConfirmationService.generateConfirmation(
          userId,
          'inventory_added',
          { products: sessionData.integratedData.products },
          'en'
        );

        return {
          completed: true,
          result,
          message: 'Inventory updated successfully!',
          audioConfirmation: true
        };
      }

      // Continue to next step
      const nextStep = flow.steps[flow.currentStep];
      await this.updateSessionData(userId, sessionId, sessionData);

      return {
        sessionId,
        currentStep: flow.currentStep,
        nextStep,
        processedResponse,
        awaitingResponse: true
      };
    } catch (error) {
      console.error('Error continuing conversational flow:', error);
      return { error: error.message };
    }
  }

  async processStepResponse(step, userResponse, sessionData) {
    switch (step.type) {
      case 'confirmation':
        return this.processConfirmationResponse(step, userResponse, sessionData);
      case 'conflict_resolution':
        return this.processConflictResponse(step, userResponse, sessionData);
      case 'complete_data':
        return this.processDataCompletionResponse(step, userResponse, sessionData);
      case 'final_save':
        return this.processFinalSaveResponse(step, userResponse, sessionData);
      default:
        return { processed: false, error: 'Unknown step type' };
    }
  }

  async processConfirmationResponse(step, userResponse, sessionData) {
    const isPositive = this.isPositiveResponse(userResponse);
    
    if (isPositive) {
      return { confirmed: true, action: 'proceed' };
    } else {
      return { confirmed: false, action: 'request_correction' };
    }
  }

  isPositiveResponse(response) {
    const positive = ['yes', 'yeah', 'yep', 'correct', 'right', 'ok', 'okay', 'sure', 'हाँ', 'जी', 'ठीक'];
    return positive.some(word => response.toLowerCase().includes(word));
  }

  async executeInventoryAction(userId, sessionData) {
    try {
      const supabase = getAuthenticatedClient();
      const products = sessionData.integratedData.products;
      
      const insertData = products.map(product => ({
        user_id: userId,
        name: product.name,
        category: product.category,
        quantity: product.quantity || 0,
        unit_price: product.price || 0,
        supplier: product.supplier,
        location: product.location,
        reorder_point: product.reorder_point || Math.ceil((product.quantity || 0) * 0.2),
        created_at: new Date().toISOString(),
        multimodal_session_id: sessionData.sessionId,
        confidence_score: product.confidence || 0.8
      }));

      const { data, error } = await supabase
        .from('inventory_items')
        .insert(insertData)
        .select();

      if (error) throw error;

      return {
        success: true,
        itemsAdded: data.length,
        items: data
      };
    } catch (error) {
      console.error('Error executing inventory action:', error);
      return { success: false, error: error.message };
    }
  }

  // Utility methods
  generateSessionId() {
    return `mm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateProductKey(productName) {
    return productName?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'unknown';
  }

  calculateImageConfidence(results) {
    if (!results || results.length === 0) return 0;
    
    const confidences = results
      .filter(r => !r.error)
      .flatMap(r => r.products || [])
      .map(p => p.confidence || 0.5);
    
    return confidences.length > 0 
      ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length 
      : 0.3;
  }

  consolidateImageProducts(results) {
    const products = [];
    
    results.forEach(result => {
      if (result.products) {
        products.push(...result.products);
      }
    });
    
    return products;
  }

  calculateOverallConfidence(processedData) {
    const confidences = Object.values(processedData.confidence).filter(c => c > 0);
    return confidences.length > 0 
      ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length 
      : 0.5;
  }

  calculateIntegrationConfidence(processedData, conflicts) {
    let baseConfidence = this.calculateOverallConfidence(processedData);
    
    // Reduce confidence for conflicts
    if (conflicts.length > 0) {
      baseConfidence *= (1 - (conflicts.length * 0.1));
    }
    
    return Math.max(0.1, Math.min(0.95, baseConfidence));
  }

  generateNextSteps(integratedData, suggestions) {
    const steps = [];
    
    if (integratedData.confidence < 0.7) {
      steps.push('Verify extracted information');
    }
    
    if (integratedData.conflicts.length > 0) {
      steps.push('Resolve data conflicts');
    }
    
    const incompleteProducts = integratedData.products.filter(p => !p.name || !p.category);
    if (incompleteProducts.length > 0) {
      steps.push('Complete missing product information');
    }
    
    if (steps.length === 0) {
      steps.push('Ready to save to inventory');
    }
    
    return steps;
  }

  async storeSessionData(userId, sessionId, data) {
    try {
      await redisService.setex(`multimodal_session:${userId}:${sessionId}`, 3600, JSON.stringify(data));
    } catch (error) {
      console.error('Error storing session data:', error);
    }
  }

  async getSessionData(userId, sessionId) {
    try {
      const data = await redisService.get(`multimodal_session:${userId}:${sessionId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting session data:', error);
      return null;
    }
  }

  async updateSessionData(userId, sessionId, data) {
    try {
      await redisService.setex(`multimodal_session:${userId}:${sessionId}`, 3600, JSON.stringify(data));
    } catch (error) {
      console.error('Error updating session data:', error);
    }
  }
}

module.exports = new MultiModalIntegrationService();