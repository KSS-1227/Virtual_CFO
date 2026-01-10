import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { marketAnalysisAPI } from '@/services/marketAnalysisAPI';
import { 
  TrendingUp, 
  BarChart3, 
  Brain, 
  Target, 
  AlertTriangle,
  Lightbulb,
  Activity
} from 'lucide-react';

const MarketAnalysisAgent = () => {
  const [loading, setLoading] = useState(false);
  const [marketAnalysis, setMarketAnalysis] = useState(null);
  const [scenarioAnalysis, setScenarioAnalysis] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [scenarios, setScenarios] = useState(['']);
  const [analysisContext, setAnalysisContext] = useState('');

  const addScenario = () => {
    setScenarios([...scenarios, '']);
  };

  const updateScenario = (index, value) => {
    const newScenarios = [...scenarios];
    newScenarios[index] = value;
    setScenarios(newScenarios);
  };

  const removeScenario = (index) => {
    if (scenarios.length > 1) {
      setScenarios(scenarios.filter((_, i) => i !== index));
    }
  };

  const analyzeMarketTrends = async () => {
    setLoading(true);
    try {
      const data = await marketAnalysisAPI.analyzeMarketTrends('6_months');
      if (data.success) {
        setMarketAnalysis(data.data);
      }
    } catch (error) {
      console.error('Market analysis error:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeScenarios = async () => {
    const validScenarios = scenarios.filter(s => s.trim().length > 0);
    if (validScenarios.length === 0) return;

    setLoading(true);
    try {
      const data = await marketAnalysisAPI.analyzeScenarios(validScenarios, { additional_info: analysisContext });
      if (data.success) {
        setScenarioAnalysis(data.data);
      }
    } catch (error) {
      console.error('Scenario analysis error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPredictiveInsights = async () => {
    setLoading(true);
    try {
      const data = await marketAnalysisAPI.getPredictiveInsights('revenue', '3_months');
      if (data.success) {
        setPredictions(data.data);
      }
    } catch (error) {
      console.error('Predictions error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
          <Brain className="h-8 w-8 text-blue-600" />
          AI Market Analysis Agent
        </h1>
        <p className="text-gray-600">
          Analyze market trends, predict future opportunities, and evaluate business scenarios
        </p>
      </div>

      <Tabs defaultValue="trends" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="trends" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Market Trends
          </TabsTrigger>
          <TabsTrigger value="scenarios" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Scenario Analysis
          </TabsTrigger>
          <TabsTrigger value="predictions" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Predictions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Market Trend Analysis
              </CardTitle>
              <CardDescription>
                Analyze current market conditions and future trends for your business sector
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={analyzeMarketTrends} 
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Analyzing Market Trends...' : 'Analyze Market Trends'}
              </Button>

              {marketAnalysis && (
                <Card className="mt-6 border-l-4 border-blue-500">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      Market Analysis Results
                      <Badge variant={marketAnalysis.confidence_level > 0.7 ? 'default' : 'secondary'}>
                        {(marketAnalysis.confidence_level * 100).toFixed(0)}% Confidence
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Executive Summary */}
                    <Alert className="bg-blue-50 border-blue-200">
                      <AlertTriangle className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-900 font-medium">
                        {marketAnalysis.executive_summary}
                      </AlertDescription>
                    </Alert>

                    {/* Key Metrics */}
                    {marketAnalysis.key_metrics && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(marketAnalysis.key_metrics).map(([key, value]) => (
                          <Card key={key} className="bg-gradient-to-br from-slate-50 to-slate-100">
                            <CardContent className="p-4">
                              <p className="text-xs text-gray-600 font-semibold capitalize">{key.replace(/_/g, ' ')}</p>
                              <p className="text-lg font-bold text-gray-900 mt-1">{value}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}

                    {/* Market Position */}
                    {marketAnalysis.market_position && (
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm">Market Position</h4>
                        <div className="grid md:grid-cols-3 gap-3">
                          <div className="bg-green-50 p-3 rounded border-l-4 border-green-500">
                            <p className="text-xs text-green-700 font-semibold">STRENGTH</p>
                            <p className="text-sm text-gray-800 mt-1">{marketAnalysis.market_position.strength}</p>
                          </div>
                          <div className="bg-red-50 p-3 rounded border-l-4 border-red-500">
                            <p className="text-xs text-red-700 font-semibold">WEAKNESS</p>
                            <p className="text-sm text-gray-800 mt-1">{marketAnalysis.market_position.weakness}</p>
                          </div>
                          <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-500">
                            <p className="text-xs text-blue-700 font-semibold">INDUSTRY CONTEXT</p>
                            <p className="text-sm text-gray-800 mt-1">{marketAnalysis.market_position.industry_context}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Opportunities */}
                    {marketAnalysis.opportunities && marketAnalysis.opportunities.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <Lightbulb className="h-4 w-4 text-yellow-600" />
                          Opportunities ({marketAnalysis.opportunities.length})
                        </h4>
                        {marketAnalysis.opportunities.map((opp, idx) => (
                          <Card key={idx} className="bg-green-50 border-green-200">
                            <CardContent className="p-4 space-y-2">
                              <p className="font-semibold text-green-900">{opp.title}</p>
                              <p className="text-sm text-gray-700">{opp.description}</p>
                              <div className="flex gap-2 flex-wrap">
                                <Badge variant="outline" className="bg-green-100">{opp.potential_revenue_impact}</Badge>
                                <Badge variant="outline">{opp.timeline}</Badge>
                                <Badge variant="secondary" className="text-xs">{opp.effort_level}</Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}

                    {/* Threats */}
                    {marketAnalysis.threats && marketAnalysis.threats.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          Threats ({marketAnalysis.threats.length})
                        </h4>
                        {marketAnalysis.threats.map((threat, idx) => (
                          <Card key={idx} className="bg-red-50 border-red-200">
                            <CardContent className="p-4 space-y-2">
                              <p className="font-semibold text-red-900">{threat.title}</p>
                              <div className="flex gap-2 mb-2">
                                <Badge className="bg-red-600">{threat.probability}</Badge>
                                <Badge variant="outline" className="text-red-700">{threat.potential_impact}</Badge>
                              </div>
                              <p className="text-sm text-gray-700"><strong>Mitigation:</strong> {threat.mitigation_strategy}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}

                    {/* Recommendations */}
                    {marketAnalysis.recommendations && marketAnalysis.recommendations.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm">Top Recommendations</h4>
                        {marketAnalysis.recommendations.slice(0, 5).map((rec, idx) => (
                          <Card key={idx} className={`border-l-4 ${
                            rec.priority === 'CRITICAL' ? 'border-red-500 bg-red-50' :
                            rec.priority === 'HIGH' ? 'border-orange-500 bg-orange-50' :
                            rec.priority === 'MEDIUM' ? 'border-yellow-500 bg-yellow-50' :
                            'border-green-500 bg-green-50'
                          }`}>
                            <CardContent className="p-4 space-y-2">
                              <div className="flex items-start justify-between">
                                <p className="font-semibold text-sm">{rec.action}</p>
                                <Badge className={rec.priority === 'CRITICAL' ? 'bg-red-600' : 'bg-orange-600'}>
                                  {rec.priority}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-700">{rec.why_important}</p>
                              <div className="flex gap-2 flex-wrap">
                                <Badge variant="outline">{rec.timeframe}</Badge>
                                <Badge variant="outline">{rec.expected_monthly_benefit}</Badge>
                              </div>
                              {rec.resources_needed && (
                                <p className="text-xs text-gray-600"><strong>Needs:</strong> {rec.resources_needed}</p>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}

                    {/* Data Quality */}
                    {marketAnalysis.data_quality && (
                      <Alert className="bg-gray-50 border-gray-200">
                        <AlertDescription className="text-gray-700 text-sm">
                          <strong>Data Quality:</strong> {marketAnalysis.data_quality}
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scenarios" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Business Scenario Analysis
              </CardTitle>
              <CardDescription>
                Analyze various business scenarios and their potential impacts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Business Scenarios</label>
                {scenarios.map((scenario, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <Input
                      placeholder={`Scenario ${index + 1}: e.g., "Inventory is running low", "Major expense coming up", "New competitor entered market"`}
                      value={scenario}
                      onChange={(e) => updateScenario(index, e.target.value)}
                      className="flex-1"
                    />
                    {scenarios.length > 1 && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => removeScenario(index)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" onClick={addScenario} className="w-full">
                  Add Another Scenario
                </Button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Additional Context (Optional)</label>
                <Textarea
                  placeholder="Provide any additional context about your business situation, recent changes, or specific concerns..."
                  value={analysisContext}
                  onChange={(e) => setAnalysisContext(e.target.value)}
                  rows={3}
                />
              </div>
              
              <Button 
                onClick={analyzeScenarios} 
                disabled={loading || scenarios.every(s => s.trim().length === 0)}
                className="w-full"
              >
                {loading ? 'Analyzing Scenarios...' : 'Analyze Scenarios'}
              </Button>

              {scenarioAnalysis && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="text-lg">Scenario Analysis Results</CardTitle>
                    <div className="flex gap-2">
                      <Badge variant="outline">{scenarioAnalysis.scenarios_analyzed} scenarios analyzed</Badge>
                      <Badge variant="outline">{scenarioAnalysis.business_context.business_type}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="prose max-w-none">
                      <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg">
                        {scenarioAnalysis.scenario_analysis}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predictions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Predictive Market Insights
              </CardTitle>
              <CardDescription>
                AI-powered predictions based on your historical data and market trends
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={getPredictiveInsights} 
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Generating Predictions...' : 'Generate Predictive Insights'}
              </Button>

              {predictions && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Lightbulb className="h-5 w-5" />
                        Prediction Results
                      </CardTitle>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="outline">{predictions.prediction_type}</Badge>
                        <Badge variant="outline">{predictions.time_horizon}</Badge>
                        <Badge 
                          variant={predictions.data_quality.confidence_level === 'high' ? 'default' : 
                                 predictions.data_quality.confidence_level === 'medium' ? 'secondary' : 'destructive'}
                        >
                          {predictions.data_quality.confidence_level} confidence
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="prose max-w-none">
                        <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg">
                          {predictions.predictions}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Data Quality Assessment</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="font-medium">Data Points</p>
                          <p className="text-gray-600">{predictions.data_quality.total_data_points}</p>
                        </div>
                        <div>
                          <p className="font-medium">Months of Data</p>
                          <p className="text-gray-600">{predictions.data_quality.months_of_data}</p>
                        </div>
                        <div>
                          <p className="font-medium">Confidence Level</p>
                          <p className="text-gray-600 capitalize">{predictions.data_quality.confidence_level}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Note:</strong> AI predictions are based on historical data and market analysis. 
          Always consider multiple factors and consult with financial advisors for major business decisions.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default MarketAnalysisAgent;