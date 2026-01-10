const { supabase, getAuthenticatedClient } = require("../config/supabase");

// Helper function to get month date range
const getMonthDateRange = (month) => {
  const [year, m] = month.split("-").map(Number);
  const start = `${year}-${String(m).padStart(2, "0")}-01`;
  // Get last day of month
  const endDate = new Date(year, m, 0); // m is 1-based
  const end = `${year}-${String(m).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
  return { start, end };
};

// Helper function to get previous month
const getPreviousMonth = (month) => {
  const [year, m] = month.split("-").map(Number);
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? year - 1 : year;
  return `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
};

// Helper function to check if month is in the future
const isFutureMonth = (month) => {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return month > currentMonth;
};

// Helper function to get authenticated client for request
const getAuthClient = (req) => {
  return getAuthenticatedClient(req.accessToken);
};

// GET /api/revenue/monthly?month=YYYY-MM
const getMonthlyRevenue = async (req, res) => {
  try {
    const { month } = req.query;
    
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        success: false,
        error: "Invalid month format. Use YYYY-MM",
        data: null,
      });
    }

    // If future month, return zero
    if (isFutureMonth(month)) {
      return res.json({
        success: true,
        data: {
          month,
          total_revenue: 0,
          total_expenses: 0,
          net_profit: 0,
          days_recorded: 0,
          avg_daily_revenue: 0,
          is_future: true,
        },
        error: null,
      });
    }

    const { start, end } = getMonthDateRange(month);
    const authClient = getAuthClient(req);

    // Get earnings for the month
    const { data: earnings, error } = await authClient
      .from("earnings")
      .select("*")
      .eq("user_id", req.user.id)
      .gte("earning_date", start)
      .lte("earning_date", end)
      .order("earning_date", { ascending: false });

    if (error) {
      console.error("Error fetching monthly revenue:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch monthly revenue",
        data: null,
      });
    }

    // Calculate totals
    const totalRevenue = earnings?.reduce((sum, earning) => sum + (earning.amount || 0), 0) || 0;
    const totalExpenses = earnings?.reduce((sum, earning) => sum + (earning.inventory_cost || 0), 0) || 0;
    const netProfit = totalRevenue - totalExpenses;
    const daysRecorded = earnings?.length || 0;
    const avgDailyRevenue = daysRecorded > 0 ? totalRevenue / daysRecorded : 0;

    res.json({
      success: true,
      data: {
        month,
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        net_profit: netProfit,
        days_recorded: daysRecorded,
        avg_daily_revenue: avgDailyRevenue,
        is_future: false,
      },
      error: null,
    });
  } catch (error) {
    console.error("Monthly revenue error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      data: null,
    });
  }
};

// GET /api/revenue/compare?month=YYYY-MM
const getRevenueComparison = async (req, res) => {
  try {
    const { month } = req.query;
    
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        success: false,
        error: "Invalid month format. Use YYYY-MM",
        data: null,
      });
    }

    const previousMonth = getPreviousMonth(month);
    const authClient = getAuthClient(req);
    
    // Get current month data
    const currentMonthRange = getMonthDateRange(month);
    const { data: currentEarnings, error: currentError } = await authClient
      .from("earnings")
      .select("*")
      .eq("user_id", req.user.id)
      .gte("earning_date", currentMonthRange.start)
      .lte("earning_date", currentMonthRange.end);

    if (currentError) {
      console.error("Error fetching current month data:", currentError);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch comparison data",
        data: null,
      });
    }

    // Get previous month data
    const previousMonthRange = getMonthDateRange(previousMonth);
    const { data: previousEarnings, error: previousError } = await authClient
      .from("earnings")
      .select("*")
      .eq("user_id", req.user.id)
      .gte("earning_date", previousMonthRange.start)
      .lte("earning_date", previousMonthRange.end);

    if (previousError) {
      console.error("Error fetching previous month data:", previousError);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch comparison data",
        data: null,
      });
    }

    // Calculate current month totals
    const currentRevenue = currentEarnings?.reduce((sum, earning) => sum + (earning.amount || 0), 0) || 0;
    const currentExpenses = currentEarnings?.reduce((sum, earning) => sum + (earning.inventory_cost || 0), 0) || 0;
    const currentProfit = currentRevenue - currentExpenses;

    // Calculate previous month totals
    const previousRevenue = previousEarnings?.reduce((sum, earning) => sum + (earning.amount || 0), 0) || 0;
    const previousExpenses = previousEarnings?.reduce((sum, earning) => sum + (earning.inventory_cost || 0), 0) || 0;
    const previousProfit = previousRevenue - previousExpenses;

    // Calculate growth percentages (avoid division by zero)
    const revenueGrowth = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    const expenseGrowth = previousExpenses > 0 ? ((currentExpenses - previousExpenses) / previousExpenses) * 100 : 0;
    const profitGrowth = previousProfit > 0 ? ((currentProfit - previousProfit) / previousProfit) * 100 : 0;

    res.json({
      success: true,
      data: {
        current_month: {
          month,
          revenue: currentRevenue,
          expenses: currentExpenses,
          profit: currentProfit,
        },
        previous_month: {
          month: previousMonth,
          revenue: previousRevenue,
          expenses: previousExpenses,
          profit: previousProfit,
        },
        growth: {
          revenue_growth: revenueGrowth,
          expense_growth: expenseGrowth,
          profit_growth: profitGrowth,
        },
        trends: {
          revenue_trend: revenueGrowth > 0 ? "increasing" : revenueGrowth < 0 ? "decreasing" : "stable",
          expense_trend: expenseGrowth > 0 ? "increasing" : expenseGrowth < 0 ? "decreasing" : "stable",
          profit_trend: profitGrowth > 0 ? "increasing" : profitGrowth < 0 ? "decreasing" : "stable",
        },
      },
      error: null,
    });
  } catch (error) {
    console.error("Revenue comparison error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      data: null,
    });
  }
};

