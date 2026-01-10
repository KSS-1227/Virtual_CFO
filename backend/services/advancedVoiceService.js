const { openai } = require("../config/openai");
const { InventoryLearningService } = require("./inventoryLearningService");
const natural = require("natural");

/**
 * Advanced Voice Features Service
 * Handles mixed Hindi-English voice processing, audio confirmations, and ambiguity resolution
 */
class AdvancedVoiceService {
  constructor() {
    this.learningService = new InventoryLearningService();
    
    // Hindi-English mixed language patterns
    this.hindiEnglishPatterns = {
      quantity: {
        hindi: ['kitna', 'kitne', 'jitna', 'jitne'],
        english: ['how much', 'how many', 'quantity']
      },
      units: {
        hindi: ['piece', 'pieces', 'kg', 'kilo', 'packet', 'box', 'dabba'],
        english: ['piece', 'pieces', 'kg', 'kilogram', 'packet', 'box', 'unit']
      },
      actions: {
        add: {
          hindi: ['aaya', 'aaye', 'mila', 'mile', 'add', 'daal'],
          english: ['received', 'got', 'add', 'added', 'came']
        },
        remove: {
          hindi: ['gaya', 'gaye', 'becha', 'beche', 'nikala', 'nikale'],
          english: ['sold', 'removed', 'used', 'taken out']
        }
      },
      time: {
        hindi: ['aaj', 'kal', 'parso', 'subah', 'shaam'],
        english: ['today', 'yesterday', 'tomorrow', 'morning', 'evening']
      }
    };
  }

  /**
   * Process mixed Hindi-English voice commands
   */
  async processMixedLanguageCommand(audioBuffer, userId, supabase) {
    try {
      // Step 1: Transcribe audio using Whisper
      const transcription = await this.transcribeAudio(audioBuffer);
      
      // Step 2: Parse mixed language command
      const parsedCommand = await this.parseMixedLanguageCommand(transcription.text, userId, supabase);
      
      // Step 3: Validate and resolve ambiguities
      const validatedCommand = await this.validateAndResolveAmbiguities(parsedCommand, userId, supabase);
      
      // Step 4: Learn from voice patterns
      await this.learnVoicePatterns(userId, transcription.text, validatedCommand, supabase);
      
      return {
        success: true,
        transcription: transcription.text,
        parsed_command: validatedCommand,
        confidence: transcription.confidence || 0.8,
        language_detected: this.detectLanguageMix(transcription.text)
      };

    } catch (error) {
      console.error("Error processing mixed language command:", error);
      throw error;
    }
  }

  /**
   * Transcribe audio using OpenAI Whisper
   */
  async transcribeAudio(audioBuffer) {
    try {
      const transcription = await openai.audio.transcriptions.create({
        file: audioBuffer,
        model: "whisper-1",
        language: "hi", // Hindi, but Whisper can handle mixed languages
        response_format: "verbose_json",
        temperature: 0.2
      });

      return {
        text: transcription.text,
        confidence: transcription.confidence || 0.8,
        language: transcription.language
      };

    } catch (error) {
      console.error("Error transcribing audio:", error);
      throw new Error("Failed to transcribe audio");
    }
  }

  /**
   * Parse mixed Hindi-English command using NLP and patterns
   */
  async parseMixedLanguageCommand(text, userId, supabase) {
    try {
      const tokens = text.toLowerCase().split(/\s+/);
      const command = {
        action: null,
        product_name: null,
        quantity: null,
        unit: null,
        date: null,
        confidence: 0.5,
        ambiguities: []
      };

      // Extract action (add/remove stock)
      command.action = this.extractAction(tokens);
      
      // Extract quantity and unit
      const quantityUnit = this.extractQuantityAndUnit(tokens);
      command.quantity = quantityUnit.quantity;
      command.unit = quantityUnit.unit;
      
      // Extract product name (most challenging part)
      command.product_name = await this.extractProductName(tokens, userId, supabase);
      
      // Extract date/time context
      command.date = this.extractDateContext(tokens);
      
      // Calculate overall confidence
      command.confidence = this.calculateCommandConfidence(command);
      
      // Identify ambiguities
      command.ambiguities = this.identifyAmbiguities(command, tokens);

      return command;

    } catch (error) {
      console.error("Error parsing mixed language command:", error);
      throw error;
    }
  }

