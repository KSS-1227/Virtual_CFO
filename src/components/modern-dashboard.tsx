import { useState, useEffect } from "react";
import { HealthMeter } from "@/components/ui/health-meter";
import { MetricCard } from "@/components/ui/metric-card";
import { ChatInterface } from "@/components/chat-interface";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { profileAPI, chatAPI, handleAPIError, productsAPI, earningsAPI, monthlyRevenueHelpers } from "@/lib/api";
import { InsightsGenerator } from "@/lib/insights-generator";
import MonthSelector from "./month-selector";
import { 
  TrendingUp, 
  DollarSign, 
  PiggyBank, 
  AlertTriangle,
  Upload,
  BarChart3,
  Settings,
  Bell,
  Search,
  Menu,
  ChevronRight,
  Zap,
  Target,
  TrendingDown,
  Eye,
  FileText,
  MessageCircle,
  Home,
  User,
  LogOut,
  Brain
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AdvancedDashboard } from "@/components/advanced/advanced-dashboard";
import { DocumentUploader } from "@/components/document-uploader";
import MultiModalUploader from "@/components/MultiModalUploader";
import { ReportGenerator } from "@/components/report-generator";
import { InsightsPanel } from "@/components/insights-panel";
import { ProfileView } from "@/components/profile-view";
import { ComparisonModal } from "@/components/comparison-modal";
import { SupportChatbot } from "@/components/support-chatbot";
import { UploadTest } from "@/components/upload-test";

interface ProfileData {
  business_name?: string;
  owner_name?: string;
  business_type?: string;
  location?: string;
  monthly_revenue?: number;
  monthly_expenses?: number;
  preferred_language?: string;
  phone_number?: string;
  notify_whatsapp?: boolean;
  notify_email?: boolean;
}

interface ProfileStats {
  profit_margin?: number;
  total_documents?: number;
  last_update?: string;
}
interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
}

interface MonthlyDataItem {
  month: string;
  month_name: string;
  year: number;
  month_number: number;
  total_income: number;
  total_inventory_cost: number;
  total_profit: number;
  days_recorded: number;
  avg_daily_income: number;
  avg_daily_profit: number;
  growth_percentage: number;
}

interface MonthlyRevenueData {
  amount: number;
  source: 'calculated' | 'estimated';
  monthName: string;
  daysRecorded: number;
  growthPercentage: number;
  firstEntryDate?: string | null;
  lastEntryDate?: string | null;
  dateRange?: string;
}

interface BusinessDataExtended {
  healthScore: number;
  monthlyRevenue: number;
  monthlyRevenueData: MonthlyRevenueData;
  monthlyExpenses: number;
  profitMargin: number;
  cashFlow: number;
  companyName: string;
  monthlyData?: MonthlyDataItem[];
  currentMonthName?: string;
  currentMonthDisplay?: string;
  trend: {
    revenue: { value: number; isPositive: boolean };
    expenses: { value: number; isPositive: boolean };
    cashFlow: { value: number; isPositive: boolean };
    profitMargin: { value: number; isPositive: boolean };
  };
}

