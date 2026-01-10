const { getAuthenticatedClient } = require("../config/supabase");
const natural = require("natural");
const compromise = require("compromise");

/**
 * Zero-Assumption Learning Service
 * Learns user patterns without predefined assumptions
 */
class InventoryLearningService {
  constructor() {
    this.stemmer = natural.PorterStemmer;
    this.distance = natural.JaroWinklerDistance;
    this.tokenizer = new natural.WordTokenizer();
  }

  /**
   * Learn user product patterns from input
   */
  async learnProductPattern(userId, productData, supabase) {
    try {
      const { product_name, category, supplier_name, aliases = [] } = productData;
      
      // Extract linguistic patterns
      const tokens = this.tokenizer.tokenize(product_name.toLowerCase());
      const stems = tokens.map(token => this.stemmer.stem(token));
      
      // Store or update pattern
      const { data: existingPattern, error: findError } = await supabase
        .from("user_product_patterns")
        .select("*")
        .eq("user_id", userId)
        .eq("standardized_name", product_name.toLowerCase())
        .single();

      if (existingPattern) {
        // Update existing pattern
        const updatedVariations = [...new Set([
          ...existingPattern.product_name_variations,
          product_name,
          ...aliases
        ])];

        await supabase
          .from("user_product_patterns")
          .update({
            product_name_variations: updatedVariations,
            frequency: existingPattern.frequency + 1,
            confidence_score: Math.min(existingPattern.confidence_score + 0.1, 1.0),
            last_used: new Date().toISOString()
          })
          .eq("id", existingPattern.id);
      } else {
        // Create new pattern
        await supabase
          .from("user_product_patterns")
          .insert({
            user_id: userId,
            product_name_variations: [product_name, ...aliases],
            standardized_name: product_name.toLowerCase(),
            frequency: 1,
            confidence_score: 0.5,
            linguistic_tokens: tokens,
            stem_patterns: stems
          });
      }

      // Learn category patterns if provided
      if (category) {
        await this.learnCategoryPattern(userId, product_name, category, supabase);
      }

      // Learn supplier patterns if provided
      if (supplier_name) {
        await this.learnSupplierPattern(userId, supplier_name, supabase);
      }

    } catch (error) {
      console.error("Error learning product pattern:", error);
      throw error;
    }
  }

  /**
   * Detect product name aliases using similarity matching
   */
  async detectProductAliases(userId, inputName, supabase) {
    try {
      const { data: patterns, error } = await supabase
        .from("user_product_patterns")
        .select("*")
        .eq("user_id", userId);

      if (error || !patterns) return [];

      const inputTokens = this.tokenizer.tokenize(inputName.toLowerCase());
      const inputStems = inputTokens.map(token => this.stemmer.stem(token));

      const matches = [];

      for (const pattern of patterns) {
        // Check direct name similarity
        for (const variation of pattern.product_name_variations) {
          const similarity = this.distance(inputName.toLowerCase(), variation.toLowerCase());
          if (similarity > 0.8) {
            matches.push({
              standardized_name: pattern.standardized_name,
              similarity,
              match_type: 'direct',
              confidence: pattern.confidence_score
            });
          }
        }

        // Check stem similarity
        if (pattern.stem_patterns) {
          const stemSimilarity = this.calculateStemSimilarity(inputStems, pattern.stem_patterns);
          if (stemSimilarity > 0.7) {
            matches.push({
              standardized_name: pattern.standardized_name,
              similarity: stemSimilarity,
              match_type: 'stem',
              confidence: pattern.confidence_score
            });
          }
        }
      }

      // Sort by similarity and confidence
      return matches
        .sort((a, b) => (b.similarity * b.confidence) - (a.similarity * a.confidence))
        .slice(0, 5);

    } catch (error) {
      console.error("Error detecting aliases:", error);
      return [];
    }
  }

  /**
   * Learn category patterns from user input
   */
  async learnCategoryPattern(userId, productName, category, supabase) {
    try {
      // Check if category exists
      const { data: existingCategory, error } = await supabase
        .from("user_categories")
        .select("*")
        .eq("user_id", userId)
        .eq("category_name", category)
        .single();

      if (existingCategory) {
        // Update usage count
        await supabase
          .from("user_categories")
          .update({
            usage_count: existingCategory.usage_count + 1
          })
          .eq("id", existingCategory.id);
      } else {
        // Create new category
        await supabase
          .from("user_categories")
          .insert({
            user_id: userId,
            category_name: category,
            created_from_product: productName,
            usage_count: 1
          });
      }

      // Store product-category association for learning
      await this.storeProductCategoryAssociation(userId, productName, category, supabase);

    } catch (error) {
      console.error("Error learning category pattern:", error);
    }
  }

