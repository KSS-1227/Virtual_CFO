import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function OnboardingProvider() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [phone, setPhone] = useState('');
  const [dailySales, setDailySales] = useState(0);
  const [dailyCosts, setDailyCosts] = useState(0);
  const [aiInsights, setAiInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const profit = dailySales - dailyCosts;
  const profitMargin = dailySales > 0 ? ((profit / dailySales) * 100) : 0;

  const generateAIInsights = async () => {
    if (!businessName || !businessType || dailySales <= 0) return;
    
    setLoadingInsights(true);
    try {
      const response = await fetch('http://localhost:5001/api/ai/business-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          businessType,
          dailySales,
          dailyCosts,
          profit,
          profitMargin
        })
      });
      
      const data = await response.json();
      setAiInsights(data.insights);
    } catch (error) {
      console.error('Error generating AI insights:', error);
      // Fallback to static insights
      setAiInsights({
        recommendations: [
          { name: 'Digital Marketing Package', impact: '+25% sales', reason: 'Increase online visibility' },
          { name: 'Cost Optimization Tool', impact: '-15% costs', reason: 'Reduce operational expenses' },
          { name: 'Customer Retention Program', impact: '+18% retention', reason: 'Build customer loyalty' }
        ],
        projectedIncrease: Math.round(profit * 30 * 0.3)
      });
    } finally {
      setLoadingInsights(false);
    }
  };

  useEffect(() => {
    if (step === 3 && !aiInsights) {
      generateAIInsights();
    }
  }, [step]);

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      // Save data and navigate
      console.log('Onboarding completed:', {
        businessName,
        businessType,
        phone,
        dailySales,
        dailyCosts,
        profit,
        profitMargin,
        aiInsights
      });
      navigate('/');
    }
  };

  const handlePrevious = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Tell us about your business</h2>
              <p className="text-gray-600 mt-2">We'll personalize your experience</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Business Name *</Label>
                <Input
                  id="name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g., Sharma Electronics"
                />
              </div>
              
              <div>
                <Label htmlFor="type">Business Type *</Label>
                <Input
                  id="type"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  placeholder="e.g., Electronics, Restaurant"
                />
              </div>
              
              <div>
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                />
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Your first earnings entry</h2>
              <p className="text-gray-600 mt-2">Let's track your business performance</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label>Daily Sales *</Label>
                <Input
                  type="number"
                  value={dailySales || ''}
                  onChange={(e) => setDailySales(Number(e.target.value) || 0)}
                  placeholder="25000"
                />
              </div>
              
              <div>
                <Label>Daily Costs *</Label>
                <Input
                  type="number"
                  value={dailyCosts || ''}
                  onChange={(e) => setDailyCosts(Number(e.target.value) || 0)}
                  placeholder="18000"
                />
              </div>
              
              {dailySales > 0 && (
                <div className={`p-4 rounded-lg ${
                  profit > 0 ? 'bg-green-50' : 'bg-red-50'
                }`}>
                  <p className={profit > 0 ? 'text-green-800' : 'text-red-800'}>
                    Profit: ₹{profit.toLocaleString()} | Margin: {profitMargin.toFixed(1)}%
                  </p>
                  {profit <= 0 && (
                    <p className="text-red-600 text-sm mt-1">
                      ⚠️ Your costs are higher than sales. Consider reducing expenses.
                    </p>
                  )}
                  {profit > 0 && profitMargin >= 20 && (
                    <p className="text-green-600 text-sm mt-1">
                      🎉 Excellent profit margin! You're doing great.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">AI-Powered Insights</h2>
              <p className="text-gray-600 mt-2">Personalized recommendations for {businessName}</p>
            </div>
            
            {loadingInsights ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">AI is analyzing your business data...</p>
              </div>
            ) : aiInsights ? (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold">Recommended for {businessType} business:</h3>
                  <ul className="mt-2 space-y-2">
                    {aiInsights.recommendations?.map((rec, index) => (
                      <li key={index} className="flex justify-between items-center">
                        <span>• {rec.name}</span>
                        <span className="text-blue-600 font-medium">{rec.impact}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-green-800 font-semibold">
                    Projected monthly profit increase: ₹{(aiInsights.projectedIncrease || Math.round(profit * 30 * 0.3)).toLocaleString()}
                  </p>
                  <p className="text-green-600 text-sm mt-1">
                    Based on your {businessType} business with ₹{profit.toLocaleString()} daily profit
                  </p>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-yellow-800 mb-2">Key Insights:</h4>
                  <p className="text-yellow-700 text-sm">
                    {aiInsights.keyInsight || `Your ${businessType} business shows ${profitMargin.toFixed(1)}% profit margin. Focus on customer retention and cost optimization for maximum growth.`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600">Unable to generate insights. Please try again.</p>
                <Button onClick={generateAIInsights} className="mt-4">
                  Retry AI Analysis
                </Button>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-gray-600">Step {step} of 3</span>
            <span className="text-sm text-gray-600">{Math.round((step / 3) * 100)}% Complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle>VirtualCFO Setup</CardTitle>
          </CardHeader>
          <CardContent>
            {renderStep()}
            
            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-6 border-t">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={step === 1}
              >
                Previous
              </Button>
              
              <Button
                onClick={handleNext}
                disabled={
                  (step === 1 && (!businessName || !businessType || !phone)) ||
                  (step === 2 && (dailySales <= 0 || dailyCosts < 0))
                }
              >
                {step === 3 ? 'Complete Setup' : 'Continue'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}