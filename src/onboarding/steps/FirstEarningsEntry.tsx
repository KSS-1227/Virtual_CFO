import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Calculator, Target } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useOnboardingProgress } from '../hooks/useOnboardingProgress';

const businessSuggestions = {
  electronics: { sales: [15000, 50000], costs: [12000, 35000] },
  restaurant: { sales: [8000, 25000], costs: [6000, 18000] },
  clothing: { sales: [10000, 30000], costs: [7000, 20000] },
  grocery: { sales: [20000, 60000], costs: [16000, 45000] },
  medical: { sales: [12000, 40000], costs: [9000, 28000] },
  salon: { sales: [5000, 15000], costs: [3000, 10000] },
  auto: { sales: [15000, 45000], costs: [11000, 32000] },
  services: { sales: [8000, 25000], costs: [5000, 15000] }
};

export function FirstEarningsEntry() {
  const { businessData, earningsData, updateEarningsData } = useOnboardingProgress();
  const [showCelebration, setShowCelebration] = useState(false);
  
  const suggestions = businessSuggestions[businessData.type as keyof typeof businessSuggestions] || 
                     { sales: [10000, 30000], costs: [7000, 20000] };

  const profitMargin = earningsData.dailySales > 0 
    ? ((earningsData.dailySales - earningsData.dailyCosts) / earningsData.dailySales * 100)
    : 0;

  const profit = earningsData.dailySales - earningsData.dailyCosts;

  useEffect(() => {
    updateEarningsData({ profitMargin });
  }, [profitMargin]);

  useEffect(() => {
    if (profit > 0 && !showCelebration) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 3000);
    }
  }, [profit]);

  const handleSalesChange = (value: number[]) => {
    updateEarningsData({ dailySales: value[0] });
  };

  const handleCostsChange = (value: number[]) => {
    updateEarningsData({ dailyCosts: value[0] });
  };

  const getMarginColor = (margin: number) => {
    if (margin >= 25) return 'text-green-600 bg-green-100';
    if (margin >= 15) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getMarginLabel = (margin: number) => {
    if (margin >= 25) return 'Excellent';
    if (margin >= 15) return 'Good';
    return 'Needs Improvement';
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <TrendingUp className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Let's track your first day</h2>
        <p className="text-gray-600">
          Enter yesterday's numbers to see your profit insights instantly.
        </p>
      </div>

      {/* Smart Suggestions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-blue-600" />
          <span className="font-medium text-blue-900">Smart Suggestion</span>
        </div>
        <p className="text-sm text-blue-800">
          Most {businessData.type} shops in your area typically earn ₹{suggestions.sales[0].toLocaleString()} - ₹{suggestions.sales[1].toLocaleString()} daily
        </p>
      </div>

      {/* Form */}
      <div className="space-y-8">
        {/* Daily Sales */}
        <div className="space-y-4">
          <Label className="flex items-center gap-2 text-lg">
            <DollarSign className="w-5 h-5 text-green-600" />
            Daily Sales Revenue *
          </Label>
          
          <div className="space-y-4">
            <Slider
              value={[earningsData.dailySales]}
              onValueChange={handleSalesChange}
              max={100000}
              min={0}
              step={1000}
              className="w-full"
            />
            
            <div className="flex items-center gap-4">
              <Input
                type="number"
                value={earningsData.dailySales || ''}
                onChange={(e) => updateEarningsData({ dailySales: Number(e.target.value) || 0 })}
                placeholder="Enter amount"
                className="text-lg font-medium"
              />
              <div className="text-sm text-gray-500">
                Range: ₹0 - ₹1,00,000
              </div>
            </div>
          </div>

          {/* Quick Suggestions */}
          <div className="flex gap-2 flex-wrap">
            {[suggestions.sales[0], Math.round((suggestions.sales[0] + suggestions.sales[1]) / 2), suggestions.sales[1]].map((amount) => (
              <button
                key={amount}
                onClick={() => updateEarningsData({ dailySales: amount })}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
              >
                ₹{amount.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Daily Costs */}
        <div className="space-y-4">
          <Label className="flex items-center gap-2 text-lg">
            <Calculator className="w-5 h-5 text-red-600" />
            Daily Costs & Expenses *
          </Label>
          
          <div className="space-y-4">
            <Slider
              value={[earningsData.dailyCosts]}
              onValueChange={handleCostsChange}
              max={earningsData.dailySales || 50000}
              min={0}
              step={500}
              className="w-full"
            />
            
            <div className="flex items-center gap-4">
              <Input
                type="number"
                value={earningsData.dailyCosts || ''}
                onChange={(e) => updateEarningsData({ dailyCosts: Number(e.target.value) || 0 })}
                placeholder="Enter amount"
                className="text-lg font-medium"
              />
              <div className="text-sm text-gray-500">
                Max: ₹{(earningsData.dailySales || 50000).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Instant Results */}
        {earningsData.dailySales > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Your Business Snapshot
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  ₹{profit.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Daily Profit</div>
              </div>
              
              <div className="text-center">
                <div className={`text-2xl font-bold ${profitMargin >= 15 ? 'text-green-600' : 'text-red-600'}`}>
                  {profitMargin.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Profit Margin</div>
              </div>
              
              <div className="text-center">
                <Badge className={getMarginColor(profitMargin)}>
                  {getMarginLabel(profitMargin)}
                </Badge>
                <div className="text-sm text-gray-600 mt-1">Performance</div>
              </div>
            </div>

            {showCelebration && (
              <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-lg">
                <div className="text-center">
                  <div className="text-lg">🎉</div>
                  <div className="font-medium text-green-800">
                    Great! Your profit margin is {profitMargin.toFixed(1)}% - 
                    {profitMargin >= 20 ? " that's above average!" : " you're on the right track!"}
                  </div>
                </div>
              </div>
            )}

            {/* Comparison */}
            <div className="mt-4 text-sm text-gray-600 text-center">
              Similar shops in your area average ₹{Math.round((suggestions.sales[0] + suggestions.sales[1]) / 2 * 0.2).toLocaleString()} daily profit
            </div>
          </div>
        )}
      </div>
    </div>
  );
}