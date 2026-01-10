import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Target,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { comparisonAPI } from '@/lib/api';

interface ComparisonData {
  current: {
    month: string;
    month_name: string;
    revenue: number;
    expenses: number;
    profit: number;
    profit_margin: number;
    days_recorded: number;
    avg_daily_revenue: number;
    avg_daily_profit: number;
  };
  previous: {
    month: string;
    month_name: string;
    revenue: number;
    expenses: number;
    profit: number;
    profit_margin: number;
    days_recorded: number;
    avg_daily_revenue: number;
    avg_daily_profit: number;
  };
  changes: {
    revenue: { absolute: number; percentage: number };
    expenses: { absolute: number; percentage: number };
    profit: { absolute: number; percentage: number };
    profit_margin: { absolute: number; percentage: number };
  };
  insights: Array<{
    type: string;
    title: string;
    message: string;
    priority: string;
  }>;
}

interface AdvancedMonthComparisonProps {
  className?: string;
}

export const AdvancedMonthComparison: React.FC<AdvancedMonthComparisonProps> = ({ className }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'detailed' | 'trends'>('overview');

  // Generate month options (last 12 months)
  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    
    return options;
  };

  const monthOptions = getMonthOptions();

  // Fetch comparison data
  useEffect(() => {
    const fetchComparison = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await comparisonAPI.getDetailedComparison(selectedMonth);
        if (response.success) {
          setComparisonData(response.data);
        } else {
          setError(response.error || 'Failed to fetch comparison data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchComparison();
  }, [selectedMonth]);

  const formatCurrency = (value: number) => `₹${value.toLocaleString()}`;
  const formatPercentage = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

  const getTrendIcon = (percentage: number) => {
    if (percentage > 0) return <ArrowUpRight className="h-4 w-4 text-green-600" />;
    if (percentage < 0) return <ArrowDownRight className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const getTrendColor = (percentage: number) => {
    if (percentage > 0) return 'text-green-600 bg-green-50 border-green-200';
    if (percentage < 0) return 'text-red-600 bg-red-50 border-red-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'alert': return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default: return <Target className="h-5 w-5 text-blue-600" />;
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!comparisonData) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            <BarChart3 className="h-8 w-8 mx-auto mb-2" />
            <p>No comparison data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    {
      name: 'Revenue',
      current: comparisonData.current.revenue,
      previous: comparisonData.previous.revenue,
    },
    {
      name: 'Expenses',
      current: comparisonData.current.expenses,
      previous: comparisonData.previous.expenses,
    },
    {
      name: 'Profit',
      current: comparisonData.current.profit,
      previous: comparisonData.previous.profit,
    },
  ];

  const pieData = [
    { name: 'Revenue', value: comparisonData.current.revenue, color: '#3b82f6' },
    { name: 'Expenses', value: comparisonData.current.expenses, color: '#ef4444' },
  ];

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Month Comparison Analysis
          </CardTitle>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-gray-600">
          Comparing {comparisonData.current.month_name} with {comparisonData.previous.month_name}
        </p>
      </CardHeader>

      <CardContent>
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="detailed">Detailed</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Revenue Change</p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(comparisonData.changes.revenue.absolute)}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full border ${getTrendColor(comparisonData.changes.revenue.percentage)}`}>
                      {getTrendIcon(comparisonData.changes.revenue.percentage)}
                      <span className="text-sm font-medium">
                        {formatPercentage(comparisonData.changes.revenue.percentage)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Profit Change</p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(comparisonData.changes.profit.absolute)}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full border ${getTrendColor(comparisonData.changes.profit.percentage)}`}>
                      {getTrendIcon(comparisonData.changes.profit.percentage)}
                      <span className="text-sm font-medium">
                        {formatPercentage(comparisonData.changes.profit.percentage)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Margin Change</p>
                      <p className="text-2xl font-bold">
                        {comparisonData.changes.profit_margin.absolute.toFixed(1)}pp
                      </p>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full border ${getTrendColor(comparisonData.changes.profit_margin.absolute)}`}>
                      {getTrendIcon(comparisonData.changes.profit_margin.absolute)}
                      <span className="text-sm font-medium">
                        {formatPercentage(comparisonData.changes.profit_margin.percentage)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Comparison Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Financial Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="previous" fill="#e5e7eb" name={comparisonData.previous.month_name} />
                    <Bar dataKey="current" fill="#3b82f6" name={comparisonData.current.month_name} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="detailed" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Current Month Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{comparisonData.current.month_name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span>Revenue:</span>
                    <span className="font-medium">{formatCurrency(comparisonData.current.revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Expenses:</span>
                    <span className="font-medium">{formatCurrency(comparisonData.current.expenses)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Profit:</span>
                    <span className="font-medium">{formatCurrency(comparisonData.current.profit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Profit Margin:</span>
                    <span className="font-medium">{comparisonData.current.profit_margin.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Days Recorded:</span>
                    <span className="font-medium">{comparisonData.current.days_recorded}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Daily Revenue:</span>
                    <span className="font-medium">{formatCurrency(comparisonData.current.avg_daily_revenue)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Previous Month Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{comparisonData.previous.month_name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span>Revenue:</span>
                    <span className="font-medium">{formatCurrency(comparisonData.previous.revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Expenses:</span>
                    <span className="font-medium">{formatCurrency(comparisonData.previous.expenses)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Profit:</span>
                    <span className="font-medium">{formatCurrency(comparisonData.previous.profit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Profit Margin:</span>
                    <span className="font-medium">{comparisonData.previous.profit_margin.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Days Recorded:</span>
                    <span className="font-medium">{comparisonData.previous.days_recorded}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Daily Revenue:</span>
                    <span className="font-medium">{formatCurrency(comparisonData.previous.avg_daily_revenue)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Revenue Breakdown Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Current Month Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            {/* AI Insights */}
            {comparisonData.insights && comparisonData.insights.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">AI-Powered Insights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {comparisonData.insights.map((insight, index) => (
                    <div key={index} className="flex items-start gap-3 p-4 rounded-lg border bg-gray-50">
                      {getInsightIcon(insight.type)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{insight.title}</h4>
                          <Badge variant={insight.priority === 'high' ? 'destructive' : insight.priority === 'medium' ? 'default' : 'secondary'}>
                            {insight.priority.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{insight.message}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {comparisonData.current.days_recorded}
                    </div>
                    <div className="text-sm text-gray-600">Days Active</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(comparisonData.current.avg_daily_revenue)}
                    </div>
                    <div className="text-sm text-gray-600">Daily Avg</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {comparisonData.current.profit_margin.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-600">Profit Margin</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {formatPercentage(comparisonData.changes.revenue.percentage)}
                    </div>
                    <div className="text-sm text-gray-600">Growth Rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};