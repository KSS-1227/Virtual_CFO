// Enhanced error handling for inventory services
const handleInventoryServiceError = (error, serviceName) => {
  console.error(`${serviceName} Error:`, error);
  
  // Redis connection errors
  if (error.message?.includes('Redis') || error.code === 'ECONNREFUSED') {
    return {
      success: false,
      error: 'Cache service temporarily unavailable',
      fallback: true
    };
  }
  
  // Audio service errors
  if (error.message?.includes('audio') || error.message?.includes('TTS')) {
    return {
      success: false,
      error: 'Audio confirmation unavailable',
      fallback: true
    };
  }
  
  // AI service errors
  if (error.message?.includes('OpenAI') || error.status === 429) {
    return {
      success: false,
      error: 'AI service temporarily unavailable',
      fallback: true
    };
  }
  
  // Database errors
  if (error.message?.includes('Supabase') || error.code?.startsWith('23')) {
    return {
      success: false,
      error: 'Database operation failed',
      fallback: false
    };
  }
  
  // Generic error
  return {
    success: false,
    error: 'Service temporarily unavailable',
    fallback: true
  };
};

// Graceful degradation wrapper
const withGracefulDegradation = (serviceFunction, fallbackFunction = null) => {
  return async (...args) => {
    try {
      return await serviceFunction(...args);
    } catch (error) {
      const errorResponse = handleInventoryServiceError(error, serviceFunction.name);
      
      if (errorResponse.fallback && fallbackFunction) {
        console.warn(`Falling back for ${serviceFunction.name}`);
        return await fallbackFunction(...args);
      }
      
      throw error;
    }
  };
};

module.exports = {
  handleInventoryServiceError,
  withGracefulDegradation
};