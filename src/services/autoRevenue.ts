import { earningsAPI } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';

export interface ProcessedTransaction {
  date: string;
  description: string;
  amount: number;
  category: string;
  vendor?: string;
  confidence: number;
  isRevenue: boolean;
}

export interface RevenueUpdate {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  transactionsProcessed: number;
}

class AutoRevenueService {
  /**
   * Process extracted data and update revenue automatically
   */
  async processAndUpdateRevenue(extractedData: any[]): Promise<RevenueUpdate> {
    let totalRevenue = 0;
    let totalExpenses = 0;
    let transactionsProcessed = 0;

    for (const item of extractedData) {
      try {
        const processedTransaction = this.categorizeTransaction(item);
        
        if (processedTransaction.isRevenue) {
          // Add as revenue
          await this.addRevenue(processedTransaction);
          totalRevenue += Math.abs(processedTransaction.amount);
        } else {
          // Add as expense
          await this.addExpense(processedTransaction);
          totalExpenses += Math.abs(processedTransaction.amount);
        }
        
        transactionsProcessed++;
      } catch (error) {
        console.error('Failed to process transaction:', error);
      }
    }

    return {
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      transactionsProcessed
    };
  }

  /**
   * Categorize transaction as revenue or expense based on OpenAI analysis
   */
  private categorizeTransaction(item: any): ProcessedTransaction {
    const amount = item.amount || 0;
    const category = item.category?.toLowerCase() || '';
    const description = item.description || '';

    // Determine if it's revenue or expense
    const isRevenue = this.isRevenueTransaction(amount, category, description);

    return {
      date: item.date || new Date().toISOString().split('T')[0],
      description: item.description || 'Unknown Transaction',
      amount: Math.abs(amount),
      category: item.category || 'Miscellaneous',
      vendor: item.vendor,
      confidence: item.confidence || 0.8,
      isRevenue
    };
  }

  /**
   * Determine if transaction is revenue based on multiple factors
   */
  private isRevenueTransaction(amount: number, category: string, description: string): boolean {
    // Revenue indicators
    const revenueKeywords = ['sale', 'payment received', 'income', 'revenue', 'cash received'];
    const revenueCategories = ['revenue', 'sales', 'income'];
    
    // Expense indicators
    const expenseKeywords = ['purchase', 'buy', 'expense', 'cost', 'payment made'];
    const expenseCategories = ['inventory', 'operations', 'staff', 'transport', 'marketing'];

    // Check category first
    if (revenueCategories.some(cat => category.includes(cat))) {
      return true;
    }
    
    if (expenseCategories.some(cat => category.includes(cat))) {
      return false;
    }

    // Check description keywords
    const descLower = description.toLowerCase();
    if (revenueKeywords.some(keyword => descLower.includes(keyword))) {
      return true;
    }
    
    if (expenseKeywords.some(keyword => descLower.includes(keyword))) {
      return false;
    }

    // Default: positive amounts are revenue, negative are expenses
    return amount > 0;
  }

  /**
   * Add revenue entry to database
   */
  private async addRevenue(transaction: ProcessedTransaction): Promise<void> {
    const earningsData = {
      earning_date: transaction.date,
      amount: transaction.amount,
      inventory_cost: 0, // No cost for pure revenue
    };

    await earningsAPI.addEarnings(earningsData);
  }

  /**
   * Add expense entry to database
   */
  private async addExpense(transaction: ProcessedTransaction): Promise<void> {
    const earningsData = {
      earning_date: transaction.date,
      amount: 0, // No revenue for pure expense
      inventory_cost: transaction.amount,
    };

    await earningsAPI.addEarnings(earningsData);
  }

  /**
   * Get current revenue totals
   */
  async getCurrentTotals(): Promise<{
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
  }> {
    try {
      const summary = await earningsAPI.getSummary();
      
      if (summary.success && summary.data) {
        return {
          totalRevenue: summary.data.total_revenue || 0,
          totalExpenses: summary.data.total_expenses || 0,
          netProfit: summary.data.net_profit || 0
        };
      }
    } catch (error) {
      console.error('Failed to get current totals:', error);
    }

    return { totalRevenue: 0, totalExpenses: 0, netProfit: 0 };
  }

  /**
   * Batch process multiple documents
   */
  async batchProcessDocuments(documentsData: any[][]): Promise<RevenueUpdate> {
    let totalRevenue = 0;
    let totalExpenses = 0;
    let transactionsProcessed = 0;

    for (const documentData of documentsData) {
      const result = await this.processAndUpdateRevenue(documentData);
      totalRevenue += result.totalRevenue;
      totalExpenses += result.totalExpenses;
      transactionsProcessed += result.transactionsProcessed;
    }

    return {
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      transactionsProcessed
    };
  }

  /**
   * Validate and clean extracted data before processing
   */
  validateExtractedData(extractedData: any[]): any[] {
    return extractedData.filter(item => {
      // Must have amount and date
      if (!item.amount || !item.date) {
        console.warn('Skipping invalid transaction:', item);
        return false;
      }

      // Must have reasonable amount (not zero or too large)
      const amount = Math.abs(item.amount);
      if (amount === 0 || amount > 10000000) { // Max 1 crore
        console.warn('Skipping unreasonable amount:', amount);
        return false;
      }

      // Must have valid date
      const date = new Date(item.date);
      if (isNaN(date.getTime())) {
        console.warn('Skipping invalid date:', item.date);
        return false;
      }

      return true;
    });
  }
}

export const autoRevenueService = new AutoRevenueService();