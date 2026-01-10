import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingUp, TrendingDown, AlertTriangle, Package, 
  BarChart3, PieChart, Calendar, RefreshCw 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AnalyticsData {
  inventory_summary: {
    total_items: number;
    total_value: number;
    low_stock_items: number;
    fast_moving: number;
    slow_moving: number;
  };
  reorder_recommendations: Array<{
    product_name: string;
    current_stock: number;
    recommended_order: number;
    urgency: string;
    reason: string;
  }>;
  seasonal_insights: Array<{
    product_name: string;
    current_demand: number;
    predicted_demand: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  performance_metrics: {
    turnover_rate: number;
    stock_accuracy: number;
    avg_days_to_reorder: number;
  };
}

export const AdvancedAnalyticsDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { toast } = useToast();

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/inventory/analytics/advanced', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      
      const result = await response.json();
      if (result.success) {
        setAnalytics(result.data);
        setLastUpdated(new Date());
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Analytics fetch error:', error);
      toast({
        title: "Analytics Error",
        description: "Failed to load analytics data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchAnalytics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <div className="h-4 w-4 bg-gray-400 rounded-full" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Inventory Analytics</h2>
          {lastUpdated && (
            <p className="text-sm text-muted-foreground">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button onClick={fetchAnalytics} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold">{analytics.inventory_summary.total_items}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">₹{analytics.inventory_summary.total_value.toLocaleString()}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold text-red-600">{analytics.inventory_summary.low_stock_items}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Turnover Rate</p>
                <p className="text-2xl font-bold">{analytics.performance_metrics.turnover_rate.toFixed(1)}x</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reorder Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Reorder Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.reorder_recommendations.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No immediate reorders needed. Great job managing inventory!
            </p>
          ) : (
            <div className="space-y-3">
              {analytics.reorder_recommendations.slice(0, 5).map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.product_name}</span>
                      <Badge variant={getUrgencyColor(item.urgency)}>
                        {item.urgency}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.reason}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">Current: {item.current_stock}</p>
                    <p className="text-sm font-medium">Order: {item.recommended_order}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seasonal Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Seasonal Demand Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analytics.seasonal_insights.slice(0, 6).map((insight, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  {getTrendIcon(insight.trend)}
                  <span className="font-medium">{insight.product_name}</span>
                </div>
                <div className="text-right text-sm">
                  <p>Current: {insight.current_demand}</p>
                  <p className="text-muted-foreground">Predicted: {insight.predicted_demand}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stock Accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {analytics.performance_metrics.stock_accuracy.toFixed(1)}%
              </div>
              <p className="text-sm text-muted-foreground">System vs Physical</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Avg Reorder Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {analytics.performance_metrics.avg_days_to_reorder.toFixed(0)}
              </div>
              <p className="text-sm text-muted-foreground">Days</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fast vs Slow Moving</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Fast Moving</span>
                <span className="font-medium">{analytics.inventory_summary.fast_moving}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Slow Moving</span>
                <span className="font-medium">{analytics.inventory_summary.slow_moving}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights Alert */}
      <Alert>
        <BarChart3 className="h-4 w-4" />
        <AlertDescription>
          <strong>AI Insight:</strong> Your inventory turnover rate of {analytics.performance_metrics.turnover_rate.toFixed(1)}x 
          is {analytics.performance_metrics.turnover_rate > 4 ? 'excellent' : 'good'}. 
          Consider focusing on the {analytics.inventory_summary.slow_moving} slow-moving items to improve cash flow.
        </AlertDescription>
      </Alert>
    </div>
  );
};