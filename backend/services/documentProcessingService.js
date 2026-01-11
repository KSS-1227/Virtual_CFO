const OpenAI = require('openai');
const { getAuthenticatedClient } = require('../config/supabase');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Enhanced document processing with comprehensive financial extraction
class DocumentProcessingService {
  
  // Process any document type (PDF, images, scanned docs) for financial data
  async processFinancialDocument(documentData, userProfile = {}) {
    try {
      const { fileType, content, fileName } = documentData;
      
      let extractedData;
      
      if (fileType.startsWith('image/')) {
        extractedData = await this.processImageDocument(content, userProfile);
      } else if (fileType === 'application/pdf') {
        extractedData = await this.processPDFDocument(content, userProfile);
      } else {
        extractedData = await this.processTextDocument(content, userProfile);
      }
      
      // Enhanced financial analysis
      const financialSummary = await this.generateFinancialSummary(extractedData, userProfile);
      
      return {
        ...extractedData,
        financial_summary: financialSummary,
        processing_metadata: {
          file_name: fileName,
          file_type: fileType,
          processed_at: new Date().toISOString(),
          confidence_score: extractedData.confidence || 0.5
        }
      };
      
    } catch (error) {
      console.error('Document processing error:', error);
      throw new Error('Failed to process financial document');
    }
  }

  // Process image documents (receipts, invoices, bank statements)
  async processImageDocument(imageBase64, userProfile) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `You are an expert financial document analyzer for Indian businesses. Extract ALL financial data from documents including:
        - Individual line items with amounts
        - Total expenses and revenue
        - Tax information (GST, VAT)
        - Payment methods
        - Vendor/customer details
        - Date ranges for recurring transactions
        
        Classify each transaction and provide comprehensive financial breakdown.`
      }, {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this ${userProfile.business_type || 'business'} document. Extract ALL financial data including total expenses, revenue, and individual transactions.`
          },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
          }
        ]
      }],
      functions: [{
        name: "extract_comprehensive_financial_data",
        description: "Extract complete financial information from document",
        parameters: {
          type: "object",
          properties: {
            document_type: {
              type: "string",
              enum: ["receipt", "invoice", "bank_statement", "expense_report", "sales_report", "tax_document", "other"]
            },
            total_revenue: { type: "number", description: "Total revenue/income amount" },
            total_expenses: { type: "number", description: "Total expense amount" },
            net_amount: { type: "number", description: "Net profit/loss" },
            currency: { type: "string", default: "INR" },
            date_range: {
              type: "object",
              properties: {
                start_date: { type: "string" },
                end_date: { type: "string" }
              }
            },
            line_items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  amount: { type: "number" },
                  type: { type: "string", enum: ["expense", "revenue", "tax", "fee"] },
                  category: { type: "string" },
                  quantity: { type: "number" },
                  unit_price: { type: "number" }
                }
              }
            },
            vendor_customer_info: {
              type: "object",
              properties: {
                name: { type: "string" },
                contact: { type: "string" },
                gst_number: { type: "string" },
                address: { type: "string" }
              }
            },
            tax_details: {
              type: "object",
              properties: {
                gst_amount: { type: "number" },
                gst_rate: { type: "number" },
                other_taxes: { type: "array", items: { type: "object" } }
              }
            },
            payment_info: {
              type: "object",
              properties: {
                method: { type: "string" },
                reference_number: { type: "string" },
                bank_details: { type: "string" }
              }
            },
            confidence: { type: "number", description: "Extraction confidence 0-1" },
            review_required: { type: "boolean" },
            notes: { type: "string" }
          },
          required: ["document_type", "total_revenue", "total_expenses", "confidence"]
        }
      }],
      function_call: { name: "extract_comprehensive_financial_data" },
      max_tokens: 2000,
      temperature: 0.1
    });

    const functionCall = response?.choices?.[0]?.function_call;
    if (functionCall && functionCall.name === "extract_comprehensive_financial_data") {
      return JSON.parse(functionCall.arguments);
    }
    
    throw new Error("Failed to extract financial data from image");
  }

  // Generate comprehensive financial summary
  async generateFinancialSummary(extractedData, userProfile) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "system",
        content: `Generate a comprehensive financial summary and insights from extracted document data. 
        Provide actionable business intelligence and recommendations.`
      }, {
        role: "user",
        content: `Business: ${userProfile.business_type || 'General'}
        
        Extracted Data: ${JSON.stringify(extractedData, null, 2)}
        
        Provide:
        1. Financial impact analysis
        2. Cash flow implications
        3. Tax considerations
        4. Business recommendations
        5. Risk assessment`
      }],
      functions: [{
        name: "generate_financial_insights",
        parameters: {
          type: "object",
          properties: {
            financial_impact: {
              type: "object",
              properties: {
                revenue_impact: { type: "number" },
                expense_impact: { type: "number" },
                profit_impact: { type: "number" },
                cash_flow_impact: { type: "number" }
              }
            },
            business_insights: {
              type: "array",
              items: { type: "string" }
            },
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  priority: { type: "string" },
                  action: { type: "string" },
                  expected_benefit: { type: "string" }
                }
              }
            },
            risk_factors: {
              type: "array",
              items: { type: "string" }
            },
            tax_implications: { type: "string" }
          }
        }
      }],
      function_call: { name: "generate_financial_insights" },
      temperature: 0.3
    });

    const functionCall = response?.choices?.[0]?.function_call;
    if (functionCall) {
      return JSON.parse(functionCall.arguments);
    }
    
    return {
      financial_impact: {
        revenue_impact: extractedData.total_revenue || 0,
        expense_impact: extractedData.total_expenses || 0,
        profit_impact: (extractedData.total_revenue || 0) - (extractedData.total_expenses || 0)
      }
    };
  }

  // Batch process multiple documents
  async batchProcessDocuments(documents, userProfile) {
    const results = [];
    let totalRevenue = 0;
    let totalExpenses = 0;
    
    for (const doc of documents) {
      try {
        const result = await this.processFinancialDocument(doc, userProfile);
        results.push(result);
        
        totalRevenue += result.total_revenue || 0;
        totalExpenses += result.total_expenses || 0;
      } catch (error) {
        results.push({
          error: error.message,
          file_name: doc.fileName
        });
      }
    }
    
    return {
      individual_results: results,
      batch_summary: {
        total_documents: documents.length,
        successful_extractions: results.filter(r => !r.error).length,
        total_revenue_extracted: totalRevenue,
        total_expenses_extracted: totalExpenses,
        net_amount: totalRevenue - totalExpenses
      }
    };
  }
}

module.exports = new DocumentProcessingService();