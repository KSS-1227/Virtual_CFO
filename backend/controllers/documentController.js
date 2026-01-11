const { getAuthenticatedClient } = require("../config/supabase");
const { asyncHandler } = require("../middleware/errorHandler");
const documentProcessingService = require("../services/documentProcessingService");
const multer = require('multer');
const fs = require('fs').promises;

// Configure multer for document uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for documents
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp',
      'application/pdf',
      'text/plain', 'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Please upload images, PDFs, or spreadsheets.'));
    }
  }
});

// Get all documents for the authenticated user
const getDocuments = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);

  const { page = 1, limit = 10, doc_type, status } = req.query;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("documents")
    .select("*")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Apply filters
  if (doc_type) {
    query = query.eq("doc_type", doc_type);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data: documents, error, count } = await query;

  if (error) {
    console.error("Error fetching documents:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch documents",
      data: null,
    });
  }

  res.json({
    success: true,
    data: {
      documents: documents || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit),
      },
    },
    error: null,
  });
});

// Get a specific document by ID
const getDocument = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);
  const { id } = req.params;

  const { data: document, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("user_id", req.user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return res.status(404).json({
        success: false,
        error: "Document not found",
        data: null,
      });
    }

    console.error("Error fetching document:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch document",
      data: null,
    });
  }

  res.json({
    success: true,
    data: document,
    error: null,
  });
});

// Create a new document record
const createDocument = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);

  const {
    file_name,
    file_url,
    doc_type = "general",
    extracted_text,
    file_size,
    mime_type,
  } = req.body;

  // Validate required fields
  if (!file_name || !file_url) {
    return res.status(400).json({
      success: false,
      error: "File name and file URL are required",
      data: null,
    });
  }

  const documentData = {
    user_id: req.user.id,
    file_name,
    file_url,
    doc_type,
    extracted_text,
    file_size: file_size ? parseInt(file_size) : null,
    mime_type,
    status: "uploaded",
  };

  const { data: document, error } = await supabase
    .from("documents")
    .insert(documentData)
    .select()
    .single();

  if (error) {
    console.error("Error creating document:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create document record",
      data: null,
    });
  }

  res.status(201).json({
    success: true,
    data: document,
    error: null,
  });
});

// Update a document
const updateDocument = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);
  const { id } = req.params;

  const { file_name, doc_type, extracted_text, status } = req.body;

  const updateData = {};

  if (file_name !== undefined) updateData.file_name = file_name;
  if (doc_type !== undefined) updateData.doc_type = doc_type;
  if (extracted_text !== undefined) updateData.extracted_text = extracted_text;
  if (status !== undefined) {
    // Validate status
    const validStatuses = ["uploaded", "processing", "processed", "failed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status value",
        data: null,
      });
    }
    updateData.status = status;
  }

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({
      success: false,
      error: "No valid fields to update",
      data: null,
    });
  }

  const { data: document, error } = await supabase
    .from("documents")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", req.user.id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return res.status(404).json({
        success: false,
        error: "Document not found",
        data: null,
      });
    }

    console.error("Error updating document:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to update document",
      data: null,
    });
  }

  res.json({
    success: true,
    data: document,
    error: null,
  });
});

// Delete a document
const deleteDocument = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);
  const { id } = req.params;

  const { data, error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("user_id", req.user.id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return res.status(404).json({
        success: false,
        error: "Document not found",
        data: null,
      });
    }

    console.error("Error deleting document:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to delete document",
      data: null,
    });
  }

  res.json({
    success: true,
    data: { message: "Document deleted successfully" },
    error: null,
  });
});

// Get document statistics
const getDocumentStats = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);

  // Get counts by status
  const { data: statusCounts, error: statusError } = await supabase
    .from("documents")
    .select("status")
    .eq("user_id", req.user.id);

  if (statusError) {
    console.error("Error fetching document stats:", statusError);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch document statistics",
      data: null,
    });
  }

  // Count by status
  const stats = {
    total: statusCounts.length,
    uploaded: statusCounts.filter((doc) => doc.status === "uploaded").length,
    processing: statusCounts.filter((doc) => doc.status === "processing")
      .length,
    processed: statusCounts.filter((doc) => doc.status === "processed").length,
    failed: statusCounts.filter((doc) => doc.status === "failed").length,
  };

  // Get counts by document type
  const { data: typeCounts, error: typeError } = await supabase
    .from("documents")
    .select("doc_type")
    .eq("user_id", req.user.id);

  if (!typeError) {
    const typeStats = {};
    typeCounts.forEach((doc) => {
      typeStats[doc.doc_type] = (typeStats[doc.doc_type] || 0) + 1;
    });
    stats.by_type = typeStats;
  }

  res.json({
    success: true,
    data: stats,
    error: null,
  });
});

