const { getAuthenticatedClient } = require('../config/supabase');
const { generateCompletion } = require('./openai');
const redisService = require('./redisService');

class FormalLearningService {
  constructor() {
    this.learningTypes = {
      USER_CORRECTION: 'user_correction',
      PATTERN_RECOGNITION: 'pattern_recognition',
      PERFORMANCE_FEEDBACK: 'performance_feedback',
      CONTEXTUAL_LEARNING: 'contextual_learning',
      ADAPTIVE_SUGGESTION: 'adaptive_suggestion'
    };
    
    this.feedbackTypes = {
      ACCURACY: 'accuracy',
      RELEVANCE: 'relevance',
      COMPLETENESS: 'completeness',
      TIMELINESS: 'timeliness',
      USABILITY: 'usability'
    };
    
    this.adaptiveWeights = {
      recency: 0.3,
      frequency: 0.25,
      accuracy: 0.25,
      user_preference: 0.2
    };
  }

  // Record user correction and learn from it
  async recordUserCorrection(userId, originalData, correctedData, context = {}) {
    try {
      const supabase = getAuthenticatedClient();
      
      // Calculate correction patterns
      const correctionPatterns = this.analyzeCorrectionPatterns(originalData, correctedData);
      
      // Store correction record
      const { data: correction } = await supabase
        .from('user_corrections')
        .insert({
          user_id: userId,
          original_data: originalData,
          corrected_data: correctedData,
          correction_patterns: correctionPatterns,
          context: context,
          confidence_improvement: this.calculateConfidenceImprovement(correctionPatterns),
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      // Update learning patterns
      await this.updateLearningPatterns(userId, correctionPatterns, context);
      
      // Update adaptive algorithms
      await this.updateAdaptiveAlgorithms(userId, correction);
      
      // Generate learning insights
      const insights = await this.generateLearningInsights(userId, correctionPatterns);
      
      return {
        correctionId: correction.id,
        patternsLearned: correctionPatterns.length,
        confidenceImprovement: correction.confidence_improvement,
        insights,
        adaptiveUpdates: await this.getAdaptiveUpdates(userId)
      };
    } catch (error) {
      console.error('Error recording user correction:', error);
      throw error;
    }
  }

  analyzeCorrectionPatterns(originalData, correctedData) {
    const patterns = [];
    
    // Field-level corrections
    Object.keys(correctedData).forEach(field => {
      if (originalData[field] !== correctedData[field]) {
        patterns.push({
          type: 'field_correction',
          field: field,
          original_value: originalData[field],
          corrected_value: correctedData[field],
          correction_type: this.classifyCorrection(originalData[field], correctedData[field]),
          confidence: this.calculateCorrectionConfidence(field, originalData[field], correctedData[field])
        });
      }
    });
    
    // Structural corrections
    if (this.hasStructuralChanges(originalData, correctedData)) {
      patterns.push({
        type: 'structural_correction',
        changes: this.identifyStructuralChanges(originalData, correctedData),
        confidence: 0.8
      });
    }
    
    // Semantic corrections
    const semanticChanges = this.identifySemanticChanges(originalData, correctedData);
    if (semanticChanges.length > 0) {
      patterns.push({
        type: 'semantic_correction',
        changes: semanticChanges,
        confidence: 0.7
      });
    }
    
    return patterns;
  }

  classifyCorrection(original, corrected) {
    if (!original && corrected) return 'addition';
    if (original && !corrected) return 'removal';
    if (typeof original === 'string' && typeof corrected === 'string') {
      if (corrected.toLowerCase().includes(original.toLowerCase())) return 'expansion';
      if (original.toLowerCase().includes(corrected.toLowerCase())) return 'simplification';
      return 'replacement';
    }
    if (typeof original === 'number' && typeof corrected === 'number') {
      return corrected > original ? 'increase' : 'decrease';
    }
    return 'modification';
  }

  calculateCorrectionConfidence(field, original, corrected) {
    // Higher confidence for certain types of corrections
    const highConfidenceFields = ['name', 'category', 'supplier'];
    const baseConfidence = highConfidenceFields.includes(field) ? 0.8 : 0.6;
    
    // Adjust based on correction type
    if (!original && corrected) return baseConfidence + 0.1; // Addition
    if (typeof original === 'number' && typeof corrected === 'number') {
      const ratio = Math.abs(corrected - original) / Math.max(original, 1);
      return baseConfidence - (ratio * 0.2); // Large changes = lower confidence
    }
    
    return baseConfidence;
  }

  hasStructuralChanges(original, corrected) {
    const originalKeys = Object.keys(original);
    const correctedKeys = Object.keys(corrected);
    
    return originalKeys.length !== correctedKeys.length ||
           !originalKeys.every(key => correctedKeys.includes(key));
  }

  identifyStructuralChanges(original, corrected) {
    const changes = [];
    const originalKeys = new Set(Object.keys(original));
    const correctedKeys = new Set(Object.keys(corrected));
    
    // Added fields
    correctedKeys.forEach(key => {
      if (!originalKeys.has(key)) {
        changes.push({ type: 'field_added', field: key, value: corrected[key] });
      }
    });
    
    // Removed fields
    originalKeys.forEach(key => {
      if (!correctedKeys.has(key)) {
        changes.push({ type: 'field_removed', field: key, value: original[key] });
      }
    });
    
    return changes;
  }

  identifySemanticChanges(original, corrected) {
    const changes = [];
    
    // Category changes that affect meaning
    if (original.category !== corrected.category) {
      changes.push({
        type: 'category_semantic_change',
        from: original.category,
        to: corrected.category,
        impact: 'high'
      });
    }
    
    // Name changes that affect product identity
    if (original.name && corrected.name && 
        !this.areSimilarNames(original.name, corrected.name)) {
      changes.push({
        type: 'product_identity_change',
        from: original.name,
        to: corrected.name,
        impact: 'high'
      });
    }
    
    return changes;
  }

  areSimilarNames(name1, name2) {
    const similarity = this.calculateStringSimilarity(name1.toLowerCase(), name2.toLowerCase());
    return similarity > 0.7;
  }

  calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  calculateConfidenceImprovement(patterns) {
    if (patterns.length === 0) return 0;
    
    const avgConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
    const complexityFactor = Math.min(patterns.length / 5, 1); // More patterns = more learning
    
    return avgConfidence * complexityFactor * 0.1; // Max 10% improvement
  }

  async updateLearningPatterns(userId, correctionPatterns, context) {
    try {
      const supabase = getAuthenticatedClient();
      
      for (const pattern of correctionPatterns) {
        // Check if similar pattern exists
        const { data: existingPattern } = await supabase
          .from('inventory_learning_patterns')
          .select('*')
          .eq('user_id', userId)
          .eq('pattern_type', pattern.type)
          .contains('pattern_data', { field: pattern.field })
          .single();

        if (existingPattern) {
          // Update existing pattern
          const updatedConfidence = Math.min(1.0, existingPattern.confidence_score + pattern.confidence * 0.1);
          const updatedUsage = existingPattern.usage_count + 1;
          
          await supabase
            .from('inventory_learning_patterns')
            .update({
              confidence_score: updatedConfidence,
              usage_count: updatedUsage,
              last_updated: new Date().toISOString(),
              pattern_data: {
                ...existingPattern.pattern_data,
                recent_corrections: [
                  ...(existingPattern.pattern_data.recent_corrections || []).slice(-4),
                  {
                    original: pattern.original_value,
                    corrected: pattern.corrected_value,
                    timestamp: new Date().toISOString()
                  }
                ]
              }
            })
            .eq('id', existingPattern.id);
        } else {
          // Create new pattern
          await supabase
            .from('inventory_learning_patterns')
            .insert({
              user_id: userId,
              pattern_type: pattern.type,
              pattern_data: {
                field: pattern.field,
                correction_type: pattern.correction_type,
                original_value: pattern.original_value,
                corrected_value: pattern.corrected_value,
                context: context,
                recent_corrections: [{
                  original: pattern.original_value,
                  corrected: pattern.corrected_value,
                  timestamp: new Date().toISOString()
                }]
              },
              confidence_score: pattern.confidence,
              usage_count: 1,
              created_at: new Date().toISOString()
            });
        }
      }
    } catch (error) {
      console.error('Error updating learning patterns:', error);
    }
  }

  async updateAdaptiveAlgorithms(userId, correction) {
    try {
      const supabase = getAuthenticatedClient();
      
      // Get user's adaptive profile
      let { data: profile } = await supabase
        .from('adaptive_user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!profile) {
        // Create new adaptive profile
        profile = {
          user_id: userId,
          learning_velocity: 0.5,
          correction_frequency: 1,
          preferred_fields: {},
          accuracy_trends: {},
          adaptation_weights: this.adaptiveWeights,
          created_at: new Date().toISOString()
        };
      }

      // Update learning velocity based on correction frequency
      const recentCorrections = await this.getRecentCorrections(userId, 7); // Last 7 days
      profile.correction_frequency = recentCorrections.length;
      profile.learning_velocity = Math.min(1.0, profile.learning_velocity + (recentCorrections.length * 0.05));

      // Update preferred fields based on correction patterns
      correction.correction_patterns.forEach(pattern => {
        if (pattern.field) {
          profile.preferred_fields[pattern.field] = (profile.preferred_fields[pattern.field] || 0) + 1;
        }
      });

      // Update accuracy trends
      const accuracyScore = this.calculateAccuracyScore(correction);
      const currentMonth = new Date().toISOString().substring(0, 7);
      profile.accuracy_trends[currentMonth] = accuracyScore;

      // Adapt weights based on user behavior
      profile.adaptation_weights = this.adaptWeights(profile, correction);

      // Save updated profile
      await supabase
        .from('adaptive_user_profiles')
        .upsert({
          ...profile,
          last_updated: new Date().toISOString()
        });

    } catch (error) {
      console.error('Error updating adaptive algorithms:', error);
    }
  }

  async getRecentCorrections(userId, days) {
    try {
      const supabase = getAuthenticatedClient();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const { data } = await supabase
        .from('user_corrections')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', cutoffDate.toISOString());

      return data || [];
    } catch (error) {
      console.error('Error getting recent corrections:', error);
      return [];
    }
  }

  calculateAccuracyScore(correction) {
    const patterns = correction.correction_patterns;
    if (patterns.length === 0) return 1.0;

    // Lower score for more corrections needed
    const baseScore = 1.0 - (patterns.length * 0.1);
    
    // Adjust based on correction types
    const criticalCorrections = patterns.filter(p => 
      ['name', 'category', 'quantity'].includes(p.field)
    ).length;
    
    const criticalPenalty = criticalCorrections * 0.15;
    
    return Math.max(0.1, baseScore - criticalPenalty);
  }

  adaptWeights(profile, correction) {
    const newWeights = { ...profile.adaptation_weights };
    
    // Increase recency weight if user frequently corrects recent suggestions
    const recentCorrectionRatio = correction.correction_patterns.filter(p => 
      p.type === 'field_correction'
    ).length / correction.correction_patterns.length;
    
    if (recentCorrectionRatio > 0.7) {
      newWeights.recency = Math.min(0.5, newWeights.recency + 0.05);
      newWeights.frequency = Math.max(0.1, newWeights.frequency - 0.02);
    }
    
    // Increase accuracy weight if user values precision
    const precisionCorrections = correction.correction_patterns.filter(p => 
      p.correction_type === 'simplification' || p.correction_type === 'replacement'
    ).length;
    
    if (precisionCorrections > 0) {
      newWeights.accuracy = Math.min(0.4, newWeights.accuracy + 0.03);
      newWeights.user_preference = Math.max(0.1, newWeights.user_preference - 0.01);
    }
    
    return newWeights;
  }

  async generateLearningInsights(userId, correctionPatterns) {
    try {
      const insights = [];
      
      // Pattern frequency insights
      const patternTypes = correctionPatterns.reduce((acc, p) => {
        acc[p.type] = (acc[p.type] || 0) + 1;
        return acc;
      }, {});
      
      Object.entries(patternTypes).forEach(([type, count]) => {
        if (count > 1) {
          insights.push({
            type: 'pattern_frequency',
            message: `Frequent ${type} corrections detected (${count} times)`,
            recommendation: this.getPatternRecommendation(type),
            priority: count > 2 ? 'high' : 'medium'
          });
        }
      });
      
      // Field-specific insights
      const fieldCorrections = correctionPatterns
        .filter(p => p.field)
        .reduce((acc, p) => {
          acc[p.field] = (acc[p.field] || 0) + 1;
          return acc;
        }, {});
      
      Object.entries(fieldCorrections).forEach(([field, count]) => {
        if (count > 0) {
          insights.push({
            type: 'field_accuracy',
            message: `${field} field needs attention (${count} corrections)`,
            recommendation: `Consider improving ${field} extraction accuracy`,
            priority: count > 1 ? 'high' : 'low'
          });
        }
      });
      
      // Learning velocity insight
      const profile = await this.getAdaptiveProfile(userId);
      if (profile && profile.learning_velocity > 0.8) {
        insights.push({
          type: 'learning_velocity',
          message: 'High learning velocity detected',
          recommendation: 'System is adapting quickly to your preferences',
          priority: 'info'
        });
      }
      
      return insights;
    } catch (error) {
      console.error('Error generating learning insights:', error);
      return [];
    }
  }

  getPatternRecommendation(patternType) {
    const recommendations = {
      'field_correction': 'Consider providing more context when adding items',
      'structural_correction': 'Review data input format preferences',
      'semantic_correction': 'Improve category and naming consistency'
    };
    
    return recommendations[patternType] || 'Continue providing feedback for better accuracy';
  }

  async getAdaptiveProfile(userId) {
    try {
      const supabase = getAuthenticatedClient();
      const { data } = await supabase
        .from('adaptive_user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      return data;
    } catch (error) {
      console.error('Error getting adaptive profile:', error);
      return null;
    }
  }

  async getAdaptiveUpdates(userId) {
    try {
      const profile = await this.getAdaptiveProfile(userId);
      if (!profile) return {};
      
      return {
        learning_velocity: profile.learning_velocity,
        preferred_fields: Object.entries(profile.preferred_fields)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5),
        accuracy_trend: this.calculateAccuracyTrend(profile.accuracy_trends),
        adaptation_weights: profile.adaptation_weights
      };
    } catch (error) {
      console.error('Error getting adaptive updates:', error);
      return {};
    }
  }

  calculateAccuracyTrend(accuracyTrends) {
    const months = Object.keys(accuracyTrends).sort();
    if (months.length < 2) return 'insufficient_data';
    
    const recent = accuracyTrends[months[months.length - 1]];
    const previous = accuracyTrends[months[months.length - 2]];
    
    const change = recent - previous;
    
    if (change > 0.1) return 'improving';
    if (change < -0.1) return 'declining';
    return 'stable';
  }

  // Record performance feedback
  async recordPerformanceFeedback(userId, feedbackType, rating, context = {}) {
    try {
      const supabase = getAuthenticatedClient();
      
      const feedback = {
        user_id: userId,
        feedback_type: feedbackType,
        rating: rating, // 1-5 scale
        context: context,
        created_at: new Date().toISOString()
      };
      
      const { data } = await supabase
        .from('performance_feedback')
        .insert(feedback)
        .select()
        .single();
      
      // Update adaptive algorithms based on feedback
      await this.processPerformanceFeedback(userId, data);
      
      return {
        feedbackId: data.id,
        processed: true,
        adaptiveUpdates: await this.getAdaptiveUpdates(userId)
      };
    } catch (error) {
      console.error('Error recording performance feedback:', error);
      throw error;
    }
  }

  async processPerformanceFeedback(userId, feedback) {
    try {
      const profile = await this.getAdaptiveProfile(userId);
      if (!profile) return;
      
      // Adjust learning parameters based on feedback
      if (feedback.rating >= 4) {
        // Positive feedback - reinforce current approach
        profile.learning_velocity = Math.min(1.0, profile.learning_velocity + 0.02);
      } else if (feedback.rating <= 2) {
        // Negative feedback - increase adaptation rate
        profile.learning_velocity = Math.min(1.0, profile.learning_velocity + 0.05);
        
        // Adjust weights to prioritize accuracy
        profile.adaptation_weights.accuracy = Math.min(0.4, profile.adaptation_weights.accuracy + 0.05);
      }
      
      // Update profile
      const supabase = getAuthenticatedClient();
      await supabase
        .from('adaptive_user_profiles')
        .update({
          ...profile,
          last_updated: new Date().toISOString()
        })
        .eq('user_id', userId);
        
    } catch (error) {
      console.error('Error processing performance feedback:', error);
    }
  }

  // Get personalized suggestions based on learning
  async getPersonalizedSuggestions(userId, context = {}) {
    try {
      const profile = await this.getAdaptiveProfile(userId);
      const patterns = await this.getUserLearningPatterns(userId);
      
      if (!profile || !patterns.length) {
        return this.getDefaultSuggestions(context);
      }
      
      // Generate suggestions based on learned patterns
      const suggestions = await this.generateAdaptiveSuggestions(userId, profile, patterns, context);
      
      return {
        suggestions,
        personalization_level: profile.learning_velocity,
        confidence: this.calculateSuggestionConfidence(profile, patterns),
        adaptation_info: {
          patterns_used: patterns.length,
          learning_velocity: profile.learning_velocity,
          preferred_fields: Object.keys(profile.preferred_fields).slice(0, 3)
        }
      };
    } catch (error) {
      console.error('Error getting personalized suggestions:', error);
      return this.getDefaultSuggestions(context);
    }
  }

  async getUserLearningPatterns(userId) {
    try {
      const supabase = getAuthenticatedClient();
      const { data } = await supabase
        .from('inventory_learning_patterns')
        .select('*')
        .eq('user_id', userId)
        .gte('confidence_score', 0.6)
        .order('usage_count', { ascending: false })
        .limit(20);
      
      return data || [];
    } catch (error) {
      console.error('Error getting user learning patterns:', error);
      return [];
    }
  }

  async generateAdaptiveSuggestions(userId, profile, patterns, context) {
    const suggestions = [];
    
    // Weight patterns by adaptive weights
    const weightedPatterns = patterns.map(pattern => ({
      ...pattern,
      adaptive_score: this.calculateAdaptiveScore(pattern, profile, context)
    })).sort((a, b) => b.adaptive_score - a.adaptive_score);
    
    // Generate suggestions from top patterns
    for (const pattern of weightedPatterns.slice(0, 10)) {
      const suggestion = this.patternToSuggestion(pattern, context);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }
    
    return suggestions;
  }

  calculateAdaptiveScore(pattern, profile, context) {
    const weights = profile.adaptation_weights;
    
    // Recency score
    const daysSinceUpdate = (Date.now() - new Date(pattern.last_updated || pattern.created_at).getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 1 - (daysSinceUpdate / 30)); // Decay over 30 days
    
    // Frequency score
    const frequencyScore = Math.min(1, pattern.usage_count / 10);
    
    // Accuracy score
    const accuracyScore = pattern.confidence_score;
    
    // User preference score
    const preferenceScore = (profile.preferred_fields[pattern.pattern_data?.field] || 0) / 10;
    
    return (
      recencyScore * weights.recency +
      frequencyScore * weights.frequency +
      accuracyScore * weights.accuracy +
      preferenceScore * weights.user_preference
    );
  }

  patternToSuggestion(pattern, context) {
    if (!pattern.pattern_data) return null;
    
    return {
      text: pattern.pattern_data.corrected_value || pattern.pattern_data.suggested_value,
      confidence: pattern.confidence_score,
      source: 'learned_pattern',
      metadata: {
        pattern_type: pattern.pattern_type,
        usage_count: pattern.usage_count,
        field: pattern.pattern_data.field,
        learning_based: true
      }
    };
  }

  calculateSuggestionConfidence(profile, patterns) {
    if (patterns.length === 0) return 0.3;
    
    const avgPatternConfidence = patterns.reduce((sum, p) => sum + p.confidence_score, 0) / patterns.length;
    const learningVelocityBonus = profile.learning_velocity * 0.2;
    
    return Math.min(0.95, avgPatternConfidence + learningVelocityBonus);
  }

  getDefaultSuggestions(context) {
    return {
      suggestions: [],
      personalization_level: 0,
      confidence: 0.3,
      adaptation_info: {
        patterns_used: 0,
        learning_velocity: 0,
        preferred_fields: []
      }
    };
  }
}

module.exports = new FormalLearningService();