import { useState, useEffect } from "react";
import { HealthMeter } from "@/components/ui/health-meter";
import { MetricCard } from "@/components/ui/metric-card";
import { ChatInterface } from "@/components/chat-interface";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
<<<<<<< HEAD
import { profileAPI, productsAPI, metricsAPI } from "@/lib/api";
import { InsightsGenerator } from "@/lib/insights-generator";
import {
  TrendingUp,
  DollarSign,
  PiggyBank,
=======
import { profileAPI, chatAPI, handleAPIError, productsAPI, earningsAPI, monthlyRevenueHelpers, revenueAPI } from "@/lib/api";
import { InsightsGenerator } from "@/lib/insights-generator";
import MonthSelector from "./month-selector";
import { 
  TrendingUp, 
  DollarSign, 
  PiggyBank, 
>>>>>>> d7887215b40fde426d4f18886b4d864cee38fda6
  AlertTriangle,
  Upload,
  BarChart3,
  Menu,
  ChevronRight,
  Zap,
  Target,
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
import { ProfileView } from "@/components/profile-view";
<<<<<<< HEAD
=======
import { ComparisonModal } from "@/components/comparison-modal";
>>>>>>> d7887215b40fde426d4f18886b4d864cee38fda6
import { SupportChatbot } from "@/components/support-chatbot";
import { comparisonAPI } from "@/lib/api";

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
<<<<<<< HEAD
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [profileStats, setProfileStats] = useState<any>(null);
=======
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null);
  const [earningsSummary, setEarningsSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [earningsLoading, setEarningsLoading] = useState(true);
>>>>>>> d7887215b40fde426d4f18886b4d864cee38fda6
  const navigate = useNavigate();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  
  // Month Selector state
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  
  // Revenue analytics state
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [breakdownData, setBreakdownData] = useState<any>(null);
  const [insightData, setInsightData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState<boolean>(false);
  
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


<<<<<<< HEAD
=======
  // Handle comparison modal
  const handleShowComparison = async () => {
    setShowComparison(true);
    setLoadingComparison(true);
    try {
      const result = await comparisonAPI.getDetailedComparison(selectedMonth);
      setComparisonModalData(result.data);
    } catch (error) {
      console.log('Comparison API not available:', error);
      // Provide fallback data or show message
      setComparisonModalData({
        message: 'Detailed comparison data is not available yet. Please ensure you have earnings data for multiple months.',
        fallback: true
      });
    } finally {
      setLoadingComparison(false);
    }
  };

  // Handle sign out
>>>>>>> d7887215b40fde426d4f18886b4d864cee38fda6
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({ title: "Signed out successfully" });
    navigate("/auth");
  };

  useEffect(() => {
    loadProfileData();
    loadEarningsData(selectedMonth);
  }, []);

<<<<<<< HEAD
  const loadProfileData = async () => {
    try {
      setLoading(true);
      const [profile, stats] = await Promise.all([
        profileAPI.getProfile(),
        profileAPI.getProfileStats()
      ]);
      
      setProfileData(profile.data);
      setProfileStats(stats.data);
    } catch (error) {
      console.error('Error loading profile data:', error);
      // Graceful fallback - don't break the UI
      setProfileData(null);
      setProfileStats(null);
      toast({
        title: "Error Loading Data",
        description: "Please check your connection.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate business data - use API data
  const businessData: BusinessDataExtended = {
    // Use real profile data with calculated values
    healthScore: profileStats?.profit_margin > 10 ? 75 : profileStats?.profit_margin > 5 ? 65 : 50,
    monthlyRevenue: profileData?.monthly_revenue || 0,
    monthlyExpenses: profileData?.monthly_expenses || 0,
    profitMargin:
      profileData?.monthly_revenue > 0
        ? Math.round(
            ((profileData.monthly_revenue - profileData.monthly_expenses) /
              profileData.monthly_revenue) *
              100
          )
        : 0,
    cashFlow:
      (profileData?.monthly_revenue || 0) -
      (profileData?.monthly_expenses || 0),
    companyName: profileData?.business_name || "Your Business"
  };
=======
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

  // Fetch analytics data when selected month changes
  useEffect(() => {
    let isMounted = true;
    async function fetchAnalytics() {
      console.log('🔄 Fetching analytics for month:', selectedMonth);
      setLoadingAnalytics(true);
      try {
        // Check if user is authenticated
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.log('❌ No user session found');
          if (isMounted) {
            setComparisonData(null);
            setBreakdownData(null);
            setInsightData(null);
          }
          return;
        }
        
        console.log('✅ User authenticated, trying revenue APIs...');
        
        // Try revenue APIs with fallback to null if they don't exist
        const [compareResult, breakdownResult, insightResult] = await Promise.allSettled([
          revenueAPI.getRevenueComparison(selectedMonth).catch(() => null),
          revenueAPI.getRevenueBreakdown(selectedMonth).catch(() => null),
          revenueAPI.getRevenueInsights(selectedMonth).catch(() => null),
        ]);

        console.log('📊 API Results:', {
          comparison: compareResult.status,
          breakdown: breakdownResult.status,
          insights: insightResult.status
        });

        if (isMounted) {
          setComparisonData(compareResult.status === 'fulfilled' ? compareResult.value : null);
          setBreakdownData(breakdownResult.status === 'fulfilled' ? breakdownResult.value : null);
          setInsightData(insightResult.status === 'fulfilled' ? insightResult.value : null);
          
          // Log any errors but don't fail the component
          if (compareResult.status === 'rejected') {
            console.log('ℹ️ Comparison API not available:', compareResult.reason?.message);
          }
          if (breakdownResult.status === 'rejected') {
            console.log('ℹ️ Breakdown API not available:', breakdownResult.reason?.message);
          }
          if (insightResult.status === 'rejected') {
            console.log('ℹ️ Insights API not available:', insightResult.reason?.message);
          }
        }
      } catch (err) {
        console.log('ℹ️ Analytics APIs not available, using fallback data:', err);
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
>>>>>>> d7887215b40fde426d4f18886b4d864cee38fda6

  const sidebarItems = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "earnings", label: "Daily Earnings", icon: DollarSign, isRoute: true, route: "/earnings" },
    { id: "chat", label: "AI Assistant", icon: MessageCircle },
    { id: "upload", label: "AI Upload", icon: Zap },
    { id: "advanced", label: "Advanced", icon: BarChart3 },
    { id: "reports", label: "Reports", icon: FileText },
    { id: "insights", label: "Insights", icon: Eye },
    { id: "business-trends", label: "Business Trends", icon: TrendingUp, isRoute: true, route: "/business-trends" },
    { id: "profile", label: "Profile", icon: User },
    { id: "contact", label: "Contact Us", icon: MessageCircle, isRoute: true, route: "/contact" },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "signout", label: "Sign Out", icon: LogOut, action: handleSignOut }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* HEADER */}
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

        {/* PROFILE DROPDOWN */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full flex items-center justify-center"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
          >
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-white" />
            </div>
          </Button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-card border rounded-md shadow-lg z-50 space-y-1 p-2 transition-all duration-200 ease-out">
              {profileDropdownItems.map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  variant="ghost"
                  className={cn("w-full justify-start", item.danger && "text-destructive")}
                  onClick={() => {
                    if (item.isRoute && item.route) {
                      navigate(item.route);
                    } else {
                      item.action?.();
                      setIsProfileOpen(false);
                    }
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="flex">
        {/* SIDEBAR */}
        <aside className="bg-card/50 border-r hidden lg:flex w-64 p-4">
          <nav className="space-y-2 w-full">
            {sidebarItems.map((item) =>
              !item.children ? (
                <Button
                  key={item.id}
                  variant={activeTab === item.id ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() =>
                    item.isRoute ? navigate(item.route!) : setActiveTab(item.id)
                  }
                >
                  <item.icon className="h-4 w-4" />
                  <span className="ml-3">{item.label}</span>
                </Button>
              ) : null
            )}
          </nav>
        </aside>

        {/* MAIN */}
        <main className="flex-1 p-6 space-y-6">
<<<<<<< HEAD
          {activeTab === "overview" && (
            <>
              {/* Health + Metrics */}
              <div className="grid lg:grid-cols-3 gap-6">
                <Card className="modern-card lg:col-span-1">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Business Health</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <HealthMeter score={businessData.profitMargin} size="lg" />
=======
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
          <div className="flex items-center justify-between mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800">Key Metrics</h2>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleShowComparison}
                className="text-xs flex items-center gap-2 hover:bg-blue-50 border-blue-300"
                disabled={loadingComparison}
              >
                {loadingComparison ? (
                  <>
                    <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    Loading...
                  </>
                ) : (
                  <>
                    📊 Compare Months
                  </>
                )}
              </Button>
              <MonthSelector 
                value={selectedMonth} 
                onChange={setSelectedMonth} 
                userCreatedAt={userCreatedAt || undefined}
              />
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
>>>>>>> d7887215b40fde426d4f18886b4d864cee38fda6
                    <div className="mt-4 text-center">
                      <div className="mt-3 text-xs text-muted-foreground space-y-1">
                        <div className="flex justify-between">
                          <span>Profit Margin:</span>
                          <span>{businessData.profitMargin}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cash Flow:</span>
                          <span>₹{businessData.cashFlow.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
<<<<<<< HEAD
                  </CardContent>
                </Card>
=======
                  </>
                )}
              </CardContent>
            </Card>

            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <MetricCard
                title="Monthly Revenue"
                value={earningsLoading || loadingAnalytics ? 0 : businessData.monthlyRevenue}
                icon={TrendingUp}
                trend={!earningsLoading && !loadingAnalytics && comparisonData?.data?.growth ? {
                  value: Math.round(Math.abs(comparisonData.data.growth.revenue_growth)),
                  isPositive: comparisonData.data.growth.revenue_growth >= 0
                } : (!earningsLoading && !loadingAnalytics && businessData.monthlyRevenue > 0 ? businessData.trend?.revenue : undefined)}
                isCurrency={true}
                className={`modern-card ${loadingAnalytics ? 'opacity-60' : ''}`}
                subtitle={
                  earningsLoading || loadingAnalytics ? "Loading..." : 
                  businessData.monthlyRevenueData.source === 'calculated' 
                    ? `${businessData.monthlyRevenueData.monthName} (${businessData.monthlyRevenueData.daysRecorded} days recorded)`
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
>>>>>>> d7887215b40fde426d4f18886b4d864cee38fda6

                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <MetricCard title="Monthly Revenue" value={businessData.monthlyRevenue} icon={TrendingUp} isCurrency />
                  <MetricCard title="Cash Flow" value={businessData.cashFlow} icon={PiggyBank} isCurrency />
                  <MetricCard title="Monthly Expenses" value={businessData.monthlyExpenses} icon={DollarSign} isCurrency />
                  <MetricCard title="Profit Margin" value={businessData.profitMargin} icon={BarChart3} />
                </div>
              </div>
</>          )}
          {/* Dynamic Content Based on Active Tab */}
          {activeTab === "overview" && (
            <div className="grid xl:grid-cols-3 gap-6">
              {/* AI Chat Interface */}
              <Card className="modern-card xl:col-span-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">AI CFO Assistant</CardTitle>
                    <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                      <div className="w-2 h-2 bg-success rounded-full mr-2 animate-pulse"></div>
                      Online
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="h-[400px]">
                    <ChatInterface />
                  </div>
                </CardContent>
              </Card>

              {/* Insights & Actions */}
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

<<<<<<< HEAD
                {/* Key Insights */}
                <Card className="modern-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Key Insights</CardTitle>
                  </CardHeader>
=======
                {/* AI Insights */}
                <Card className="modern-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Brain className="h-4 w-4 text-primary" />
                        AI Insights
                        {loadingAnalytics && (
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        )}
                      </CardTitle>
                      {insightData?.data && (
                        <Badge variant="outline" className="text-xs">
                          {insightData.data.insights?.length || 0} insights
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Quick Comparison Summary */}
                    {comparisonData?.data && !loadingAnalytics && (
                      <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-sm text-blue-900 flex items-center gap-2">
                            📊 Month Comparison
                          </h4>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handleShowComparison}
                            className="text-xs text-blue-700 hover:text-blue-900 h-6 px-2"
                          >
                            Details →
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-gray-600">Revenue Change:</span>
                            <div className={`font-medium ${comparisonData.data.growth.revenue_growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {comparisonData.data.growth.revenue_growth >= 0 ? '+' : ''}{comparisonData.data.growth.revenue_growth.toFixed(1)}%
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-600">Profit Change:</span>
                            <div className={`font-medium ${comparisonData.data.growth.profit_growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {comparisonData.data.growth.profit_growth >= 0 ? '+' : ''}{comparisonData.data.growth.profit_growth.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {loadingAnalytics ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-100 rounded w-full"></div>
                          </div>
                        ))}
                      </div>
                    ) : insightData?.data ? (
                      <div className="space-y-4">
                        {insightData.data.insights?.slice(0, 3).map((insight: any, index: number) => {
                          const priorityColors = {
                            high: 'border-l-red-500 bg-red-50 text-red-900',
                            medium: 'border-l-yellow-500 bg-yellow-50 text-yellow-900',
                            low: 'border-l-blue-500 bg-blue-50 text-blue-900'
                          };
                          
                          const priorityIcons = {
                            high: AlertTriangle,
                            medium: TrendingUp,
                            low: Target
                          };
                          
                          const IconComponent = priorityIcons[insight.priority as keyof typeof priorityIcons] || Target;
                          
                          return (
                            <div 
                              key={index} 
                              className={`p-3 rounded-lg border-l-4 transition-all hover:shadow-sm ${
                                priorityColors[insight.priority as keyof typeof priorityColors] || priorityColors.low
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <IconComponent className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-medium text-sm">{insight.title}</h4>
                                    <Badge 
                                      variant="outline" 
                                      className={`text-xs px-1.5 py-0.5 ${
                                        insight.priority === 'high' ? 'border-red-300 text-red-700 bg-red-50' :
                                        insight.priority === 'medium' ? 'border-yellow-300 text-yellow-700 bg-yellow-50' :
                                        'border-blue-300 text-blue-700 bg-blue-50'
                                      }`}
                                    >
                                      {insight.priority.toUpperCase()}
                                    </Badge>
                                  </div>
                                  <p className="text-xs leading-relaxed">{insight.message}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        
                        {insightData.data.recommendations?.length > 0 && (
                          <div className="mt-4 p-3 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20">
                            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                              <Zap className="h-4 w-4 text-primary" />
                              Recommendations
                            </h4>
                            <ul className="text-xs space-y-1">
                              {insightData.data.recommendations.slice(0, 3).map((rec: string, index: number) => (
                                <li key={index} className="flex items-start gap-2">
                                  <span className="text-primary mt-1">•</span>
                                  <span className="text-gray-700">{rec}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {insightData.data.metrics && (
                          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                            <div className="bg-gray-50 p-2 rounded">
                              <span className="text-gray-600">Profit Margin</span>
                              <div className="font-semibold text-sm">
                                {insightData.data.metrics.profit_margin?.toFixed(1) || 0}%
                              </div>
                            </div>
                            <div className="bg-gray-50 p-2 rounded">
                              <span className="text-gray-600">Days Recorded</span>
                              <div className="font-semibold text-sm">
                                {insightData.data.metrics.days_recorded || 0}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <MessageCircle className="h-6 w-6 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-500 mb-2">No insights available</p>
                        <p className="text-xs text-gray-400">Add earnings data to get AI-powered insights</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

       <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Recommended for You
          </CardTitle>
        </CardHeader>

>>>>>>> d7887215b40fde426d4f18886b4d864cee38fda6
                  <CardContent className="space-y-4">
                    {insights.map((insight) => {
                      const IconComponent = insight.icon;
                      return (
                        <div key={insight.id} className="flex gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                            insight.type === "success" && "bg-success/10 text-success",
                            insight.type === "alert" && "bg-warning/10 text-warning",
                            insight.type === "opportunity" && "bg-primary/10 text-primary",
                            insight.type === "prediction" && "bg-blue/10 text-blue"
                          )}>
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium truncate">{insight.title}</p>
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
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {insight.description}
                            </p>
                            <p className="text-xs font-medium mt-1 text-primary">
                              {insight.impact}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Annual: {insight.annualImpact}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
          {activeTab === "chat" && <ChatInterface />}
          {activeTab === "advanced" && <AdvancedDashboard />}
          {activeTab === "chat" && (
            <Card className="modern-card">
              <CardContent className="p-0">
                <div className="h-[600px]">
                  <ChatInterface />
                </div>
              </CardContent>
            </Card>
          )}
          {activeTab === "upload" && <DocumentUploader />}
          {activeTab === "reports" && <ReportGenerator businessData={businessData} />}
          {activeTab === "profile" && <ProfileView />}
          {activeTab === "settings" && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold">Settings</h2>
                <p className="text-sm text-muted-foreground">Settings page coming soon.</p>
              </CardContent>
            </Card>
          )}
          
        </main>
      </div>

      <SupportChatbot />
<<<<<<< HEAD
=======
      
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
>>>>>>> d7887215b40fde426d4f18886b4d864cee38fda6
    </div>
  );
}
