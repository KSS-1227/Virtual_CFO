import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ComparisonData {
  current: {
    month_name: string;
    revenue: number;
    expenses: number;
    profit: number;
    profit_margin: number;
  };
  previous: {
    month_name: string;
    revenue: number;
    expenses: number;
    profit: number;
    profit_margin: number;
  };
  changes: {
    revenue: { percentage: number; absolute: number };
    expenses: { percentage: number; absolute: number };
    profit: { percentage: number; absolute: number };
  };
}

interface ComparisonChartProps {
  data: ComparisonData;
  loading?: boolean;
}

export const ComparisonChart: React.FC<ComparisonChartProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading comparison...</div>
      </div>
    );
  }

  const chartData = [
    {
      name: 'Revenue',
      current: data.current.revenue,
      previous: data.previous.revenue,
      change: data.changes.revenue.percentage,
    },
    {
      name: 'Expenses',
      current: data.current.expenses,
      previous: data.previous.expenses,
      change: data.changes.expenses.percentage,
    },
    {
      name: 'Profit',
      current: data.current.profit,
      previous: data.previous.profit,
      change: data.changes.profit.percentage,
    },
  ];

  const formatCurrency = (value: number) => `₹${(value / 1000).toFixed(0)}K`;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const current = payload[0].value;
      const previous = payload[1].value;
      const change = payload[0].payload.change;
      
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-blue-600">Current: {formatCurrency(current)}</p>
          <p className="text-gray-600">Previous: {formatCurrency(previous)}</p>
          <p className={`flex items-center gap-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(change).toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Month Comparison</h3>
        <div className="text-sm text-gray-600">
          {data.previous.month_name} vs {data.current.month_name}
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis tickFormatter={formatCurrency} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="previous" fill="#e5e7eb" name="Previous Month" />
          <Bar dataKey="current" fill="#3b82f6" name="Current Month" />
        </BarChart>
      </ResponsiveContainer>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mt-4">
        {chartData.map((item) => (
          <div key={item.name} className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">{item.name}</div>
            <div className={`flex items-center justify-center gap-1 ${
              item.change >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {item.change > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : item.change < 0 ? (
                <TrendingDown className="h-3 w-3" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              <span className="text-sm font-medium">
                {Math.abs(item.change).toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};