  /**
   * Validate command and resolve ambiguities
   */
  async validateAndResolveAmbiguities(command, userId, supabase) {
    try {
      const resolvedCommand = { ...command };
      const clarifications = [];

      // Check for missing required fields
      if (!resolvedCommand.action) {
        clarifications.push({
          type: 'missing_action',
          question: 'क्या आप stock add करना चाहते हैं या remove करना चाहते हैं? (Do you want to add or remove stock?)',
          options: ['add', 'remove']
        });
      }

      if (!resolvedCommand.product_name) {
        clarifications.push({
          type: 'missing_product',
          question: 'कौन सा product है? (Which product?)',
          suggestions: await this.getRecentProducts(userId, supabase)
        });
      }

      if (!resolvedCommand.quantity) {
        clarifications.push({
          type: 'missing_quantity',
          question: 'कितनी quantity है? (How much quantity?)',
          options: ['1', '5', '10', '50', '100']
        });
      }

      // Resolve product name ambiguities
      if (resolvedCommand.product_name && resolvedCommand.confidence < 0.7) {
        const suggestions = await this.learningService.detectProductAliases(
          userId, resolvedCommand.product_name, supabase
        );
        
        if (suggestions.length > 0) {
          clarifications.push({
            type: 'product_clarification',
            question: `क्या आपका मतलब "${suggestions[0].standardized_name}" से है? (Did you mean "${suggestions[0].standardized_name}"?)`,
            suggestions: suggestions.slice(0, 3).map(s => s.standardized_name)
          });
        }
      }

      resolvedCommand.clarifications_needed = clarifications;
      resolvedCommand.needs_clarification = clarifications.length > 0;

      return resolvedCommand;

    } catch (error) {
      console.error("Error validating command:", error);
      return command;
    }
  }

  /**
   * Generate audio confirmation in user's preferred language
   */
  async generateAudioConfirmation(command, userLanguage = 'hindi', supabase) {
    try {
      let confirmationText = '';
      
      if (userLanguage === 'hindi' || userLanguage === 'mixed') {
        confirmationText = this.generateHindiConfirmation(command);
      } else {
        confirmationText = this.generateEnglishConfirmation(command);
      }

      // Generate speech using OpenAI TTS
      const audioResponse = await openai.audio.speech.create({
        model: "tts-1",
        voice: "nova", // Female voice works well for Hindi-English mix
        input: confirmationText,
        speed: 0.9
      });

      const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

      return {
        success: true,
        confirmation_text: confirmationText,
        audio_buffer: audioBuffer,
        language: userLanguage
      };

    } catch (error) {
      console.error("Error generating audio confirmation:", error);
      throw error;
    }
  }

  /**
   * Learn voice patterns for improved recognition
   */
  async learnVoicePatterns(userId, originalText, parsedCommand, supabase) {
    try {
      // Store voice pattern for future learning
      await supabase
        .from("voice_patterns")
        .insert({
          user_id: userId,
          original_text: originalText,
          parsed_action: parsedCommand.action,
          parsed_product: parsedCommand.product_name,
          parsed_quantity: parsedCommand.quantity,
          parsed_unit: parsedCommand.unit,
          confidence: parsedCommand.confidence,
          language_mix: this.detectLanguageMix(originalText)
        });

      // Update user's pronunciation patterns
      if (parsedCommand.product_name) {
        await this.updatePronunciationPattern(userId, parsedCommand.product_name, originalText, supabase);
      }

    } catch (error) {
      console.error("Error learning voice patterns:", error);
    }
  }

