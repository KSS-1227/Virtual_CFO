import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Calendar,
  Plus,
  X,
  Download,
  Share2,
  Filter
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { comparisonAPI, comparisonHelpers } from '@/lib/api';

interface MultiMonthComparisonProps {
  className?: string;
  defaultMonths?: string[];
  maxMonths?: number;
}

export const MultiMonthComparison: React.FC<MultiMonthComparisonProps> = ({ 
  className, 
  defaultMonths = [],
  maxMonths = 6 
}) => {
  const [selectedMonths, setSelectedMonths] = useState<string[]>(() => {
    if (defaultMonths.length > 0) return defaultMonths;
    
    // Default to last 3 months
    const now = new Date();
    const months = [];
    for (let i = 0; i < 3; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
  });
  
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'chart' | 'table' | 'trends'>('chart');
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area'>('line');
  const [showMetrics, setShowMetrics] = useState({
    revenue: true,
    expenses: true,
    profit: true,
    margin: false
  });

  const monthOptions = comparisonHelpers.getMonthOptions();

  // Fetch comparison data
  useEffect(() => {
    if (selectedMonths.length < 2) return;
    
    const fetchComparison = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await comparisonAPI.getMultiMonthComparison(selectedMonths);
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
  }, [selectedMonths]);

  const handleMonthToggle = (month: string) => {
    setSelectedMonths(prev => {
      if (prev.includes(month)) {
        return prev.filter(m => m !== month);
      } else if (prev.length < maxMonths) {
        return [...prev, month].sort().reverse();
      }
      return prev;
    });
  };

  const formatCurrency = (value: number) => `₹${value.toLocaleString()}`;
  const formatPercentage = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

  const prepareChartData = () => {
    if (!comparisonData?.months) return [];
    
    return comparisonData.months.map((month: any) => ({
      month: month.month_name.split(' ')[0], // Short month name
      fullMonth: month.month_name,
      revenue: showMetrics.revenue ? month.revenue : 0,
      expenses: showMetrics.expenses ? month.expenses : 0,
      profit: showMetrics.profit ? month.profit : 0,
      margin: showMetrics.margin ? month.profit_margin : 0
    }));
  };

  const chartData = prepareChartData();

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 20, right: 30, left: 20, bottom: 5 }
    };

    switch (chartType) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
            <Tooltip formatter={(value, name) => [formatCurrency(Number(value)), name]} />
            {showMetrics.revenue && <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" />}
            {showMetrics.expenses && <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />}
            {showMetrics.profit && <Bar dataKey="profit" fill="#10b981" name="Profit" />}
          </BarChart>
        );
      
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
            <Tooltip formatter={(value, name) => [formatCurrency(Number(value)), name]} />
            {showMetrics.revenue && <Area type="monotone" dataKey="revenue" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="Revenue" />}
            {showMetrics.expenses && <Area type="monotone" dataKey="expenses" stackId="2" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Expenses" />}
            {showMetrics.profit && <Area type="monotone" dataKey="profit" stackId="3" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="Profit" />}
          </AreaChart>
        );
      
      default:
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
            <Tooltip formatter={(value, name) => [formatCurrency(Number(value)), name]} />
            {showMetrics.revenue && <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} name="Revenue" />}
            {showMetrics.expenses && <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} name="Expenses" />}
            {showMetrics.profit && <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} name="Profit" />}
            {showMetrics.margin && <Line type="monotone" dataKey="margin" stroke="#8b5cf6" strokeWidth={2} name="Profit Margin %" />}
          </LineChart>
        );
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

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Multi-Month Performance Analysis
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Month Selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Select Months to Compare</h3>
            <Badge variant="secondary">
              {selectedMonths.length}/{maxMonths} selected
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {monthOptions.slice(0, 12).map(option => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={option.value}
                  checked={selectedMonths.includes(option.value)}
                  onCheckedChange={() => handleMonthToggle(option.value)}
                  disabled={!selectedMonths.includes(option.value) && selectedMonths.length >= maxMonths}
                />
                <label
                  htmlFor={option.value}
                  className={`text-sm cursor-pointer ${option.isCurrent ? 'font-medium' : ''}`}
                >
                  {option.label}
                  {option.isCurrent && ' (Current)'}
                </label>
              </div>
            ))}
          </div>
        </div>

        {selectedMonths.length < 2 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="h-8 w-8 mx-auto mb-2" />
            <p>Select at least 2 months to compare</p>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-600">
            <p>{error}</p>
          </div>
        ) : comparisonData ? (
          <>
            {/* Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Select value={viewMode} onValueChange={(value) => setViewMode(value as any)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chart">Chart</SelectItem>
                    <SelectItem value="table">Table</SelectItem>
                    <SelectItem value="trends">Trends</SelectItem>
                  </SelectContent>
                </Select>

                {viewMode === 'chart' && (
                  <Select value={chartType} onValueChange={(value) => setChartType(value as any)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="line">Line</SelectItem>
                      <SelectItem value="bar">Bar</SelectItem>
                      <SelectItem value="area">Area</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1">
                    <Checkbox
                      checked={showMetrics.revenue}
                      onCheckedChange={(checked) => setShowMetrics(prev => ({ ...prev, revenue: !!checked }))}
                    />
                    <span className="text-sm">Revenue</span>
                  </label>
                  <label className="flex items-center gap-1">
                    <Checkbox
                      checked={showMetrics.expenses}
                      onCheckedChange={(checked) => setShowMetrics(prev => ({ ...prev, expenses: !!checked }))}
                    />
                    <span className="text-sm">Expenses</span>
                  </label>
                  <label className="flex items-center gap-1">
                    <Checkbox
                      checked={showMetrics.profit}
                      onCheckedChange={(checked) => setShowMetrics(prev => ({ ...prev, profit: !!checked }))}
                    />
                    <span className="text-sm">Profit</span>
                  </label>
                  <label className="flex items-center gap-1">
                    <Checkbox
                      checked={showMetrics.margin}
                      onCheckedChange={(checked) => setShowMetrics(prev => ({ ...prev, margin: !!checked }))}
                    />
                    <span className="text-sm">Margin %</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Best Month</p>
                    <p className="text-lg font-bold text-green-600">
                      {comparisonData.summary?.best_month?.month_name}
                    </p>
                    <p className="text-sm">
                      {formatCurrency(comparisonData.summary?.best_month?.profit || 0)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Avg Revenue</p>
                    <p className="text-lg font-bold">
                      {formatCurrency(comparisonData.summary?.average_monthly_revenue || 0)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Avg Profit</p>
                    <p className="text-lg font-bold">
                      {formatCurrency(comparisonData.summary?.average_monthly_profit || 0)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Growth Trend</p>
                    <div className="flex items-center justify-center gap-1">
                      {comparisonData.trends?.revenue_trend === 'increasing' ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : comparisonData.trends?.revenue_trend === 'decreasing' ? (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      ) : (
                        <div className="h-4 w-4" />
                      )}
                      <p className="text-lg font-bold capitalize">
                        {comparisonData.trends?.revenue_trend || 'Stable'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            {viewMode === 'chart' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Performance Chart</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    {renderChart()}
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {viewMode === 'table' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Detailed Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Month</th>
                          <th className="text-right p-2">Revenue</th>
                          <th className="text-right p-2">Expenses</th>
                          <th className="text-right p-2">Profit</th>
                          <th className="text-right p-2">Margin %</th>
                          <th className="text-right p-2">Days</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonData.months?.map((month: any, index: number) => (
                          <tr key={month.month} className="border-b">
                            <td className="p-2 font-medium">{month.month_name}</td>
                            <td className="p-2 text-right">{formatCurrency(month.revenue)}</td>
                            <td className="p-2 text-right">{formatCurrency(month.expenses)}</td>
                            <td className="p-2 text-right">{formatCurrency(month.profit)}</td>
                            <td className="p-2 text-right">{month.profit_margin.toFixed(1)}%</td>
                            <td className="p-2 text-right">{month.days_recorded}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {viewMode === 'trends' && comparisonData.insights && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">AI Insights & Trends</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {comparisonData.insights.map((insight: any, index: number) => (
                    <div key={index} className="flex items-start gap-3 p-4 rounded-lg border bg-gray-50">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{insight.title}</h4>
                          <Badge variant={insight.priority === 'high' ? 'destructive' : 'default'}>
                            {insight.priority.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{insight.message}</p>
                      </div>
                    </div>
                  ))}
                  
                  {comparisonData.trends && (
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium mb-2">Trend Analysis</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Revenue Trend:</span>
                          <span className="ml-2 font-medium capitalize">{comparisonData.trends.revenue_trend}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Profit Trend:</span>
                          <span className="ml-2 font-medium capitalize">{comparisonData.trends.profit_trend}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Volatility:</span>
                          <span className="ml-2 font-medium capitalize">{comparisonData.trends.volatility}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Growth Rate:</span>
                          <span className="ml-2 font-medium">{formatPercentage(comparisonData.trends.growth_rate)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
};