  /**
   * Learn supplier usage patterns
   */
  async learnSupplierPattern(userId, supplierName, supabase) {
    try {
      const { data: existing, error } = await supabase
        .from("supplier_patterns")
        .select("*")
        .eq("user_id", userId)
        .eq("supplier_name", supplierName)
        .single();

      if (existing) {
        await supabase
          .from("supplier_patterns")
          .update({
            usage_count: existing.usage_count + 1,
            last_used: new Date().toISOString()
          })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("supplier_patterns")
          .insert({
            user_id: userId,
            supplier_name: supplierName,
            usage_count: 1,
            last_used: new Date().toISOString()
          });
      }
    } catch (error) {
      console.error("Error learning supplier pattern:", error);
    }
  }

  /**
   * Learn from user corrections
   */
  async learnFromCorrection(userId, originalSuggestion, userCorrection, feedbackType, supabase) {
    try {
      // Store feedback
      await supabase
        .from("ai_learning_feedback")
        .insert({
          user_id: userId,
          original_suggestion: originalSuggestion,
          user_correction: userCorrection,
          feedback_type: feedbackType,
          confidence_before: 0.5 // This would come from the original suggestion
        });

      // Update patterns based on correction
      if (feedbackType === 'product_name') {
        await this.updateProductPatternFromCorrection(userId, originalSuggestion, userCorrection, supabase);
      } else if (feedbackType === 'category') {
        await this.updateCategoryPatternFromCorrection(userId, originalSuggestion, userCorrection, supabase);
      }

    } catch (error) {
      console.error("Error learning from correction:", error);
    }
  }

  /**
   * Generate user-specific suggestions
   */
  async generateProductSuggestions(userId, partialInput, supabase) {
    try {
      const { data: patterns, error } = await supabase
        .from("user_product_patterns")
        .select("*")
        .eq("user_id", userId)
        .order("frequency", { ascending: false })
        .order("last_used", { ascending: false });

      if (error || !patterns) return [];

      const suggestions = [];
      const inputLower = partialInput.toLowerCase();

      for (const pattern of patterns) {
        for (const variation of pattern.product_name_variations) {
          if (variation.toLowerCase().includes(inputLower)) {
            suggestions.push({
              text: variation,
              confidence: pattern.confidence_score,
              frequency: pattern.frequency,
              type: 'product_name'
            });
          }
        }
      }

      return suggestions
        .sort((a, b) => (b.confidence * b.frequency) - (a.confidence * a.frequency))
        .slice(0, 10);

    } catch (error) {
      console.error("Error generating suggestions:", error);
      return [];
    }
  }

  /**
   * Helper methods
   */
  calculateStemSimilarity(stems1, stems2) {
    if (!stems1 || !stems2) return 0;
    
    const set1 = new Set(stems1);
    const set2 = new Set(stems2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  async storeProductCategoryAssociation(userId, productName, category, supabase) {
    try {
      await supabase
        .from("product_category_associations")
        .upsert({
          user_id: userId,
          product_name: productName.toLowerCase(),
          category: category,
          confidence: 1.0
        }, {
          onConflict: 'user_id,product_name'
        });
    } catch (error) {
      console.error("Error storing product-category association:", error);
    }
  }

  async updateProductPatternFromCorrection(userId, original, correction, supabase) {
    // Find pattern that matches original suggestion
    const { data: pattern, error } = await supabase
      .from("user_product_patterns")
      .select("*")
      .eq("user_id", userId)
      .contains("product_name_variations", [original])
      .single();

    if (pattern) {
      // Add correction as new variation
      const updatedVariations = [...new Set([
        ...pattern.product_name_variations,
        correction
      ])];

      await supabase
        .from("user_product_patterns")
        .update({
          product_name_variations: updatedVariations,
          confidence_score: Math.max(pattern.confidence_score - 0.1, 0.1)
        })
        .eq("id", pattern.id);
    }
  }

  async updateCategoryPatternFromCorrection(userId, original, correction, supabase) {
    // Similar logic for category corrections
    await this.learnCategoryPattern(userId, "correction_context", correction, supabase);
  }
}

module.exports = { InventoryLearningService };