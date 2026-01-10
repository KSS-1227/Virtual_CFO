const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const { asyncHandler } = require('../middleware/errorHandler');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Generate file hash from base64 data
 */
function generateFileHash(base64Data) {
  return crypto.createHash('sha256').update(base64Data).digest('hex');
}

/**
 * Generate content hash from extracted data
 */
function generateContentHash(extractedData) {
  const contentString = JSON.stringify({
    vendor: extractedData.vendor?.toLowerCase().trim(),
    amount: Math.round((extractedData.amount || 0) * 100),
    date: extractedData.date,
    items: extractedData.items?.map(item => ({
      name: item.name?.toLowerCase().trim(),
      price: Math.round((item.price || 0) * 100)
    })) || []
  });
  
  return crypto.createHash('md5').update(contentString).digest('hex');
}

/**
 * Calculate content similarity between two extracted data objects
 */
function calculateContentSimilarity(data1, data2) {
  let matches = 0;
  let total = 0;
  
  // Vendor similarity
  if (data1.vendor && data2.vendor) {
    const similarity = stringSimilarity(
      data1.vendor.toLowerCase(), 
      data2.vendor.toLowerCase()
    );
    matches += similarity;
    total += 1;
  }
  
  // Amount similarity (within 5% tolerance)
  if (data1.amount && data2.amount) {
    const amountDiff = Math.abs(data1.amount - data2.amount) / Math.max(Math.abs(data1.amount), Math.abs(data2.amount));
    matches += amountDiff < 0.05 ? 1 : 0;
    total += 1;
  }
  
  // Date similarity
  if (data1.date && data2.date) {
    matches += data1.date === data2.date ? 1 : 0;
    total += 1;
  }
  
  return total > 0 ? matches / total : 0;
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function stringSimilarity(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;
  
  const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
  
  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j - 1][i] + 1,
        matrix[j][i - 1] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }
  
  const maxLen = Math.max(len1, len2);
  return (maxLen - matrix[len2][len1]) / maxLen;
}

/**
 * Check for duplicate documents
 */
const checkDuplicate = asyncHandler(async (req, res) => {
  try {
    const { fileHash, fileName, fileSize, extractedData, userId } = req.body;

    if (!fileHash || !userId) {
      return res.status(400).json({
        success: false,
        error: 'File hash and user ID are required',
        data: null
      });
    }

    const SIMILARITY_THRESHOLD = 0.85;

    // Check for exact file match
    const { data: exactMatch, error: exactError } = await supabase
      .from('document_fingerprints')
      .select('*')
      .eq('user_id', userId)
      .eq('file_hash', fileHash)
      .single();

    if (exactError && exactError.code !== 'PGRST116') {
      console.error('Database error checking exact match:', exactError);
    }

    if (exactMatch) {
      return res.json({
        success: true,
        data: {
          isDuplicate: true,
          matchType: 'exact',
          matchedDocument: exactMatch,
          confidence: 1.0
        }
      });
    }

    // If we have extracted data, check for content similarity
    if (extractedData) {
      const contentHash = generateContentHash(extractedData);

      // Get all documents for this user to check similarity
      const { data: userDocs, error: docsError } = await supabase
        .from('document_fingerprints')
        .select('*')
        .eq('user_id', userId)
        .not('extracted_data', 'is', null);

      if (docsError) {
        console.error('Database error fetching user documents:', docsError);
      } else if (userDocs && userDocs.length > 0) {
        // Check content similarity
        for (const doc of userDocs) {
          if (doc.extracted_data) {
            const similarity = calculateContentSimilarity(extractedData, doc.extracted_data);
            
            if (similarity >= SIMILARITY_THRESHOLD) {
              return res.json({
                success: true,
                data: {
                  isDuplicate: true,
                  matchType: 'content',
                  matchedDocument: doc,
                  confidence: similarity
                }
              });
            }
          }
        }
      }
    }

    // No duplicates found
    res.json({
      success: true,
      data: {
        isDuplicate: false,
        matchType: 'none',
        confidence: 0
      }
    });

  } catch (error) {
    console.error('Duplicate check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check for duplicates',
      data: null
    });
  }
});

/**
 * Register a processed document
 */
const registerDocument = asyncHandler(async (req, res) => {
  try {
    const { 
      fileHash, 
      contentHash, 
      fileName, 
      fileSize, 
      extractedData, 
      userId 
    } = req.body;

    if (!fileHash || !userId) {
      return res.status(400).json({
        success: false,
        error: 'File hash and user ID are required',
        data: null
      });
    }

    const fingerprint = {
      user_id: userId,
      file_hash: fileHash,
      content_hash: contentHash || generateContentHash(extractedData || {}),
      file_name: fileName,
      file_size: fileSize,
      extracted_data: extractedData,
      processed_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('document_fingerprints')
      .insert(fingerprint)
      .select()
      .single();

    if (error) {
      console.error('Database error registering document:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to register document',
        data: null
      });
    }

    res.json({
      success: true,
      data: {
        id: data.id,
        message: 'Document registered successfully'
      }
    });

  } catch (error) {
    console.error('Document registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register document',
      data: null
    });
  }
});

/**
 * Get duplicate statistics for a user
 */
const getDuplicateStats = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
        data: null
      });
    }

    const { data, error } = await supabase
      .from('document_fingerprints')
      .select('id, processed_at')
      .eq('user_id', userId)
      .order('processed_at', { ascending: false });

    if (error) {
      console.error('Database error fetching stats:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics',
        data: null
      });
    }

    const stats = {
      total: data.length,
      lastProcessed: data.length > 0 ? data[0].processed_at : null,
      duplicatesBlocked: 0 // This would be tracked separately in a real implementation
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      data: null
    });
  }
});

/**
 * Clear all processed documents for a user
 */
const clearProcessedDocuments = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
        data: null
      });
    }

    const { error } = await supabase
      .from('document_fingerprints')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Database error clearing documents:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to clear documents',
        data: null
      });
    }

    res.json({
      success: true,
      data: {
        message: 'All processed documents cleared successfully'
      }
    });

  } catch (error) {
    console.error('Clear documents error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear documents',
      data: null
    });
  }
});

module.exports = {
  checkDuplicate,
  registerDocument,
  getDuplicateStats,
  clearProcessedDocuments
};