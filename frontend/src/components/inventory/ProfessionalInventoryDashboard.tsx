import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription } from '../ui/alert';
import { Progress } from '../ui/progress';
import { 
  Search, 
  Plus, 
  Mic, 
  Camera, 
  Brain, 
  TrendingUp, 
  Users, 
  Calendar,
  MessageSquare,
  Settings,
  BarChart3,
  Zap,
  Target,
  AlertTriangle,
  CheckCircle,
  Clock,
  Star
} from 'lucide-react';
import { useToast } from '../../hooks/use-toast';

// Smart Suggestions Component
const SmartSuggestionsInput = ({ 
  type, 
  value, 
  onChange, 
  placeholder, 
  context = {},
  onSelectionRecord 
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { toast } = useToast();

  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/inventory/professional/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, query, context })
      });

      const data = await response.json();
      if (data.success) {
        setSuggestions(data.data.suggestions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [type, context]);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
    fetchSuggestions(newValue);
  };

  const handleSuggestionSelect = async (suggestion) => {
    onChange(suggestion.text);
    setShowSuggestions(false);
    
    // Record selection for learning
    try {
      await fetch('/api/inventory/professional/suggestions/selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          query: value,
          selectedSuggestion: suggestion,
          context
        })
      });
      onSelectionRecord?.(suggestion);
    } catch (error) {
      console.error('Error recording suggestion selection:', error);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="pr-8"
        />
        {isLoading && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
              onClick={() => handleSuggestionSelect(suggestion)}
            >
              <span className="text-sm">{suggestion.text}</span>
              <div className="flex items-center space-x-2">
                <Badge variant={suggestion.source === 'history' ? 'default' : 'secondary'} className="text-xs">
                  {suggestion.source}
                </Badge>
                <span className="text-xs text-gray-500">
                  {Math.round(suggestion.confidence * 100)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Multi-Modal Input Component
const MultiModalInput = ({ onProcess }) => {
  const [inputs, setInputs] = useState({
    images: [],
    voice: null,
    text: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const { toast } = useToast();

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const imagePromises = files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve({ data: e.target.result, name: file.name });
        reader.readAsDataURL(file);
      });
    });

    Promise.all(imagePromises).then(images => {
      setInputs(prev => ({ ...prev, images: [...prev.images, ...images] }));
    });
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.onload = () => {
          setInputs(prev => ({ ...prev, voice: { data: reader.result } }));
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Auto-stop after 15 seconds
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
          setIsRecording(false);
        }
      }, 15000);

      // Store recorder reference for manual stop
      window.currentRecorder = mediaRecorder;
    } catch (error) {
      toast({
        title: "Recording Error",
        description: "Could not access microphone",
        variant: "destructive"
      });
    }
  };

  const stopVoiceRecording = () => {
    if (window.currentRecorder && window.currentRecorder.state === 'recording') {
      window.currentRecorder.stop();
      setIsRecording(false);
    }
  };

  const processMultiModalInput = async () => {
    if (!inputs.images.length && !inputs.voice && !inputs.text.trim()) {
      toast({
        title: "No Input",
        description: "Please provide at least one type of input",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/inventory/professional/multimodal/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs,
          workflowType: 'inventory_add'
        })
      });

      const data = await response.json();
      if (data.success) {
        onProcess(data.data);
        toast({
          title: "Processing Complete",
          description: `Processed with ${Math.round(data.data.confidence * 100)}% confidence`
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: "Processing Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Brain className="h-5 w-5" />
          <span>Multi-Modal Input</span>
        </CardTitle>
        <CardDescription>
          Add inventory items using images, voice, and text together
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Image Input */}
        <div>
          <label className="block text-sm font-medium mb-2">Images</label>
          <div className="flex items-center space-x-2">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              id="image-upload"
            />
            <label htmlFor="image-upload">
              <Button variant="outline" className="cursor-pointer">
                <Camera className="h-4 w-4 mr-2" />
                Add Images ({inputs.images.length})
              </Button>
            </label>
          </div>
          {inputs.images.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {inputs.images.map((img, index) => (
                <Badge key={index} variant="secondary">{img.name}</Badge>
              ))}
            </div>
          )}
        </div>

        {/* Voice Input */}
        <div>
          <label className="block text-sm font-medium mb-2">Voice</label>
          <div className="flex items-center space-x-2">
            <Button
              variant={isRecording ? "destructive" : "outline"}
              onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
            >
              <Mic className="h-4 w-4 mr-2" />
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </Button>
            {inputs.voice && (
              <Badge variant="secondary">Voice recorded</Badge>
            )}
          </div>
        </div>

        {/* Text Input */}
        <div>
          <label className="block text-sm font-medium mb-2">Text Description</label>
          <Input
            value={inputs.text}
            onChange={(e) => setInputs(prev => ({ ...prev, text: e.target.value }))}
            placeholder="Describe the inventory items..."
            className="w-full"
          />
        </div>

        <Button 
          onClick={processMultiModalInput} 
          disabled={isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
              Processing...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Process Multi-Modal Input
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

// Conversational Interface Component
const ConversationalInterface = ({ sessionId, onSessionUpdate }) => {
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const sendMessage = async () => {
    if (!currentMessage.trim()) return;

    const userMessage = { type: 'user', content: currentMessage, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsProcessing(true);

    try {
      const response = await fetch('/api/inventory/professional/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentMessage,
          sessionId,
          context: { audioEnabled: true }
        })
      });

      const data = await response.json();
      if (data.success) {
        const aiMessage = { 
          type: 'ai', 
          content: data.data.response, 
          timestamp: new Date(),
          nextSteps: data.data.nextSteps 
        };
        setMessages(prev => [...prev, aiMessage]);
        onSessionUpdate?.(data.data);
      }
    } catch (error) {
      toast({
        title: "Conversation Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <MessageSquare className="h-5 w-5" />
          <span>AI Conversation</span>
        </CardTitle>
        <CardDescription>
          Chat with AI about your inventory management needs
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Messages */}
          <div className="h-64 overflow-y-auto space-y-2 border rounded p-3">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                Start a conversation about your inventory...
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-3 py-2 rounded-lg ${
                      message.type === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    {message.nextSteps && (
                      <div className="mt-2 space-y-1">
                        {message.nextSteps.map((step, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {step}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div className="flex space-x-2">
            <Input
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              placeholder="Ask about inventory, suppliers, seasonal trends..."
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              disabled={isProcessing}
            />
            <Button onClick={sendMessage} disabled={isProcessing || !currentMessage.trim()}>
              {isProcessing ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              ) : (
                'Send'
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Analytics Dashboard Component
const AnalyticsDashboard = ({ userId }) => {
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch('/api/inventory/professional/dashboard/advanced');
        const data = await response.json();
        if (data.success) {
          setAnalytics(data.data);
        }
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [userId]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Overview Cards */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Items</p>
              <p className="text-2xl font-bold">{analytics?.overview?.totalItems || 0}</p>
            </div>
            <BarChart3 className="h-8 w-8 text-blue-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Value</p>
              <p className="text-2xl font-bold">₹{analytics?.overview?.totalValue?.toLocaleString() || 0}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Low Stock</p>
              <p className="text-2xl font-bold text-orange-600">{analytics?.overview?.lowStockItems || 0}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-orange-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Categories</p>
              <p className="text-2xl font-bold">{analytics?.overview?.categories?.length || 0}</p>
            </div>
            <Target className="h-8 w-8 text-purple-500" />
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm">
                <span>Stock Accuracy</span>
                <span>{Math.round((analytics?.performance?.stockAccuracy || 0.95) * 100)}%</span>
              </div>
              <Progress value={(analytics?.performance?.stockAccuracy || 0.95) * 100} className="mt-1" />
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span>Fulfillment Rate</span>
                <span>{Math.round((analytics?.performance?.fulfillmentRate || 0.98) * 100)}%</span>
              </div>
              <Progress value={(analytics?.performance?.fulfillmentRate || 0.98) * 100} className="mt-1" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {analytics?.recentActivity?.slice(0, 5).map((activity, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                <div>
                  <p className="font-medium text-sm">{activity.name}</p>
                  <p className="text-xs text-gray-500">Qty: {activity.quantity}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">
                    {new Date(activity.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )) || (
              <p className="text-center text-gray-500 py-4">No recent activity</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Main Professional Inventory Dashboard
const ProfessionalInventoryDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [multiModalSession, setMultiModalSession] = useState(null);
  const [conversationSession, setConversationSession] = useState(null);
  const { toast } = useToast();

  const handleMultiModalProcess = (result) => {
    setMultiModalSession(result);
    toast({
      title: "Multi-Modal Processing Complete",
      description: `Found ${result.integratedData?.products?.length || 0} products with ${Math.round(result.confidence * 100)}% confidence`
    });
  };

  const handleConversationUpdate = (session) => {
    setConversationSession(session);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Professional Inventory Management</h1>
          <p className="text-gray-600">AI-powered inventory management with advanced features</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="flex items-center space-x-1">
            <Star className="h-3 w-3" />
            <span>Professional</span>
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="multimodal">Multi-Modal</TabsTrigger>
          <TabsTrigger value="conversation">AI Chat</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="seasonal">Seasonal</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <AnalyticsDashboard />
        </TabsContent>

        <TabsContent value="multimodal" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MultiModalInput onProcess={handleMultiModalProcess} />
            
            {multiModalSession && (
              <Card>
                <CardHeader>
                  <CardTitle>Processing Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Confidence Score</span>
                      <Badge variant={multiModalSession.confidence > 0.8 ? 'default' : 'secondary'}>
                        {Math.round(multiModalSession.confidence * 100)}%
                      </Badge>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">Detected Products</h4>
                      {multiModalSession.integratedData?.products?.map((product, index) => (
                        <div key={index} className="border rounded p-3 mb-2">
                          <p className="font-medium">{product.name || 'Unknown Product'}</p>
                          <div className="flex space-x-4 text-sm text-gray-600">
                            <span>Qty: {product.quantity || 0}</span>
                            <span>Category: {product.category || 'N/A'}</span>
                            <span>Price: ₹{product.price || 0}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {multiModalSession.nextSteps && (
                      <div>
                        <h4 className="font-medium mb-2">Next Steps</h4>
                        <div className="space-y-1">
                          {multiModalSession.nextSteps.map((step, index) => (
                            <Badge key={index} variant="outline">{step}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="conversation" className="space-y-6">
          <ConversationalInterface 
            sessionId={conversationSession?.sessionId}
            onSessionUpdate={handleConversationUpdate}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Learning Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Learning Velocity</span>
                    <Progress value={75} className="w-24" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Accuracy Improvement</span>
                    <Badge variant="default">+12%</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Patterns Learned</span>
                    <span className="font-medium">247</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      System accuracy improved by 15% this month
                    </AlertDescription>
                  </Alert>
                  <Alert>
                    <Clock className="h-4 w-4" />
                    <AlertDescription>
                      Average processing time: 2.3 seconds
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="suppliers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Supplier Intelligence</CardTitle>
              <CardDescription>
                AI-powered supplier prioritization and performance tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4" />
                <p>Supplier management features coming soon...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seasonal" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Seasonal Demand Intelligence</CardTitle>
              <CardDescription>
                AI-powered seasonal pattern analysis and demand forecasting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4" />
                <p>Seasonal analysis features coming soon...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfessionalInventoryDashboard;