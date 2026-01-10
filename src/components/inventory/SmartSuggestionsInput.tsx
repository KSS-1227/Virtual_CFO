import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Search, Clock, Star, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { debounce } from 'lodash';
import { supabase } from '@/integrations/supabase/client';

interface Suggestion {
  text: string;
  confidence: number;
  frequency: number;
  type: 'pattern' | 'alias' | 'inventory' | 'recent' | 'frequent_product' | 'supplier' | 'user_category';
  source?: string;
  reason?: string;
}

interface SmartSuggestionsInputProps {
  type: 'products' | 'categories' | 'suppliers' | 'historical';
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: Suggestion) => void;
  context?: any;
  disabled?: boolean;
  className?: string;
}

export const SmartSuggestionsInput: React.FC<SmartSuggestionsInputProps> = ({
  type,
  placeholder = "Start typing...",
  value,
  onChange,
  onSelect,
  context,
  disabled = false,
  className = ""
}) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Debounced function to fetch suggestions
  const debouncedFetchSuggestions = useCallback(
    debounce(async (query: string) => {
      if (query.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setIsLoading(true);
      
      try {
        // Get auth token from Supabase
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        
        if (!token) {
          console.error('No auth token available');
          setSuggestions([]);
          setShowSuggestions(false);
          return;
        }

        const response = await fetch(`http://localhost:5001/api/inventory/professional/suggestions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            type: type === 'products' ? 'product_name' : type === 'categories' ? 'category' : type,
            query,
            context
          })
        });

        const result = await response.json().catch(() => ({ success: false, error: 'Invalid response' }));

        if (result.success && result.data && result.data.suggestions) {
          setSuggestions(result.data.suggestions || []);
          setShowSuggestions(true);
          setSelectedIndex(-1);
        } else {
          console.error('Failed to fetch suggestions:', result.error || 'No data received');
          setSuggestions([]);
          setShowSuggestions(false);
        }

      } catch (error) {
        console.error('Error fetching suggestions:', error);
      } finally {
        setIsLoading(false);
      }
    }, 300),
    [type, context]
  );

  // Fetch suggestions when value changes
  useEffect(() => {
    if (value && !disabled) {
      debouncedFetchSuggestions(value);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      debouncedFetchSuggestions.cancel();
    };
  }, [value, disabled, debouncedFetchSuggestions]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: Suggestion) => {
    onChange(suggestion.text);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    
    if (onSelect) {
      onSelect(suggestion);
    }

    // Show feedback toast
    toast({
      title: "Suggestion selected",
      description: `Selected "${suggestion.text}" (${Math.round(suggestion.confidence * 100)}% confidence)`,
      duration: 2000
    });
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionSelect(suggestions[selectedIndex]);
        }
        break;
      
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current && 
        !inputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get icon for suggestion type
  const getSuggestionIcon = (suggestion: Suggestion) => {
    switch (suggestion.type) {
      case 'recent':
        return <Clock className="h-3 w-3" />;
      case 'frequent_product':
        return <Star className="h-3 w-3" />;
      case 'pattern':
        return <TrendingUp className="h-3 w-3" />;
      default:
        return <Search className="h-3 w-3" />;
    }
  };

  // Get badge variant for suggestion type
  const getBadgeVariant = (suggestion: Suggestion) => {
    if (suggestion.confidence > 0.8) return 'default';
    if (suggestion.confidence > 0.6) return 'secondary';
    return 'outline';
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => value.length >= 2 && setShowSuggestions(true)}
          disabled={disabled}
          className="pr-8"
        />
        
        {isLoading && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <Card 
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 max-h-64 overflow-y-auto shadow-lg"
        >
          <CardContent className="p-0">
            {suggestions.map((suggestion, index) => (
              <div
                key={`${suggestion.text}-${index}`}
                className={`
                  flex items-center justify-between p-3 cursor-pointer border-b last:border-b-0
                  ${index === selectedIndex ? 'bg-accent' : 'hover:bg-accent/50'}
                `}
                onClick={() => handleSuggestionSelect(suggestion)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {getSuggestionIcon(suggestion)}
                  <span className="truncate font-medium">
                    {suggestion.text}
                  </span>
                  {suggestion.reason && (
                    <span className="text-xs text-muted-foreground truncate">
                      {suggestion.reason}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-1 ml-2">
                  {suggestion.frequency > 1 && (
                    <Badge variant="outline" className="text-xs">
                      {suggestion.frequency}x
                    </Badge>
                  )}
                  <Badge 
                    variant={getBadgeVariant(suggestion)}
                    className="text-xs"
                  >
                    {Math.round(suggestion.confidence * 100)}%
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* No suggestions message */}
      {showSuggestions && suggestions.length === 0 && !isLoading && value.length >= 2 && (
        <Card className="absolute z-50 w-full mt-1 shadow-lg">
          <CardContent className="p-3 text-center text-muted-foreground text-sm">
            No suggestions found. The system will learn from your input.
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Specialized components for different types
export const ProductSuggestionsInput: React.FC<Omit<SmartSuggestionsInputProps, 'type'>> = (props) => (
  <SmartSuggestionsInput 
    {...props} 
    type="products" 
    placeholder="Enter product name..." 
  />
);

export const CategorySuggestionsInput: React.FC<Omit<SmartSuggestionsInputProps, 'type'>> = (props) => (
  <SmartSuggestionsInput 
    {...props} 
    type="categories" 
    placeholder="Enter category..." 
  />
);

export const SupplierSuggestionsInput: React.FC<Omit<SmartSuggestionsInputProps, 'type'>> = (props) => (
  <SmartSuggestionsInput 
    {...props} 
    type="suppliers" 
    placeholder="Enter supplier name..." 
  />
);

// Historical recommendations component
interface HistoricalRecommendationsProps {
  context?: any;
  onSelect?: (suggestion: Suggestion) => void;
  className?: string;
}

export const HistoricalRecommendations: React.FC<HistoricalRecommendationsProps> = ({
  context,
  onSelect,
  className = ""
}) => {
  const [recommendations, setRecommendations] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchRecommendations = async () => {
      setIsLoading(true);
      
      try {
        // Get auth token from Supabase
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        
        if (!token) {
          console.error('No auth token available');
          setRecommendations([]);
          return;
        }

        const response = await fetch(`http://localhost:5001/api/inventory/professional/suggestions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            type: 'product_name',
            query: 'mobile', // Use a default query to get suggestions
            context
          })
        });

        const result = await response.json().catch(() => ({ success: false, error: 'Invalid response' }));

        if (result.success && result.data && result.data.suggestions) {
          setRecommendations(result.data.suggestions || []);
        } else {
          console.error('Failed to fetch recommendations:', result.error || 'No data received');
          setRecommendations([]);
        }

      } catch (error) {
        console.error('Error fetching historical recommendations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendations();
  }, [context]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-4 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading recommendations...</p>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Recommended for you
        </h4>
        
        <div className="space-y-2">
          {recommendations.slice(0, 5).map((recommendation, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 rounded-lg border cursor-pointer hover:bg-accent/50"
              onClick={() => onSelect?.(recommendation)}
            >
              <div className="flex items-center gap-2">
                {getSuggestionIcon(recommendation)}
                <span className="font-medium">{recommendation.text}</span>
                {recommendation.reason && (
                  <span className="text-xs text-muted-foreground">
                    {recommendation.reason}
                  </span>
                )}
              </div>
              
              <Badge variant="outline" className="text-xs">
                {Math.round(recommendation.confidence * 100)}%
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Helper function (moved outside component to avoid recreation)
const getSuggestionIcon = (suggestion: Suggestion) => {
  switch (suggestion.type) {
    case 'recent':
      return <Clock className="h-3 w-3" />;
    case 'frequent_product':
      return <Star className="h-3 w-3" />;
    case 'pattern':
      return <TrendingUp className="h-3 w-3" />;
    default:
      return <Search className="h-3 w-3" />;
  }
};