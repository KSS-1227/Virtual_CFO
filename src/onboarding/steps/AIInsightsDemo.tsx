import { useState, useEffect } from 'react';
import { Brain, TrendingUp, Target, Zap, Users, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useOnboardingProgress } from '../hooks/useOnboardingProgress';

const demoInsights = {
  electronics: {
    recommendations: [
      { name: 'Digital Marketing Package', impact: '+25% sales', confidence: 92 },
      { name: 'Inventory Management System', impact: '-15% costs', confidence: 88 },
      { name: 'Customer Loyalty Program', impact: '+18% retention', confidence: 85 }
    ],
    projections: { savings: 25000, revenue: 45000 }
  },
  restaurant: {
    recommendations: [
      { name: 'Online Ordering System', impact: '+30% orders', confidence: 94 },
      { name: 'Food Cost Optimizer', impact: '-12% waste', confidence: 89 },
      { name: 'Social Media Marketing', impact: '+22% customers', confidence: 87 }
    ],
    projections: { savings: 18000, revenue: 35000 }
  },
  default: {
    recommendations: [
      { name: 'Business Analytics Tool', impact: '+20% efficiency', confidence: 90 },
      { name: 'Customer Management System', impact: '+15% sales', confidence: 85 },
      { name: 'Cost Optimization Service', impact: '-10% expenses', confidence: 88 }
    ],
    projections: { savings: 20000, revenue: 40000 }
  }
};

export function AIInsightsDemo() {
  const { businessData, earningsData, completeOnboarding } = useOnboardingProgress();
  const [currentDemo, setCurrentDemo] = useState(0);
  const [showProjections, setShowProjections] = useState(false);
  
  const insights = demoInsights[businessData.type as keyof typeof demoInsights] || demoInsights.default;
  const monthlyProfit = (earningsData.dailySales - earningsData.dailyCosts) * 30;

  useEffect(() => {
    const timer = setTimeout(() => setShowProjections(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleComplete = () => {
    completeOnboarding();
    // Navigate to dashboard with celebration
    window.location.href = '/dashboard?onboarded=true';
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
          <Brain className="w-8 h-8 text-purple-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">AI-Powered Business Insights</h2>
        <p className="text-gray-600">
          See how our AI analyzes your business and provides personalized recommendations.
        </p>
      </div>

      {/* Social Proof */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600 mb-1">31%</div>
          <div className="text-sm text-purple-800">
            Average profit increase for shop owners using AI recommendations
          </div>
        </div>
      </div>

      {/* Interactive Demo */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          Personalized Recommendations for {businessData.name}
        </h3>

        <div className="grid gap-4">
          {insights.recommendations.map((rec, index) => (
            <div
              key={index}
              className={`
                border-2 rounded-lg p-4 transition-all duration-500 cursor-pointer
                ${currentDemo >= index ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
              `}
              onClick={() => setCurrentDemo(index)}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">{rec.name}</h4>
                <Badge variant="outline" className="bg-green-100 text-green-800">
                  {rec.impact}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">AI Confidence</span>
                  <span className="font-medium">{rec.confidence}%</span>
                </div>
                <Progress value={rec.confidence} className="h-2" />
              </div>

              {currentDemo >= index && (
                <div className="mt-3 p-3 bg-white rounded border">
                  <div className="text-sm text-gray-700">
                    <strong>Why this helps you:</strong> Based on your {businessData.type} business 
                    with ₹{earningsData.dailySales.toLocaleString()} daily sales, this solution 
                    typically delivers {rec.impact} within 2-3 months.
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Future Projections */}
        {showProjections && (
          <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-green-600" />
              Your 3-Month Projection
            </h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Current Monthly Profit</div>
                  <div className="text-2xl font-bold text-gray-900">
                    ₹{monthlyProfit.toLocaleString()}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-600 mb-1">Projected Monthly Profit</div>
                  <div className="text-2xl font-bold text-green-600">
                    ₹{(monthlyProfit + insights.projections.savings).toLocaleString()}
                  </div>
                  <div className="text-sm text-green-600">
                    +₹{insights.projections.savings.toLocaleString()} increase
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span>Reduced operational costs</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span>Increased customer retention</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Award className="w-4 h-4 text-purple-500" />
                  <span>Optimized inventory management</span>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-white rounded border">
              <div className="text-sm text-gray-700 text-center">
                <strong>What if scenario:</strong> If you reduced costs by just 10%, 
                you'd save an additional ₹{Math.round(monthlyProfit * 0.1).toLocaleString()} per month!
              </div>
            </div>
          </div>
        )}

        {/* Gamification */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center">
              <Award className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="font-medium text-yellow-900">Unlock Advanced Insights</h4>
              <p className="text-sm text-yellow-800">
                Complete 7 days of data entry to unlock detailed competitor analysis 
                and advanced profit optimization strategies.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Completion CTA */}
      <div className="text-center space-y-4">
        <Button
          onClick={handleComplete}
          size="lg"
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3"
        >
          Start My Business Journey 🚀
        </Button>
        
        <p className="text-sm text-gray-500">
          You'll be taken to your personalized dashboard with these insights ready to use.
        </p>
      </div>
    </div>
  );
}