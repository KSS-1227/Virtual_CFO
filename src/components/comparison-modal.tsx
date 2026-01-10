import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComparisonChart } from './comparison-chart';
import { TrendingUp, TrendingDown, AlertTriangle, Target, Zap, Calendar, BarChart3, DollarSign, Percent } from 'lucide-react';

interface ComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  loading: boolean;
  selectedMonth: string;
}

export const ComparisonModal: React.FC<ComparisonModalProps> = ({
  isOpen,
  onClose,
  data,
  loading,
  selectedMonth
}) => {
  if (!data && !loading) return null;

  const formatCurrency = (value: number) => `₹${value.toLocaleString()}`;
  const formatPercentage = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'success': return Target;
      case 'warning': return AlertTriangle;
      case 'alert': return AlertTriangle;
      default: return Zap;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-green-600 bg-green-50 border-green-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'alert': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto bg-gradient-to-br from-slate-50 to-white">
        <DialogHeader className="border-b border-slate-200 pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-slate-800">
                  Month Comparison Analysis
                </DialogTitle>
                <DialogDescription className="text-slate-600 mt-1">
                  Compare your business performance between months with detailed insights and trends
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              <Calendar className="h-3 w-3 mr-1" />
              {selectedMonth}
            </Badge>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="space-y-6 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-3"></div>
                    <div className="h-8 bg-slate-100 rounded mb-2"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-64 bg-slate-100 rounded"></div>
              </CardContent>
            </Card>
          </div>
        ) : data && !data.fallback ? (
          <div className="space-y-8 p-6">
            {/* Executive Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Revenue Performance
                    </CardTitle>
                    {(data.changes?.revenue?.percentage || 0) >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-3xl font-bold text-slate-800">
                      {formatCurrency(data.changes?.revenue?.absolute || 0)}
                    </div>
                    <Badge 
                      variant={(data.changes?.revenue?.percentage || 0) >= 0 ? "default" : "destructive"}
                      className="text-sm font-semibold"
                    >
                      {formatPercentage(data.changes?.revenue?.percentage || 0)}
                    </Badge>
                    <p className="text-xs text-slate-500 mt-2">
                      vs previous month
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Profit Impact
                    </CardTitle>
                    {(data.changes?.profit?.percentage || 0) >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-3xl font-bold text-slate-800">
                      {formatCurrency(data.changes?.profit?.absolute || 0)}
                    </div>
                    <Badge 
                      variant={(data.changes?.profit?.percentage || 0) >= 0 ? "default" : "destructive"}
                      className="text-sm font-semibold"
                    >
                      {formatPercentage(data.changes?.profit?.percentage || 0)}
                    </Badge>
                    <p className="text-xs text-slate-500 mt-2">
                      profit change
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-violet-50 hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                      <Percent className="h-4 w-4" />
                      Margin Efficiency
                    </CardTitle>
                    {(data.changes?.profit_margin?.absolute || 0) >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-3xl font-bold text-slate-800">
                      {(data.changes?.profit_margin?.absolute || 0).toFixed(1)}pp
                    </div>
                    <Badge 
                      variant={(data.changes?.profit_margin?.absolute || 0) >= 0 ? "default" : "destructive"}
                      className="text-sm font-semibold"
                    >
                      {formatPercentage(data.changes?.profit_margin?.percentage || 0)}
                    </Badge>
                    <p className="text-xs text-slate-500 mt-2">
                      margin change
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Comparison Chart */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  Performance Comparison
                </CardTitle>
                <p className="text-sm text-slate-600">
                  Visual comparison of key metrics between {data.previous?.month_name || 'Previous'} and {data.current?.month_name || 'Current'}
                </p>
              </CardHeader>
              <CardContent className="p-6">
                <ComparisonChart data={data} loading={false} />
              </CardContent>
            </Card>

            {/* Detailed Metrics */}
            {data.current && data.previous && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
                    <CardTitle className="text-lg font-semibold text-slate-800">
                      Current Period: {data.current.month_name || 'Current'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {[
                        { label: 'Revenue', value: data.current.revenue || 0, icon: DollarSign, color: 'text-green-600' },
                        { label: 'Expenses', value: data.current.expenses || 0, icon: TrendingDown, color: 'text-red-600' },
                        { label: 'Profit', value: data.current.profit || 0, icon: Target, color: 'text-blue-600' },
                        { label: 'Profit Margin', value: `${(data.current.profit_margin || 0).toFixed(1)}%`, icon: Percent, color: 'text-purple-600', isPercentage: true },
                        { label: 'Days Recorded', value: data.current.days_recorded || 0, icon: Calendar, color: 'text-slate-600', isCount: true }
                      ].map((metric, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg bg-white ${metric.color}`}>
                              <metric.icon className="h-4 w-4" />
                            </div>
                            <span className="font-medium text-slate-700">{metric.label}</span>
                          </div>
                          <span className="font-bold text-slate-800">
                            {metric.isPercentage ? metric.value : metric.isCount ? metric.value : formatCurrency(metric.value as number)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                  <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-t-lg">
                    <CardTitle className="text-lg font-semibold text-slate-800">
                      Previous Period: {data.previous.month_name || 'Previous'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {[
                        { label: 'Revenue', value: data.previous.revenue || 0, icon: DollarSign, color: 'text-green-600' },
                        { label: 'Expenses', value: data.previous.expenses || 0, icon: TrendingDown, color: 'text-red-600' },
                        { label: 'Profit', value: data.previous.profit || 0, icon: Target, color: 'text-blue-600' },
                        { label: 'Profit Margin', value: `${(data.previous.profit_margin || 0).toFixed(1)}%`, icon: Percent, color: 'text-purple-600', isPercentage: true },
                        { label: 'Days Recorded', value: data.previous.days_recorded || 0, icon: Calendar, color: 'text-slate-600', isCount: true }
                      ].map((metric, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg bg-white ${metric.color}`}>
                              <metric.icon className="h-4 w-4" />
                            </div>
                            <span className="font-medium text-slate-700">{metric.label}</span>
                          </div>
                          <span className="font-bold text-slate-800">
                            {metric.isPercentage ? metric.value : metric.isCount ? metric.value : formatCurrency(metric.value as number)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* AI Insights */}
            {data.insights && data.insights.length > 0 && (
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-t-lg">
                  <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-600" />
                    AI-Powered Insights
                  </CardTitle>
                  <p className="text-sm text-slate-600">
                    Key findings and recommendations based on your performance data
                  </p>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid gap-4">
                    {data.insights.map((insight: any, index: number) => {
                      const IconComponent = getInsightIcon(insight.type);
                      return (
                        <div
                          key={index}
                          className={`p-4 rounded-xl border-l-4 ${getInsightColor(insight.type)} hover:shadow-md transition-all duration-300`}
                        >
                          <div className="flex items-start gap-4">
                            <div className="p-2 rounded-lg bg-white shadow-sm">
                              <IconComponent className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h5 className="font-semibold text-slate-800">{insight.title}</h5>
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs px-2 py-1 ${
                                    insight.priority === 'high' ? 'border-red-300 text-red-700 bg-red-50' :
                                    insight.priority === 'medium' ? 'border-yellow-300 text-yellow-700 bg-yellow-50' :
                                    'border-blue-300 text-blue-700 bg-blue-50'
                                  }`}
                                >
                                  {insight.priority.toUpperCase()}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-700 leading-relaxed">{insight.message}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="p-4 bg-slate-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <BarChart3 className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">No Comparison Data Available</h3>
            <p className="text-slate-600 max-w-md mx-auto">
              {data?.message || "We couldn't find enough data to generate a meaningful comparison. Try selecting a different month or ensure you have earnings data recorded."}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};