import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { productsAPI, handleAPIError } from "@/lib/api";
import { 
  Star, 
  TrendingUp, 
  Clock, 
  DollarSign, 
  Eye, 
  ThumbsUp, 
  ThumbsDown,
  ExternalLink,
  Zap,
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductRecommendation {
  id: string;
  compatibility_score: number;
  business_impact_score: number;
  analysis_summary: string;
  potential_benefits: string[];
  implementation_challenges: string[];
  estimated_roi_months: number;
  estimated_monthly_impact: number;
  recommendation_type: 'highly_recommended' | 'recommended' | 'suggested' | 'not_recommended';
  priority_level: number;
  is_viewed: boolean;
  is_interested: boolean;
  products: {
    id: string;
    name: string;
    description: string;
    category: string;
    price: number;
    pricing_model: string;
    currency: string;
    key_benefits: string[];
    vendor_name: string;
    image_url?: string;
  };
}

export function ProductRecommendations() {
  const [recommendations, setRecommendations] = useState<ProductRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [userContext, setUserContext] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      const response = await productsAPI.getRecommendations();
      setRecommendations(response.data.recommendations || []);
      setUserContext(response.data.user_context);
    } catch (error) {
      console.error('Error loading recommendations:', error);
      toast({
        title: "Error Loading Recommendations",
        description: handleAPIError(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInteraction = async (recommendationId: string, interaction: {
    is_viewed?: boolean;
    is_interested?: boolean;
  }) => {
    try {
      await productsAPI.updateRecommendationInteraction(recommendationId, interaction);
      
      // Update local state
      setRecommendations(prev => 
        prev.map(rec => 
          rec.id === recommendationId 
            ? { ...rec, ...interaction }
            : rec
        )
      );
    } catch (error) {
      console.error('Error updating interaction:', error);
    }
  };

  const getRecommendationColor = (type: string) => {
    switch (type) {
      case 'highly_recommended': return 'bg-green-500';
      case 'recommended': return 'bg-blue-500';
      case 'suggested': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'highly_recommended': return CheckCircle;
      case 'recommended': return Star;
      case 'suggested': return Zap;
      default: return AlertTriangle;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Product Recommendations</CardTitle>
          <CardDescription>AI-powered suggestions for your business</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2 text-muted-foreground">Analyzing recommendations...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!recommendations.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Product Recommendations</CardTitle>
          <CardDescription>AI-powered suggestions for your business</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Recommendations Available</h3>
            <p className="text-muted-foreground mb-4">
              Complete your business profile to get personalized product recommendations.
            </p>
            <Button variant="outline">Complete Profile</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Product Recommendations
          </CardTitle>
          <CardDescription>
            AI-analyzed products and services tailored for your {userContext?.business_type} business
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4">
        {recommendations.map((rec) => {
          const RecommendationIcon = getRecommendationIcon(rec.recommendation_type);
          
          return (
            <Card 
              key={rec.id} 
              className={cn(
                "transition-all duration-200 hover:shadow-md",
                !rec.is_viewed && "border-l-4 border-l-primary"
              )}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{rec.products.name}</h3>
                      <Badge 
                        variant="outline" 
                        className={cn("text-white", getRecommendationColor(rec.recommendation_type))}
                      >
                        <RecommendationIcon className="h-3 w-3 mr-1" />
                        {rec.recommendation_type.replace('_', ' ')}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-3">
                      {rec.products.description}
                    </p>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        {formatCurrency(rec.products.price)} 
                        {rec.products.pricing_model !== 'one_time' && `/${rec.products.pricing_model}`}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {rec.estimated_roi_months} months ROI
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" />
                        {formatCurrency(rec.estimated_monthly_impact)}/month impact
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary mb-1">
                      {rec.compatibility_score}%
                    </div>
                    <div className="text-xs text-muted-foreground">Compatibility</div>
                  </div>
                </div>

                {/* AI Analysis Summary */}
                <div className="bg-muted/50 rounded-lg p-4 mb-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    AI Analysis
                  </h4>
                  <p className="text-sm text-muted-foreground">{rec.analysis_summary}</p>
                </div>

                {/* Benefits and Challenges */}
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <h5 className="font-medium text-green-700 mb-2 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      Potential Benefits
                    </h5>
                    <ul className="text-sm space-y-1">
                      {rec.potential_benefits.map((benefit, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-green-500 mt-1">•</span>
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <h5 className="font-medium text-orange-700 mb-2 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      Implementation Challenges
                    </h5>
                    <ul className="text-sm space-y-1">
                      {rec.implementation_challenges.map((challenge, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-orange-500 mt-1">•</span>
                          <span>{challenge}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleInteraction(rec.id, { is_viewed: true })}
                      disabled={rec.is_viewed}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      {rec.is_viewed ? 'Viewed' : 'Mark as Viewed'}
                    </Button>
                    
                    <Button
                      variant={rec.is_interested ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleInteraction(rec.id, { 
                        is_interested: !rec.is_interested,
                        is_viewed: true 
                      })}
                    >
                      {rec.is_interested ? (
                        <>
                          <ThumbsUp className="h-4 w-4 mr-1" />
                          Interested
                        </>
                      ) : (
                        <>
                          <ThumbsUp className="h-4 w-4 mr-1" />
                          Interested?
                        </>
                      )}
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      by {rec.products.vendor_name}
                    </span>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}