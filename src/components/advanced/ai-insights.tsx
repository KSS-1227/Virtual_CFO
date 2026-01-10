import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown,
  AlertTriangle, 
  Target, 
  PiggyBank,
  BarChart3,
  Loader2,
  RefreshCw,
  Brain,
  Package,
  DollarSign
} from "lucide-react";
import { cn } from "@/lib/utils";
import { inventoryAPI, earningsAPI, profileAPI } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AIInsight {
  id: string;
  type: 'opportunity' | 'alert' | 'success' | 'prediction';
  title: string;
  description: string;
  impact: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  category: string;
  actionable: boolean;
  icon: any;
  source: 'ai' | 'static';
  inventory_context?: any;
}

// AI-powered insights generation using monthly_summaries table
const generateAIInsights = async (inventoryData: any[], earningsData: any, profileData: any): Promise<AIInsight[]> => {
  try {
    // Get monthly summaries data
    const { data: monthlySummaries, error } = await supabase
      .from('monthly_summaries')
      .select('*')
      .order('month', { ascending: false })
      .limit(6); // Last 6 months

    if (error) {
      console.error('Error fetching monthly summaries:', error);
    }

    const context = {
      inventory: {
        total_items: inventoryData.length,
        total_value: inventoryData.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0),
        low_stock: inventoryData.filter(item => item.quantity <= (item.reorder_level || 5)),
        high_value: inventoryData.filter(item => (item.quantity * item.unit_price) > 10000),
        categories: [...new Set(inventoryData.map(item => item.category))],
        avg_unit_price: inventoryData.length > 0 ? inventoryData.reduce((sum, item) => sum + item.unit_price, 0) / inventoryData.length : 0,
        zero_stock: inventoryData.filter(item => item.quantity === 0),
        overstocked: inventoryData.filter(item => item.quantity > (item.max_stock || 100))
      },
      financial: {
        monthly_revenue: earningsData?.summary?.monthly_totals?.[0]?.total_income || 0,
        monthly_expenses: profileData?.monthly_expenses || 0,
        profit_margin: profileData?.profit_margin || 0
      },
      monthly_summaries: monthlySummaries || []
    };

    const insights: AIInsight[] = [];

    // 1. Cash Flow Analysis using monthly_summaries
    if (context.monthly_summaries.length >= 2) {
      const currentMonth = context.monthly_summaries[0];
      const previousMonth = context.monthly_summaries[1];
      
      const cashFlowChange = ((currentMonth.total_income - currentMonth.total_expenses) - 
                             (previousMonth.total_income - previousMonth.total_expenses));
      const cashFlowChangePercent = previousMonth.total_income > 0 ? 
        (cashFlowChange / (previousMonth.total_income - previousMonth.total_expenses)) * 100 : 0;

      if (cashFlowChange < 0) {
        insights.push({
          id: `ai-cashflow-${Date.now()}`,
          type: 'alert',
          title: 'Cash Flow Decline',
          description: `Cash flow decreased by ₹${Math.abs(cashFlowChange).toLocaleString()} (${Math.abs(cashFlowChangePercent).toFixed(1)}%) from last month.`,
          impact: `Address ₹${Math.abs(cashFlowChange).toLocaleString()} cash flow gap`,
          priority: 'high',
          confidence: 92,
          category: 'Cash Flow',
          actionable: true,
          icon: AlertTriangle,
          source: 'ai'
        });
      }
    }

    // 2. Performance Trend Analysis
    if (context.monthly_summaries.length >= 3) {
      const last3Months = context.monthly_summaries.slice(0, 3);
      const revenueGrowth = last3Months.map((month, index) => {
        if (index === last3Months.length - 1) return 0;
        const nextMonth = last3Months[index + 1];
        return nextMonth.total_income > 0 ? 
          ((month.total_income - nextMonth.total_income) / nextMonth.total_income) * 100 : 0;
      });
      
      const avgGrowth = revenueGrowth.reduce((sum, growth) => sum + growth, 0) / (revenueGrowth.length - 1);
      
      if (avgGrowth < -5) {
        insights.push({
          id: `ai-performance-decline-${Date.now()}`,
          type: 'alert',
          title: 'Performance Decline Trend',
          description: `Revenue declining at ${Math.abs(avgGrowth).toFixed(1)}% monthly rate over last 3 months.`,
          impact: `Potential ₹${Math.round(last3Months[0].total_income * Math.abs(avgGrowth) * 0.01).toLocaleString()} monthly loss`,
          priority: 'high',
          confidence: 88,
          category: 'Performance',
          actionable: true,
          icon: TrendingDown,
          source: 'ai'
        });
      }
    }

    // 3. Risk Management - Revenue Volatility
    if (context.monthly_summaries.length >= 4) {
      const revenues = context.monthly_summaries.slice(0, 4).map(m => m.total_income);
      const avgRevenue = revenues.reduce((sum, rev) => sum + rev, 0) / revenues.length;
      const variance = revenues.reduce((sum, rev) => sum + Math.pow(rev - avgRevenue, 2), 0) / revenues.length;
      const volatility = Math.sqrt(variance) / avgRevenue * 100;
      
      if (volatility > 25) {
        insights.push({
          id: `ai-volatility-${Date.now()}`,
          type: 'alert',
          title: 'High Revenue Volatility',
          description: `Revenue volatility is ${volatility.toFixed(1)}%. Consider diversifying income streams.`,
          impact: `Reduce risk by ₹${Math.round(avgRevenue * 0.2).toLocaleString()}/month`,
          priority: 'medium',
          confidence: 75,
          category: 'Risk Management',
          actionable: true,
          icon: AlertTriangle,
          source: 'ai'
        });
      }
    }

    // 4. Low stock alerts
    if (context.inventory.low_stock.length > 0) {
      insights.push({
        id: `ai-stock-${Date.now()}`,
        type: 'alert',
        title: 'Low Stock Alert',
        description: `${context.inventory.low_stock.length} items are running low. Reorder to avoid stockouts.`,
        impact: `₹${(context.inventory.low_stock.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)).toLocaleString()} at risk`,
        priority: 'high',
        confidence: 95,
        category: 'Inventory',
        actionable: true,
        icon: Package,
        source: 'ai',
        inventory_context: context.inventory.low_stock
      });
    }

    return insights;
  } catch (error) {
    console.error('Error generating AI insights:', error);
    return [];
  }
};