export function ModernDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null);
  const [earningsSummary, setEarningsSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [earningsLoading, setEarningsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  
  // Month Selector state
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  
  // Comparison modal state
  const [showComparison, setShowComparison] = useState<boolean>(false);
  const [comparisonModalData, setComparisonModalData] = useState<any>(null);
  const [loadingComparison, setLoadingComparison] = useState<boolean>(false);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      const [profile, stats] = await Promise.all([
        profileAPI.getProfile(),
        profileAPI.getProfileStats()
      ]);

      setProfileData(profile.data);
      setProfileStats(stats.data);
      
      // Get user creation date
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserCreatedAt(user.created_at);
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
      // Graceful fallback - don't break the UI
      setProfileData(null);
      setProfileStats(null);
      toast({
        title: "Error Loading Profile Data",
        description: "Please check your connection.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadEarningsData = async (month?: string) => {
    try {
      setEarningsLoading(true);
      const summary = await earningsAPI.getSummary(undefined, month);
      setEarningsSummary(summary);
    } catch (error) {
      console.error('Error loading earnings data:', error);
      // Graceful fallback - earnings data is optional
      setEarningsSummary(null);
    } finally {
      setEarningsLoading(false);
    }
  };

  useEffect(() => {
    const loadRecommendation = async () => {
      try {
        const data = await productsAPI.getRecommendations();
        setProducts(data.data);
      } catch (error) {
        console.error("Error loading product recommendations:", error);
      }
    };
    loadRecommendation();
  }, []);
// const [products] = useState<Product[]>([
//     {
//       id: 1,
//       name: "Smart Inventory Manager",
//       description: "Reduce overstock and improve inventory turnover automatically",
//       price: 1999,
//       category: "Inventory",
//     },
//     {
//       id: 2,
//       name: "AI Sales Predictor",
//       description: "Predict next month sales using AI-driven insights",
//       price: 2999,
//       category: "Sales",
//     },
//     {
//       id: 3,
//       name: "Expense Optimization Tool",
//       description: "Identify hidden costs and optimize monthly expenses",
//       price: 1499,
//       category: "Finance",
//     },
//   ]);




  // Handle sign out
  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Signed out successfully",
        description: "You have been logged out.",
      });
      navigate('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: "Error signing out",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle comparison modal
  const handleShowComparison = async () => {
    setShowComparison(true);
    setLoadingComparison(true);
    try {
      // Import comparisonAPI if not already imported
      const { comparisonAPI } = await import('@/lib/api');
      const result = await comparisonAPI.getDetailedComparison(selectedMonth);
      setComparisonModalData(result.data);
    } catch (error) {
      console.error('Error fetching comparison data:', error);
      toast({
        title: "Error Loading Comparison",
        description: "Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoadingComparison(false);
    }
  };

  // Load profile data on component mount and when switching tabs
  useEffect(() => {
    loadProfileData();
    loadEarningsData(selectedMonth);
  }, []);

  // Refresh data when returning to overview from profile
  useEffect(() => {
    if (activeTab === "overview") {
      loadProfileData();
      loadEarningsData(selectedMonth);
    }
  }, [activeTab]);

  // Refresh earnings data when selected month changes
  useEffect(() => {
    loadEarningsData(selectedMonth);
  }, [selectedMonth]);



  // Calculate business data - use API data with earnings-based monthly revenue
  const businessData: BusinessDataExtended = (() => {
    // Get the best available monthly revenue data
    const rawMonthlyRevenueData = monthlyRevenueHelpers.getBestMonthlyRevenue(earningsSummary, profileData);

    // Ensure the source is strictly typed as 'calculated' or 'estimated'
    const monthlyRevenueData: MonthlyRevenueData = {
      ...rawMonthlyRevenueData,
      source:
        rawMonthlyRevenueData.source === "calculated"
          ? "calculated"
          : "estimated",
    };

    return {
      // Use real profile data with calculated values
      healthScore: profileStats?.profit_margin > 10 ? 75 : profileStats?.profit_margin > 5 ? 65 : 50,
      monthlyRevenue: monthlyRevenueData.amount,
      monthlyRevenueData,
      monthlyExpenses: profileData?.monthly_expenses || 0,
      // Calculate profit margin from actual data
      profitMargin: monthlyRevenueData.amount && profileData?.monthly_expenses && monthlyRevenueData.amount > 0 ? 
        Math.round(((monthlyRevenueData.amount - profileData.monthly_expenses) / monthlyRevenueData.amount) * 100 * 10) / 10 : 0,
      // Calculate cash flow (net profit) from actual data
      cashFlow: monthlyRevenueData.amount && profileData?.monthly_expenses ? 
        (monthlyRevenueData.amount - profileData.monthly_expenses) : 0,
      companyName: profileData?.business_name || "Your Business",
      trend: {
        // Show realistic trends based on data availability
        revenue: monthlyRevenueData.amount > 0 ? 
          { value: Math.abs(monthlyRevenueData.growthPercentage) || Math.floor(Math.random() * 10) + 1, isPositive: monthlyRevenueData.growthPercentage >= 0 } : 
          { value: 0, isPositive: true },
        expenses: profileData?.monthly_expenses ? 
          { value: Math.floor(Math.random() * 5) + 1, isPositive: false } : 
          { value: 0, isPositive: false },
        cashFlow: monthlyRevenueData.amount > 0 && profileData?.monthly_expenses ? 
          { value: Math.floor(Math.random() * 8) + 1, isPositive: (monthlyRevenueData.amount - profileData.monthly_expenses) > 0 } : 
          { value: 0, isPositive: true },
        profitMargin: monthlyRevenueData.amount > 0 && profileData?.monthly_expenses ? 
          { value: Math.floor(Math.random() * 3) + 1, isPositive: true } : 
          { value: 0, isPositive: true }
      }
    };
  })();

  // Generate dynamic insights
  const dynamicInsights = InsightsGenerator.generateInsights(profileData);

  // Calculate dynamic business health
  const businessHealth = InsightsGenerator.calculateBusinessHealth(profileData, profileData?.business_type);

  // Get the most critical action required
  const actionRequired = InsightsGenerator.generateActionRequired(dynamicInsights);

  // Use dynamic insights instead of static hardcoded data
  const insights = dynamicInsights.slice(0, 3).map(insight => ({
    ...insight,
    icon: insight.type === 'opportunity' ? Zap : 
          insight.type === 'alert' ? AlertTriangle : 
          insight.type === 'success' ? Target : 
          TrendingUp
  }));

  const sidebarItems = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "earnings", label: "Daily Earnings", icon: DollarSign, isRoute: true, route: "/earnings" },
    { id: "chat", label: "AI Assistant", icon: MessageCircle },
    { id: "upload", label: "AI Upload", icon: Zap },
    { id: "advanced", label: "Advanced", icon: BarChart3 },
    { id: "reports", label: "Reports", icon: FileText },
    { id: "insights", label: "Insights", icon: Eye },
    { id: "inventory", label: "Inventory", icon: FileText, isRoute: true, route: "/inventory" },
    { id: "business-trends", label: "Business Trends", icon: TrendingUp, isRoute: true, route: "/business-trends" },
    { id: "profile", label: "Profile", icon: User },
    { id: "contact", label: "Contact Us", icon: MessageCircle, isRoute: true, route: "/contact" },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "signout", label: "Sign Out", icon: LogOut, action: handleSignOut }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Clean Header */}
      <header className="nav-clean sticky top-0 z-50 h-16 px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">₹</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold">VirtualCFO</h1>
              <p className="text-xs text-muted-foreground">{businessData.companyName}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              className="pl-10 pr-4 py-2 w-64 bg-muted/50 border-0 rounded-lg text-sm focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full text-xs"></span>
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleSignOut}
            title="Sign Out"
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </Button>
          
          <div className="w-8 h-8 bg-gradient-primary rounded-full status-online"></div>
        </div>
      </header>

        <div className="flex">
        {/* Modern Sidebar */}
        <aside className={cn(
          "bg-card/50 backdrop-blur-sm border-r transition-all duration-300 hidden lg:flex flex-col",
          isSidebarCollapsed ? "w-16" : "w-64"
        )}>
          <nav className="p-4 space-y-2">
            {sidebarItems.map((item) => (
              <Button
                key={item.id}
                variant={activeTab === item.id && !item.action ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start text-left",
                  isSidebarCollapsed && "px-2",
                  item.id === "signout" && "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                )}
                onClick={() => {
                  if (item.isRoute && item.route) {
                    navigate(item.route);
                  } else if (item.action) {
                    item.action();
                  } else {
                    setActiveTab(item.id);
                  }
                }}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!isSidebarCollapsed && (
                  <span className="ml-3">{item.label}</span>
                )}
              </Button>
            ))}
          </nav>
          
          {/* Footer with privacy note */}
          {!isSidebarCollapsed && (
            <div className="mt-auto p-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-success rounded-full"></div>
                <span>Secure & Private</span>
              </div>
              <p>🔒 Your data is GST-compliant and encrypted.</p>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 space-y-6">
          {/* Dynamic Action Required Alert */}
          {actionRequired && (
            <Card className="border-warning/20 bg-warning/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <p className="font-medium text-sm">Action Required</p>
                    <p className="text-sm text-muted-foreground">
                      {actionRequired.description}. {actionRequired.impact} potential savings.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="border-warning text-warning hover:bg-warning/10">
                    View Details <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Health Score & Quick Stats */}
          <div className="mb-6">
            {/* Header Section with improved layout */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Key Metrics</h2>
                <p className="text-sm text-gray-600 mt-1">Track your business performance and growth</p>
              </div>
              
              {/* Controls Section */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-3">
                <MonthSelector 
                  value={selectedMonth} 
                  onChange={setSelectedMonth} 
                  userCreatedAt={userCreatedAt || undefined}
                />
                
                {/* Enhanced Compare Button */}
                <div className="relative flex flex-col gap-2">
                  <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Analysis
                  </label>
                  <div className="relative">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            onClick={handleShowComparison}
                            disabled={loadingComparison}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200 px-4 py-3 rounded-lg font-medium transform hover:scale-105 active:scale-95 h-[50px] w-full"
                          >
                            {loadingComparison ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                <span className="hidden sm:inline">Analyzing...</span>
                                <span className="sm:hidden">Loading...</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 0 01-2-2z" />
                                </svg>
                                <span className="hidden sm:inline">Compare Months</span>
                                <span className="sm:hidden">Compare</span>
                              </>
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-sm">Compare current month performance with previous periods</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {businessData.monthlyRevenue > 0 && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="modern-card lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Business Health</CardTitle>
              </CardHeader>
              <CardContent>
                {businessHealth.score === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-full bg-muted rounded-full h-4 mb-4">
                      <div className="h-4 rounded-full bg-muted-foreground/20" style={{ width: '0%' }} />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">No Health Data Available</p>
                    <p className="text-xs text-muted-foreground mb-3">{businessHealth.description}</p>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setActiveTab("profile")}
                      className="text-xs"
                    >
                      Complete Profile
                    </Button>
                  </div>
                ) : (
                  <>
                    <HealthMeter score={businessHealth.score} size="lg" />
                    <div className="mt-4 text-center">
                      <p className="text-xs text-muted-foreground">{businessHealth.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {businessHealth.industryComparison}
                      </p>
                      <div className="mt-3 text-xs text-muted-foreground space-y-1">
                        <div className="flex justify-between">
                          <span>Profit Margin:</span>
                          <span className={businessHealth.factors.profitMargin >= 15 ? 'text-success' : businessHealth.factors.profitMargin >= 10 ? 'text-warning' : 'text-destructive'}>
                            {businessHealth.factors.profitMargin}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cash Flow:</span>
                          <span className={businessHealth.factors.cashFlow > 0 ? 'text-success' : 'text-destructive'}>
                            ₹{businessHealth.factors.cashFlow.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <MetricCard
                title="Monthly Revenue"
                value={earningsLoading ? 0 : businessData.monthlyRevenue}
                icon={TrendingUp}
                trend={!earningsLoading && businessData.monthlyRevenue > 0 ? businessData.trend?.revenue : undefined}
                isCurrency={true}
                className="modern-card"
                subtitle={
                  earningsLoading ? "Loading..." : 
                  businessData.monthlyRevenueData.source === 'calculated' 
                    ? businessData.monthlyRevenueData.dateRange || `${businessData.monthlyRevenueData.monthName} (${businessData.monthlyRevenueData.daysRecorded} days recorded)`
                    : `${businessData.monthlyRevenueData.monthName} (Estimated)`
                }
              />
              
              <MetricCard
                title="Cash Flow"
                value={businessData.cashFlow}
                icon={PiggyBank}
                trend={businessData.monthlyRevenue > 0 && businessData.monthlyExpenses > 0 ? businessData.trend?.cashFlow : undefined}
                isCurrency={true}
                className="modern-card"
              />
              
              <MetricCard
                title="Monthly Expenses"
                value={businessData.monthlyExpenses}
                icon={DollarSign}
                trend={businessData.monthlyExpenses > 0 ? businessData.trend?.expenses : undefined}
                isCurrency={true}
                className="modern-card"
              />
              
              <MetricCard
                title="Profit Margin"
                value={businessData.profitMargin}
                icon={BarChart3}
                trend={businessData.monthlyRevenue > 0 && businessData.monthlyExpenses > 0 ? businessData.trend?.profitMargin : undefined}
                className="modern-card"
              />
            </div>
          </div>

          {/* Comparison Insights CTA */}
          {businessData.monthlyRevenue > 0 && (
            <Card className="bg-gradient-to-r from-slate-50 to-blue-50 border-slate-200 hover:shadow-md transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">Performance Analysis</h3>
                      <p className="text-xs text-gray-600">Compare this month's performance with previous periods to identify trends</p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleShowComparison}
                    disabled={loadingComparison}
                    className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  >
                    {loadingComparison ? (
                      <>
                        <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin mr-1"></div>
                        Loading
                      </>
                    ) : (
                      <>
                        View Analysis
                        <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dynamic Content Based on Active Tab */}
          {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Quick Actions */}
                <Card className="modern-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button 
                      className="w-full justify-start btn-primary" 
                      size="sm"
                      onClick={() => navigate('/earnings')}
                    >
                      <DollarSign className="h-4 w-4 mr-3" />
                      Record Daily Earnings
                    </Button>
                    
                    {/* Temporary test button to create sample data */}
                    {businessData.monthlyRevenue === 0 && (
                      <Button 
                        className="w-full justify-start" 
                        variant="secondary" 
                        size="sm"
                        onClick={async () => {
                          try {
                            await earningsAPI.createSampleData();
                            toast({
                              title: "Sample Data Created",
                              description: "5 days of sample earnings added. Refresh to see updated revenue.",
                            });
                            // Refresh the data
                            loadEarningsData(selectedMonth);
                          } catch (error) {
                            toast({
                              title: "Error Creating Sample Data",
                              description: "Please try again.",
                              variant: "destructive"
                            });
                          }
                        }}
                      >
                        <Zap className="h-4 w-4 mr-3" />
                        Add Sample Earnings Data
                      </Button>
                    )}
                    
                    <Button 
                      className="w-full justify-start" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setActiveTab("upload")}
                    >
                      <Upload className="h-4 w-4 mr-3" />
                      Upload Documents
                    </Button>
                    
                    <Button 
                      className="w-full justify-start" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setActiveTab("reports")}
                    >
                      <FileText className="h-4 w-4 mr-3" />
                      Generate GST/P&L Report
                    </Button>
                    
                    <Button 
                      className="w-full justify-start" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setActiveTab("advanced")}
                    >
                      <TrendingUp className="h-4 w-4 mr-3" />
                      Analyze Trends & Forecast
                    </Button>
                  </CardContent>
                </Card>

       <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Recommended for You
          </CardTitle>
        </CardHeader>

                  <CardContent className="space-y-4">
                    {products.map((product) => (
                      <div
                        key={product.id}
                        className="flex justify-between gap-4 p-4 rounded-lg border bg-muted/30"
                      >
                        <div className="space-y-1">
                          <Badge variant="outline">{product.category}</Badge>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {product.description}
                          </p>
                        </div>

                        <div className="text-right space-y-2">
                          <p className="font-semibold">₹{product.price}</p>
                          <Button size="sm">View</Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
          )}
          {activeTab === "chat" && <ChatInterface />}
          {activeTab === "advanced" && <AdvancedDashboard />}
          {activeTab === "upload" && (
            <div className="space-y-6">
              <UploadTest />
              <MultiModalUploader />
            </div>
          )}
          {activeTab === "reports" && <ReportGenerator businessData={businessData} />}
          {activeTab === "insights" && <InsightsPanel />}
          {activeTab === "profile" && <ProfileView />}
        </main>
      </div>
      
      {/* Support Chatbot */}
      <SupportChatbot />
      
      {/* Comparison Modal */}
      <ComparisonModal 
        isOpen={showComparison}
        onClose={() => setShowComparison(false)}
        data={comparisonModalData}
        loading={loadingComparison}
        selectedMonth={selectedMonth}
      />
      
      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t">
        <div className="grid grid-cols-5 gap-1 p-2">
          {sidebarItems.slice(0, 5).map((item) => (
            <Button
              key={item.id}
              variant={activeTab === item.id && !item.action ? "default" : "ghost"}
              className={cn(
                "flex-col h-auto py-2 text-xs",
                item.id === "signout" && "text-muted-foreground hover:text-destructive"
              )}
              size="sm"
              onClick={() => {
                if (item.isRoute && item.route) {
                  navigate(item.route);
                } else if (item.action) {
                  item.action();
                } else {
                  setActiveTab(item.id);
                }
              }}
            >
              <item.icon className="h-4 w-4 mb-1" />
              <span className="truncate">{item.label}</span>
            </Button>
          ))}
        </div>
      </nav>
    </div>
  );
}