// Enhanced document processing endpoint
const processFinancialDocument = asyncHandler(async (req, res) => {
  try {
    const file = req.file;
    const { document_type, expected_data_type } = req.body;
    
    if (!file) {
      return res.status(400).json({
        success: false,
        error: "Document file is required"
      });
    }

    const supabase = getAuthenticatedClient(req.accessToken);
    
    // Get user profile for context
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", req.user.id)
      .single();

    // Prepare document data
    const documentData = {
      fileType: file.mimetype,
      content: file.buffer.toString('base64'),
      fileName: file.originalname,
      fileSize: file.size
    };

    // Process document with enhanced AI
    const extractedData = await documentProcessingService.processFinancialDocument(
      documentData, 
      profile || {}
    );

    // Auto-save to database if confidence is high
    let savedEntries = [];
    if (extractedData.confidence > 0.7 && !extractedData.review_required) {
      
      // Save main document record
      const documentRecord = {
        user_id: req.user.id,
        file_name: file.originalname,
        file_url: `processed_${Date.now()}_${file.originalname}`,
        doc_type: extractedData.document_type || document_type || 'financial_document',
        extracted_text: JSON.stringify(extractedData),
        file_size: file.size,
        mime_type: file.mimetype,
        status: 'processed'
      };

      const { data: savedDoc } = await supabase
        .from('documents')
        .insert(documentRecord)
        .select()
        .single();

      // Save individual transactions to earnings table
      if (extractedData.line_items && extractedData.line_items.length > 0) {
        for (const item of extractedData.line_items) {
          const earningsData = {
            user_id: req.user.id,
            earning_date: extractedData.date_range?.start_date || new Date().toISOString().split('T')[0],
            amount: item.type === 'revenue' ? item.amount : 0,
            inventory_cost: item.type === 'expense' ? item.amount : 0,
            processed_text: `${item.description} - Auto-extracted from ${file.originalname}`,
            doc_type: 'document_extraction',
            file_url: savedDoc.file_url,
            vendor_name: extractedData.vendor_customer_info?.name || 'Unknown',
            transaction_category: item.category || 'General'
          };

          const { data: savedEntry } = await supabase
            .from('earnings')
            .insert(earningsData)
            .select()
            .single();

          savedEntries.push(savedEntry);
        }
      }

      // Save summary totals if no line items
      if (extractedData.line_items?.length === 0 && (extractedData.total_revenue > 0 || extractedData.total_expenses > 0)) {
        const summaryData = {
          user_id: req.user.id,
          earning_date: extractedData.date_range?.start_date || new Date().toISOString().split('T')[0],
          amount: extractedData.total_revenue || 0,
          inventory_cost: extractedData.total_expenses || 0,
          processed_text: `Document summary - ${file.originalname}`,
          doc_type: 'document_summary',
          file_url: savedDoc.file_url,
          vendor_name: extractedData.vendor_customer_info?.name || 'Document Extract'
        };

        const { data: summaryEntry } = await supabase
          .from('earnings')
          .insert(summaryData)
          .select()
          .single();

        savedEntries.push(summaryEntry);
      }
    }

    res.json({
      success: true,
      data: {
        extracted_data: extractedData,
        auto_saved: savedEntries.length > 0,
        saved_entries: savedEntries,
        processing_summary: {
          total_revenue: extractedData.total_revenue || 0,
          total_expenses: extractedData.total_expenses || 0,
          net_amount: extractedData.net_amount || 0,
          line_items_count: extractedData.line_items?.length || 0,
          confidence_score: extractedData.confidence || 0,
          review_required: extractedData.review_required || false
        }
      }
    });

  } catch (error) {
    console.error("Document processing error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process financial document",
      details: error.message
    });
  }
});

// Batch document processing endpoint
const batchProcessDocuments = asyncHandler(async (req, res) => {
  try {
    const files = req.files;
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: "At least one document file is required"
      });
    }

    const supabase = getAuthenticatedClient(req.accessToken);
    
    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", req.user.id)
      .single();

    // Prepare documents for batch processing
    const documents = files.map(file => ({
      fileType: file.mimetype,
      content: file.buffer.toString('base64'),
      fileName: file.originalname,
      fileSize: file.size
    }));

    // Process all documents
    const batchResult = await documentProcessingService.batchProcessDocuments(
      documents,
      profile || {}
    );

    res.json({
      success: true,
      data: {
        batch_summary: batchResult.batch_summary,
        individual_results: batchResult.individual_results,
        processing_time: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Batch processing error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process documents in batch",
      details: error.message
    });
  }
});

module.exports = {
  getDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  getDocumentStats,
  processFinancialDocument: [upload.single('document'), processFinancialDocument],
  batchProcessDocuments: [upload.array('documents', 10), batchProcessDocuments]
};