// GET /api/revenue/breakdown?month=YYYY-MM
const getRevenueBreakdown = async (req, res) => {
  try {
    const { month } = req.query;
    
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        success: false,
        error: "Invalid month format. Use YYYY-MM",
        data: null,
      });
    }

    // If future month, return empty breakdown
    if (isFutureMonth(month)) {
      return res.json({
        success: true,
        data: {
          month,
          daily_breakdown: [],
          weekly_breakdown: [],
          summary: {
            total_revenue: 0,
            total_expenses: 0,
            net_profit: 0,
            best_day: null,
            worst_day: null,
          },
          is_future: true,
        },
        error: null,
      });
    }

    const { start, end } = getMonthDateRange(month);
    const authClient = getAuthClient(req);

    // Get earnings for the month
    const { data: earnings, error } = await authClient
      .from("earnings")
      .select("*")
      .eq("user_id", req.user.id)
      .gte("earning_date", start)
      .lte("earning_date", end)
      .order("earning_date", { ascending: true });

    if (error) {
      console.error("Error fetching breakdown data:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch breakdown data",
        data: null,
      });
    }

    // Create daily breakdown
    const dailyBreakdown = earnings?.map(earning => ({
      date: earning.earning_date,
      revenue: earning.amount || 0,
      expenses: earning.inventory_cost || 0,
      profit: (earning.amount || 0) - (earning.inventory_cost || 0),
    })) || [];

    // Create weekly breakdown
    const weeklyBreakdown = [];
    const weeklyData = {};
    
    dailyBreakdown.forEach(day => {
      const date = new Date(day.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = {
          week_start: weekKey,
          revenue: 0,
          expenses: 0,
          profit: 0,
          days_count: 0,
        };
      }
      
      weeklyData[weekKey].revenue += day.revenue;
      weeklyData[weekKey].expenses += day.expenses;
      weeklyData[weekKey].profit += day.profit;
      weeklyData[weekKey].days_count += 1;
    });

    Object.values(weeklyData).forEach(week => {
      weeklyBreakdown.push(week);
    });

    // Calculate summary
    const totalRevenue = dailyBreakdown.reduce((sum, day) => sum + day.revenue, 0);
    const totalExpenses = dailyBreakdown.reduce((sum, day) => sum + day.expenses, 0);
    const netProfit = totalRevenue - totalExpenses;
    
    const bestDay = dailyBreakdown.length > 0 
      ? dailyBreakdown.reduce((best, day) => day.profit > best.profit ? day : best)
      : null;
    
    const worstDay = dailyBreakdown.length > 0 
      ? dailyBreakdown.reduce((worst, day) => day.profit < worst.profit ? day : worst)
      : null;

    res.json({
      success: true,
      data: {
        month,
        daily_breakdown: dailyBreakdown,
        weekly_breakdown: weeklyBreakdown,
        summary: {
          total_revenue: totalRevenue,
          total_expenses: totalExpenses,
          net_profit: netProfit,
          best_day: bestDay,
          worst_day: worstDay,
        },
        is_future: false,
      },
      error: null,
    });
  } catch (error) {
    console.error("Revenue breakdown error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      data: null,
    });
  }
};

