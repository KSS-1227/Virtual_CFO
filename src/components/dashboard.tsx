import { HealthMeter } from "@/components/ui/health-meter";
import { MetricCard } from "@/components/ui/metric-card";
import { ChatInterface } from "@/components/chat-interface";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  DollarSign, 
  PiggyBank, 
  AlertTriangle,
  Upload,
  BarChart3,
  Settings
} from "lucide-react";
import { SupportChatbot } from "@/components/support-chatbot";
import MonthSelector from "./month-selector";
import { useState, useEffect } from "react";
import { earningsAPI, revenueAPI } from "@/lib/api";

export function Dashboard() {
  // Utility to get current month in YYYY-MM
  function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }


  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());
  const [monthlyRevenue, setMonthlyRevenue] = useState<number>(0);
  const [loadingRevenue, setLoadingRevenue] = useState<boolean>(false);
  const [revenueError, setRevenueError] = useState<string | null>(null);

  // State for comparison, breakdown, and insight
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [breakdownData, setBreakdownData] = useState<any>(null);
  const [insightData, setInsightData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState<boolean>(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // Dummy data for other metrics (to be replaced with real API calls)
  const businessData = {
    healthScore: 72,
    monthlyExpenses: 425000,
    profitMargin: 15,
    cashFlow: 45000
  };

  // Helper to get start and end date for a month (YYYY-MM)
  function getMonthDateRange(month: string) {
    const [year, m] = month.split("-").map(Number);
    const start = `${year}-${String(m).padStart(2, "0")}-01`;
    // Get last day of month
    const endDate = new Date(year, m, 0); // m is 1-based
    const end = `${year}-${String(m).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
    return { start, end };
  }

  useEffect(() => {
    let isMounted = true;
    async function fetchMonthlyRevenue() {
      setLoadingRevenue(true);
      setRevenueError(null);
      try {
        const { start, end } = getMonthDateRange(selectedMonth);
        const result = await earningsAPI.getEarningsByDateRange(start, end);
        // Sum up the revenue for the month
        const total = Array.isArray(result.data)
          ? result.data.reduce((sum, item) => sum + (item.amount || 0), 0)
          : 0;
        // If future month, show zero
        const now = new Date();
        const selected = new Date(start);
        if (selected > now) {
          if (isMounted) setMonthlyRevenue(0);
        } else {
          if (isMounted) setMonthlyRevenue(total);
        }
      } catch (err: any) {
        if (isMounted) setRevenueError("Could not load revenue");
        if (isMounted) setMonthlyRevenue(0);
      } finally {
        if (isMounted) setLoadingRevenue(false);
      }
    }
    fetchMonthlyRevenue();
    return () => { isMounted = false; };
  }, [selectedMonth]);

  // Fetch comparison, breakdown, and insight data on selectedMonth change
  useEffect(() => {
    let isMounted = true;
    async function fetchAnalytics() {
      setLoadingAnalytics(true);
      setAnalyticsError(null);
      try {
        // Use the new revenue API endpoints
        const [compareResult, breakdownResult, insightResult] = await Promise.allSettled([
          revenueAPI.getRevenueComparison(selectedMonth),
          revenueAPI.getRevenueBreakdown(selectedMonth),
          revenueAPI.getRevenueInsights(selectedMonth),
        ]);

        if (isMounted) {
          setComparisonData(compareResult.status === 'fulfilled' ? compareResult.value : null);
          setBreakdownData(breakdownResult.status === 'fulfilled' ? breakdownResult.value : null);
          setInsightData(insightResult.status === 'fulfilled' ? insightResult.value : null);
        }
      } catch (err) {
        if (isMounted) setAnalyticsError("Could not load analytics");
        if (isMounted) {
          setComparisonData(null);
          setBreakdownData(null);
          setInsightData(null);
        }
      } finally {
        if (isMounted) setLoadingAnalytics(false);
      }
    }
    fetchAnalytics();
    return () => { isMounted = false; };
  }, [selectedMonth]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b px-4 py-3">
        <div className="container mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-primary">VirtualCFO</h1>
            <p className="text-sm text-muted-foreground">Rajesh Electronics</p>
          </div>
          <Button size="sm" variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </header>

      <div className="container mx-auto p-4 space-y-6">
        {/* Alert Banner */}
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-warning-foreground">Action Required</p>
            <p className="text-sm text-muted-foreground">
              Inventory turnover is low. You could save ₹15,000 by optimizing stock levels.
            </p>
          </div>
        </div>

        {/* Health Score */}
        <div className="bg-card rounded-lg p-6 border">
          <HealthMeter score={businessData.healthScore} size="lg" />
        </div>

        {/* Metrics Grid with Month Selector */}
        <div className="flex items-center justify-between mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800">Key Metrics</h2>
          <MonthSelector value={selectedMonth} onChange={setSelectedMonth} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Monthly Revenue"
            value={monthlyRevenue}
            icon={TrendingUp}
            trend={comparisonData?.data?.growth ? {
              value: Math.round(comparisonData.data.growth.revenue_growth),
              isPositive: comparisonData.data.growth.revenue_growth >= 0
            } : { value: 0, isPositive: true }}
            isCurrency={true}
            subtitle={loadingRevenue ? "Loading..." : revenueError ? revenueError : undefined}
          />
          <MetricCard
            title="Monthly Expenses"
            value={businessData.monthlyExpenses}
            icon={DollarSign}
            trend={{ value: 5, isPositive: false }}
            isCurrency={true}
          />
          <MetricCard
            title="Cash Flow"
            value={businessData.cashFlow}
            icon={PiggyBank}
            trend={{ value: 8, isPositive: true }}
            isCurrency={true}
          />
          <MetricCard
            title="Profit Margin"
            value={businessData.profitMargin}
            icon={BarChart3}
            trend={{ value: 3, isPositive: true }}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Chat Interface */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-lg p-6 border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">AI CFO Assistant</h2>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                  Online
                </div>
              </div>
              <ChatInterface />
            </div>
          </div>

          {/* Quick Actions & Insights */}
          <div className="lg:col-span-1 space-y-6">
            {/* Quick Actions */}
            <div className="bg-card rounded-lg p-6 border">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Button className="w-full justify-start" variant="outline">
                  <Upload className="h-4 w-4 mr-3" />
                  Upload Documents
                </Button>
                
                <Button className="w-full justify-start" variant="outline">
                  <BarChart3 className="h-4 w-4 mr-3" />
                  View Reports
                </Button>
                
                <Button className="w-full justify-start" variant="outline">
                  <TrendingUp className="h-4 w-4 mr-3" />
                  Analyze Trends
                </Button>
              </div>
            </div>

            {/* Key Insights (dynamic, ready for integration) */}
            <div className="bg-card rounded-lg p-6 border">
              <h3 className="text-lg font-semibold mb-4">Key Insights</h3>
              {loadingAnalytics ? (
                <div className="text-muted-foreground text-sm">Loading insights...</div>
              ) : analyticsError ? (
                <div className="text-destructive text-sm">{analyticsError}</div>
              ) : insightData?.data ? (
                <div className="space-y-3">
                  {insightData.data.insights?.map((insight: any, index: number) => (
                    <div key={index} className={`p-3 rounded-lg border-l-4 ${
                      insight.priority === 'high' ? 'border-l-red-500 bg-red-50' :
                      insight.priority === 'medium' ? 'border-l-yellow-500 bg-yellow-50' :
                      'border-l-blue-500 bg-blue-50'
                    }`}>
                      <h4 className="font-medium text-sm">{insight.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{insight.message}</p>
                    </div>
                  ))}
                  {insightData.data.recommendations?.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium text-sm mb-2">Recommendations:</h4>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {insightData.data.recommendations.map((rec: string, index: number) => (
                          <li key={index} className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">No insights for this month.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t">
        <div className="grid grid-cols-4 gap-1 p-2">
          <Button variant="ghost" className="flex-col h-auto py-2 text-xs">
            <BarChart3 className="h-5 w-5 mb-1" />
            Dashboard
          </Button>
          
          <Button variant="ghost" className="flex-col h-auto py-2 text-xs">
            <Upload className="h-5 w-5 mb-1" />
            Upload
          </Button>
          
          <Button variant="ghost" className="flex-col h-auto py-2 text-xs">
            <TrendingUp className="h-5 w-5 mb-1" />
            Reports
          </Button>
          
          <Button variant="ghost" className="flex-col h-auto py-2 text-xs">
            <Settings className="h-5 w-5 mb-1" />
            Settings
          </Button>
        </div>
      </nav>
      
      {/* Support Chatbot */}
      <SupportChatbot />
    </div>
  );
}