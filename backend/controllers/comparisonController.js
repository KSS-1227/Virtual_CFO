const { getAuthenticatedClient } = require("../config/supabase");

// Helper functions
const getMonthDateRange = (month) => {
  const [year, m] = month.split("-").map(Number);
  const start = `${year}-${String(m).padStart(2, "0")}-01`;
  const endDate = new Date(year, m, 0);
  const end = `${year}-${String(m).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
  return { start, end };
};

const getPreviousMonth = (month) => {
  const [year, m] = month.split("-").map(Number);
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? year - 1 : year;
  return `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
};

const getMonthName = (month) => {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 1, 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
};

// GET /api/comparison/detailed?month=YYYY-MM
const getDetailedComparison = async (req, res) => {
  try {
    const { month } = req.query;
    
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        success: false,
        error: "Invalid month format. Use YYYY-MM",
      });
    }

    const previousMonth = getPreviousMonth(month);
    const authClient = getAuthenticatedClient(req.accessToken);
    
    // Fetch both months data in parallel
    const [currentData, previousData] = await Promise.all([
      fetchMonthData(authClient, req.user.id, month),
      fetchMonthData(authClient, req.user.id, previousMonth)
    ]);

    // Calculate detailed metrics
    const comparison = {
      current: {
        month,
        month_name: getMonthName(month),
        ...currentData
      },
      previous: {
        month: previousMonth,
        month_name: getMonthName(previousMonth),
        ...previousData
      },
      changes: calculateChanges(currentData, previousData),
      insights: generateComparisonInsights(currentData, previousData, month)
    };

    res.json({
      success: true,
      data: comparison,
      error: null,
    });
  } catch (error) {
    console.error("Detailed comparison error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

// Helper function to fetch month data
const fetchMonthData = async (authClient, userId, month) => {
  const { start, end } = getMonthDateRange(month);
  
  const { data: earnings, error } = await authClient
    .from("earnings")
    .select("*")
    .eq("user_id", userId)
    .gte("earning_date", start)
    .lte("earning_date", end)
    .order("earning_date", { ascending: true });

  if (error) throw error;

  const revenue = earnings?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
  const expenses = earnings?.reduce((sum, e) => sum + (e.inventory_cost || 0), 0) || 0;
  const profit = revenue - expenses;
  const daysRecorded = earnings?.length || 0;
  
  return {
    revenue,
    expenses,
    profit,
    profit_margin: revenue > 0 ? (profit / revenue) * 100 : 0,
    days_recorded: daysRecorded,
    avg_daily_revenue: daysRecorded > 0 ? revenue / daysRecorded : 0,
    avg_daily_profit: daysRecorded > 0 ? profit / daysRecorded : 0,
    daily_data: earnings?.map(e => ({
      date: e.earning_date,
      revenue: e.amount || 0,
      expenses: e.inventory_cost || 0,
      profit: (e.amount || 0) - (e.inventory_cost || 0)
    })) || []
  };
};

// Calculate percentage changes
const calculateChanges = (current, previous) => {
  const safePercentChange = (curr, prev) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };

  return {
    revenue: {
      absolute: current.revenue - previous.revenue,
      percentage: safePercentChange(current.revenue, previous.revenue)
    },
    expenses: {
      absolute: current.expenses - previous.expenses,
      percentage: safePercentChange(current.expenses, previous.expenses)
    },
    profit: {
      absolute: current.profit - previous.profit,
      percentage: safePercentChange(current.profit, previous.profit)
    },
    profit_margin: {
      absolute: current.profit_margin - previous.profit_margin,
      percentage: safePercentChange(current.profit_margin, previous.profit_margin)
    },
    days_recorded: {
      absolute: current.days_recorded - previous.days_recorded,
      percentage: safePercentChange(current.days_recorded, previous.days_recorded)
    }
  };
};

// Generate comparison insights
const generateComparisonInsights = (current, previous, month) => {
  const insights = [];
  const changes = calculateChanges(current, previous);

  // Revenue insights
  if (changes.revenue.percentage > 10) {
    insights.push({
      type: "success",
      title: "Strong Revenue Growth",
      message: `Revenue increased by ${changes.revenue.percentage.toFixed(1)}% (₹${changes.revenue.absolute.toLocaleString()})`,
      priority: "high"
    });
  } else if (changes.revenue.percentage < -10) {
    insights.push({
      type: "warning",
      title: "Revenue Decline",
      message: `Revenue decreased by ${Math.abs(changes.revenue.percentage).toFixed(1)}% (₹${Math.abs(changes.revenue.absolute).toLocaleString()})`,
      priority: "high"
    });
  }

  // Profit margin insights
  if (changes.profit_margin.absolute > 5) {
    insights.push({
      type: "success",
      title: "Improved Efficiency",
      message: `Profit margin improved by ${changes.profit_margin.absolute.toFixed(1)} percentage points`,
      priority: "medium"
    });
  } else if (changes.profit_margin.absolute < -5) {
    insights.push({
      type: "alert",
      title: "Margin Pressure",
      message: `Profit margin decreased by ${Math.abs(changes.profit_margin.absolute).toFixed(1)} percentage points`,
      priority: "high"
    });
  }

  // Activity insights
  if (changes.days_recorded.absolute < -5) {
    insights.push({
      type: "info",
      title: "Recording Frequency",
      message: `You recorded ${Math.abs(changes.days_recorded.absolute)} fewer days this month`,
      priority: "low"
    });
  }

  return insights;
};

module.exports = {
  getDetailedComparison,
};