// GET /api/revenue/insight?month=YYYY-MM
const getRevenueInsights = async (req, res) => {
  try {
    const { month } = req.query;
    
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        success: false,
        error: "Invalid month format. Use YYYY-MM",
        data: null,
      });
    }

    // If future month, return future insights
    if (isFutureMonth(month)) {
      return res.json({
        success: true,
        data: {
          month,
          insights: [
            {
              type: "future_planning",
              title: "Future Month Planning",
              message: "This is a future month. Consider setting revenue targets and planning your business activities.",
              priority: "medium",
            }
          ],
          recommendations: [
            "Set monthly revenue targets",
            "Plan inventory purchases",
            "Schedule marketing activities",
          ],
          is_future: true,
        },
        error: null,
      });
    }

    const { start, end } = getMonthDateRange(month);
    const previousMonth = getPreviousMonth(month);
    const authClient = getAuthClient(req);

    // Get current month data
    const currentMonthRange = getMonthDateRange(month);
    const { data: currentEarnings, error: currentError } = await authClient
      .from("earnings")
      .select("*")
      .eq("user_id", req.user.id)
      .gte("earning_date", currentMonthRange.start)
      .lte("earning_date", currentMonthRange.end);

    if (currentError) {
      console.error("Error fetching insights data:", currentError);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch insights data",
        data: null,
      });
    }

    // Get previous month data for comparison
    const previousMonthRange = getMonthDateRange(previousMonth);
    const { data: previousEarnings } = await authClient
      .from("earnings")
      .select("*")
      .eq("user_id", req.user.id)
      .gte("earning_date", previousMonthRange.start)
      .lte("earning_date", previousMonthRange.end);

    // Calculate metrics
    const currentRevenue = currentEarnings?.reduce((sum, earning) => sum + (earning.amount || 0), 0) || 0;
    const currentExpenses = currentEarnings?.reduce((sum, earning) => sum + (earning.inventory_cost || 0), 0) || 0;
    const currentProfit = currentRevenue - currentExpenses;
    const daysRecorded = currentEarnings?.length || 0;
    
    const previousRevenue = previousEarnings?.reduce((sum, earning) => sum + (earning.amount || 0), 0) || 0;
    const previousProfit = previousRevenue - (previousEarnings?.reduce((sum, earning) => sum + (earning.inventory_cost || 0), 0) || 0);

    // Generate insights
    const insights = [];
    const recommendations = [];

    // Revenue insights
    if (currentRevenue > previousRevenue) {
      insights.push({
        type: "positive_trend",
        title: "Revenue Growth",
        message: `Your revenue increased by ₹${(currentRevenue - previousRevenue).toLocaleString()} compared to last month.`,
        priority: "high",
      });
      recommendations.push("Continue current successful strategies");
    } else if (currentRevenue < previousRevenue) {
      insights.push({
        type: "concern",
        title: "Revenue Decline",
        message: `Your revenue decreased by ₹${(previousRevenue - currentRevenue).toLocaleString()} compared to last month.`,
        priority: "high",
      });
      recommendations.push("Analyze factors causing revenue decline");
      recommendations.push("Consider promotional activities");
    }

    // Profit margin insights
    const profitMargin = currentRevenue > 0 ? (currentProfit / currentRevenue) * 100 : 0;
    if (profitMargin > 20) {
      insights.push({
        type: "positive",
        title: "Healthy Profit Margin",
        message: `Your profit margin is ${profitMargin.toFixed(1)}%, which is excellent.`,
        priority: "medium",
      });
    } else if (profitMargin < 10) {
      insights.push({
        type: "warning",
        title: "Low Profit Margin",
        message: `Your profit margin is ${profitMargin.toFixed(1)}%, consider optimizing costs.`,
        priority: "high",
      });
      recommendations.push("Review and optimize inventory costs");
      recommendations.push("Consider price adjustments");
    }

    // Activity insights
    if (daysRecorded < 15) {
      insights.push({
        type: "info",
        title: "Recording Frequency",
        message: `You recorded earnings for ${daysRecorded} days this month. More frequent recording provides better insights.`,
        priority: "low",
      });
      recommendations.push("Record earnings more frequently");
    }

    // Daily average insights
    const avgDailyRevenue = daysRecorded > 0 ? currentRevenue / daysRecorded : 0;
    if (avgDailyRevenue > 0) {
      insights.push({
        type: "info",
        title: "Daily Performance",
        message: `Your average daily revenue is ₹${avgDailyRevenue.toLocaleString()}.`,
        priority: "medium",
      });
    }

    // Default recommendations if none generated
    if (recommendations.length === 0) {
      recommendations.push("Continue monitoring your financial performance");
      recommendations.push("Consider setting monthly targets");
    }

    res.json({
      success: true,
      data: {
        month,
        insights,
        recommendations,
        metrics: {
          revenue: currentRevenue,
          profit: currentProfit,
          profit_margin: profitMargin,
          days_recorded: daysRecorded,
          avg_daily_revenue: avgDailyRevenue,
        },
        is_future: false,
      },
      error: null,
    });
  } catch (error) {
    console.error("Revenue insights error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      data: null,
    });
  }
};

module.exports = {
  getMonthlyRevenue,
  getRevenueComparison,
  getRevenueBreakdown,
  getRevenueInsights,
};