  /**
   * Handle ambiguity clarification dialog
   */
  async handleClarificationResponse(userId, originalCommand, clarificationResponse, supabase) {
    try {
      const updatedCommand = { ...originalCommand };

      for (const response of clarificationResponse) {
        switch (response.type) {
          case 'missing_action':
            updatedCommand.action = response.value;
            break;
          case 'missing_product':
            updatedCommand.product_name = response.value;
            break;
          case 'missing_quantity':
            updatedCommand.quantity = parseFloat(response.value);
            break;
          case 'product_clarification':
            updatedCommand.product_name = response.value;
            updatedCommand.confidence = Math.min(updatedCommand.confidence + 0.2, 1.0);
            break;
        }
      }

      // Learn from clarification
      await this.learnFromClarification(userId, originalCommand, updatedCommand, supabase);

      return updatedCommand;

    } catch (error) {
      console.error("Error handling clarification response:", error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  extractAction(tokens) {
    for (const token of tokens) {
      // Check Hindi patterns
      if (this.hindiEnglishPatterns.actions.add.hindi.includes(token)) {
        return 'add';
      }
      if (this.hindiEnglishPatterns.actions.remove.hindi.includes(token)) {
        return 'remove';
      }
      // Check English patterns
      if (this.hindiEnglishPatterns.actions.add.english.includes(token)) {
        return 'add';
      }
      if (this.hindiEnglishPatterns.actions.remove.english.includes(token)) {
        return 'remove';
      }
    }
    return null;
  }

  extractQuantityAndUnit(tokens) {
    let quantity = null;
    let unit = null;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      
      // Check for numbers
      const num = parseFloat(token);
      if (!isNaN(num)) {
        quantity = num;
        
        // Check next token for unit
        if (i + 1 < tokens.length) {
          const nextToken = tokens[i + 1];
          if (this.hindiEnglishPatterns.units.hindi.includes(nextToken) ||
              this.hindiEnglishPatterns.units.english.includes(nextToken)) {
            unit = nextToken;
          }
        }
      }
    }

    return { quantity, unit };
  }

  async extractProductName(tokens, userId, supabase) {
    // This is complex - need to identify product names from mixed language text
    // Strategy: Remove known action/quantity/unit words, then check remaining words
    
    const actionWords = [
      ...this.hindiEnglishPatterns.actions.add.hindi,
      ...this.hindiEnglishPatterns.actions.add.english,
      ...this.hindiEnglishPatterns.actions.remove.hindi,
      ...this.hindiEnglishPatterns.actions.remove.english
    ];
    
    const quantityWords = [
      ...this.hindiEnglishPatterns.quantity.hindi,
      ...this.hindiEnglishPatterns.quantity.english
    ];
    
    const unitWords = [
      ...this.hindiEnglishPatterns.units.hindi,
      ...this.hindiEnglishPatterns.units.english
    ];
    
    const timeWords = [
      ...this.hindiEnglishPatterns.time.hindi,
      ...this.hindiEnglishPatterns.time.english
    ];

    const stopWords = [...actionWords, ...quantityWords, ...unitWords, ...timeWords];
    
    // Filter out stop words and numbers
    const productTokens = tokens.filter(token => {
      return !stopWords.includes(token) && isNaN(parseFloat(token));
    });

    if (productTokens.length === 0) return null;

    const productName = productTokens.join(' ');
    
    // Try to match with existing products
    const aliases = await this.learningService.detectProductAliases(userId, productName, supabase);
    if (aliases.length > 0) {
      return aliases[0].standardized_name;
    }

    return productName;
  }

  extractDateContext(tokens) {
    const today = new Date();
    
    for (const token of tokens) {
      if (token === 'aaj' || token === 'today') {
        return today.toISOString().split('T')[0];
      }
      if (token === 'kal' || token === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
      }
    }
    
    return today.toISOString().split('T')[0]; // Default to today
  }

  calculateCommandConfidence(command) {
    let confidence = 0;
    let factors = 0;

    if (command.action) { confidence += 0.3; factors++; }
    if (command.product_name) { confidence += 0.4; factors++; }
    if (command.quantity) { confidence += 0.2; factors++; }
    if (command.unit) { confidence += 0.1; factors++; }

    return factors > 0 ? confidence : 0.1;
  }

  identifyAmbiguities(command, tokens) {
    const ambiguities = [];

    if (!command.action) {
      ambiguities.push('action');
    }
    if (!command.product_name) {
      ambiguities.push('product_name');
    }
    if (!command.quantity) {
      ambiguities.push('quantity');
    }

    return ambiguities;
  }

  detectLanguageMix(text) {
    const hindiWords = text.match(/[\u0900-\u097F]+/g) || [];
    const englishWords = text.match(/[a-zA-Z]+/g) || [];
    
    if (hindiWords.length > 0 && englishWords.length > 0) {
      return 'mixed';
    } else if (hindiWords.length > 0) {
      return 'hindi';
    } else {
      return 'english';
    }
  }

  generateHindiConfirmation(command) {
    const action = command.action === 'add' ? 'add किया गया' : 'remove किया गया';
    return `${command.quantity || ''} ${command.unit || ''} ${command.product_name || 'product'} ${action} है। (${command.quantity || ''} ${command.unit || ''} ${command.product_name || 'product'} has been ${command.action === 'add' ? 'added' : 'removed'}.)`;
  }

  generateEnglishConfirmation(command) {
    const action = command.action === 'add' ? 'added' : 'removed';
    return `${command.quantity || ''} ${command.unit || ''} of ${command.product_name || 'product'} has been ${action}.`;
  }

  async getRecentProducts(userId, supabase) {
    const { data: products, error } = await supabase
      .from("inventory_items")
      .select("product_name")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(5);

    return products ? products.map(p => p.product_name) : [];
  }

  async updatePronunciationPattern(userId, productName, originalText, supabase) {
    try {
      await supabase
        .from("pronunciation_patterns")
        .upsert({
          user_id: userId,
          product_name: productName.toLowerCase(),
          pronunciation_variations: [originalText],
          usage_count: 1
        }, {
          onConflict: 'user_id,product_name',
          ignoreDuplicates: false
        });
    } catch (error) {
      console.error("Error updating pronunciation pattern:", error);
    }
  }

  async learnFromClarification(userId, originalCommand, clarifiedCommand, supabase) {
    try {
      await supabase
        .from("clarification_learning")
        .insert({
          user_id: userId,
          original_command: JSON.stringify(originalCommand),
          clarified_command: JSON.stringify(clarifiedCommand),
          improvement_type: 'voice_clarification'
        });
    } catch (error) {
      console.error("Error learning from clarification:", error);
    }
  }
}

module.exports = { AdvancedVoiceService };