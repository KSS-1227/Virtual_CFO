import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ComparisonChart } from './comparison-chart';
import { TrendingUp, TrendingDown, AlertTriangle, Target, Zap } from 'lucide-react';

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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Month Comparison Analysis
          </DialogTitle>
          <DialogDescription>
            Compare your business performance between months with detailed insights and trends.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-20 bg-gray-100 rounded"></div>
              </div>
            ))}
          </div>
        ) : data && !data.fallback ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Revenue Change</div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">
                    {formatCurrency(data.changes?.revenue?.absolute || 0)}
                  </span>
                  <Badge variant={(data.changes?.revenue?.percentage || 0) >= 0 ? "default" : "destructive"}>
                    {(data.changes?.revenue?.percentage || 0) >= 0 ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {formatPercentage(data.changes?.revenue?.percentage || 0)}
                  </Badge>
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Profit Change</div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">
                    {formatCurrency(data.changes?.profit?.absolute || 0)}
                  </span>
                  <Badge variant={(data.changes?.profit?.percentage || 0) >= 0 ? "default" : "destructive"}>
                    {(data.changes?.profit?.percentage || 0) >= 0 ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {formatPercentage(data.changes?.profit?.percentage || 0)}
                  </Badge>
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Margin Change</div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">
                    {(data.changes?.profit_margin?.absolute || 0).toFixed(1)}pp
                  </span>
                  <Badge variant={(data.changes?.profit_margin?.absolute || 0) >= 0 ? "default" : "destructive"}>
                    {(data.changes?.profit_margin?.absolute || 0) >= 0 ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {formatPercentage(data.changes?.profit_margin?.percentage || 0)}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Comparison Chart */}
            <div className="border rounded-lg p-4">
              <ComparisonChart data={data} loading={false} />
            </div>

            {/* Detailed Metrics */}
            {data.current && data.previous && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg">Current Month ({data.current.month_name || 'Current'})</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Revenue:</span>
                      <span className="font-medium">{formatCurrency(data.current.revenue || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Expenses:</span>
                      <span className="font-medium">{formatCurrency(data.current.expenses || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Profit:</span>
                      <span className="font-medium">{formatCurrency(data.current.profit || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Profit Margin:</span>
                      <span className="font-medium">{(data.current.profit_margin || 0).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Days Recorded:</span>
                      <span className="font-medium">{data.current.days_recorded || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-lg">Previous Month ({data.previous.month_name || 'Previous'})</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Revenue:</span>
                      <span className="font-medium">{formatCurrency(data.previous.revenue || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Expenses:</span>
                      <span className="font-medium">{formatCurrency(data.previous.expenses || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Profit:</span>
                      <span className="font-medium">{formatCurrency(data.previous.profit || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Profit Margin:</span>
                      <span className="font-medium">{(data.previous.profit_margin || 0).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Days Recorded:</span>
                      <span className="font-medium">{data.previous.days_recorded || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Insights */}
            {data.insights && data.insights.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-semibold text-lg">Key Insights</h4>
                <div className="space-y-3">
                  {data.insights.map((insight: any, index: number) => {
                    const IconComponent = getInsightIcon(insight.type);
                    return (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border ${getInsightColor(insight.type)}`}
                      >
                        <div className="flex items-start gap-3">
                          <IconComponent className="h-5 w-5 mt-0.5 flex-shrink-0" />
                          <div>
                            <h5 className="font-medium">{insight.title}</h5>
                            <p className="text-sm mt-1">{insight.message}</p>
                          </div>
                          <Badge variant="outline" className="ml-auto">
                            {insight.priority.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">
              {data?.message || "No comparison data available"}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};