export function AIInsightsPanel() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const categories = ['all', 'Inventory', 'Cash Flow', 'Performance', 'Profitability', 'Risk Management', 'Seasonal'];
  
  const filteredInsights = selectedCategory === 'all' 
    ? insights 
    : insights.filter(insight => insight.category === selectedCategory);

  // Load real-time data and generate AI insights
  const loadAIInsights = async () => {
    setLoading(true);
    try {
      const [inventoryResponse, earningsResponse, profileResponse] = await Promise.all([
        inventoryAPI.getInventory(),
        earningsAPI.getSummary(),
        profileAPI.getProfile()
      ]);

      const inventory = inventoryResponse.data || [];

      // Generate AI-powered insights
      const aiInsights = await generateAIInsights(
        inventory,
        earningsResponse,
        profileResponse.data
      );

      setInsights(aiInsights);

      toast({
        title: "AI Insights Updated",
        description: `Generated ${aiInsights.length} real-time insights from your data.`,
      });
    } catch (error) {
      console.error('Error loading AI insights:', error);
      toast({
        title: "Error Loading Insights",
        description: "Check your connection and try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Load insights on component mount
  useEffect(() => {
    loadAIInsights();
  }, []);

  const getInsightIcon = (insight: AIInsight) => {
    const IconComponent = insight.icon;
    return (
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
        insight.type === 'success' && "bg-success/10 text-success",
        insight.type === 'alert' && "bg-warning/10 text-warning",
        insight.type === 'opportunity' && "bg-primary/10 text-primary",
        insight.type === 'prediction' && "bg-accent/10 text-accent-foreground"
      )}>
        <IconComponent className="h-5 w-5" />
      </div>
    );
  };

  return (
    <Card className="modern-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4" />
            AI Inventory Insights
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {insights.length} AI Insights
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadAIInsights}
              disabled={loading}
              className="h-6 w-6 p-0"
            >
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
        
        {/* Category Filter */}
        <div className="flex gap-2 mt-3 overflow-x-auto">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              className="text-xs whitespace-nowrap"
              onClick={() => setSelectedCategory(category)}
            >
              {category === 'all' ? 'All' : category}
            </Button>
          ))}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Analyzing your inventory data...</p>
          </div>
        ) : filteredInsights.length === 0 ? (
          <div className="text-center py-8">
            <Brain className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No insights available. Add inventory and earnings data to get AI recommendations.</p>
            <p className="text-xs text-muted-foreground mt-1">Monthly summaries will enhance cash flow and performance insights.</p>
          </div>
        ) : (
          filteredInsights.map((insight) => (
            <div key={insight.id} className="flex gap-3 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              {getInsightIcon(insight)}
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-sm font-medium flex items-center gap-1">
                      {insight.title}
                      <Badge variant="secondary" className="text-xs px-1 py-0">
                        AI
                      </Badge>
                    </h4>
                    <p className="text-xs text-muted-foreground">{insight.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-xs",
                        insight.priority === "high" && "border-destructive/20 text-destructive",
                        insight.priority === "medium" && "border-warning/20 text-warning",
                        insight.priority === "low" && "border-success/20 text-success"
                      )}
                    >
                      {insight.priority}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{insight.confidence}%</span>
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground mb-2">
                  {insight.description}
                </p>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-primary">
                    {insight.impact}
                  </span>
                  {insight.actionable && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-xs h-6"
                      onClick={() => {
                        if (insight.inventory_context) {
                          toast({
                            title: "Inventory Action",
                            description: `Found ${insight.inventory_context.length} items requiring attention.`,
                          });
                        }
                      }}
                    >
                      AI Action
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}