import { useEffect, useState } from "react";
import { inventoryAPI } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, RefreshCcw, Mic, Camera, Brain, TrendingUp, BarChart3 } from "lucide-react";

// Import new dynamic inventory components
import { VoiceInventoryInput } from "@/components/inventory/VoiceInventoryInput";
import { ImageInventoryInput } from "@/components/inventory/ImageInventoryInput";
import { SmartSuggestionsInput, ProductSuggestionsInput, CategorySuggestionsInput, HistoricalRecommendations } from "@/components/inventory/SmartSuggestionsInput";

interface InventoryItem {
  id: string;
  product_name: string;
  unit?: string;
  brand?: string;
  category?: string;
  current_stock?: number;
  aliases?: string[];
  custom_attributes?: any;
}

interface BusinessInsights {
  overview: {
    total_products: number;
    active_products: number;
    low_stock_items: number;
    stock_health_score: number;
  };
  recommendations: Array<{
    title: string;
    description: string;
    priority: string;
    category: string;
  }>;
}

const InventoryPage = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [insights, setInsights] = useState<BusinessInsights | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({
    product_name: "",
    unit: "",
    brand: "",
    category: "",
    notes: ""
  });

  const loadItems = async () => {
    try {
      setLoading(true);
      const result = await inventoryAPI.listItems();
      setItems(result.data || []);
    } catch (error: any) {
      console.error("Failed to load inventory", error);
      toast({
        title: "Inventory error",
        description: error?.message || "Failed to load inventory",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadBusinessInsights = async () => {
    try {
      const response = await fetch('/api/inventory/business-insights', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      
      const result = await response.json();
      if (result.success) {
        setInsights(result.insights);
      }
    } catch (error) {
      console.error("Failed to load business insights", error);
    }
  };

  useEffect(() => {
    loadItems();
    loadBusinessInsights();
  }, []);

  const handleVoiceCommandProcessed = (result: any) => {
    console.log("Voice command processed:", result);
    loadItems(); // Refresh inventory after voice command
    
    toast({
      title: "Voice command executed",
      description: "Inventory updated successfully",
    });
  };

  const handleImageDataExtracted = (result: any) => {
    console.log("Image data extracted:", result);
    
    // If it's a receipt with multiple items, refresh inventory
    if (result.items && result.items.length > 0) {
      loadItems();
      toast({
        title: "Receipt processed",
        description: `${result.items.length} items processed`,
      });
    }
  };

  const handleAddItem = async () => {
    if (!newItem.product_name.trim()) {
      toast({
        title: "Validation error",
        description: "Product name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      await inventoryAPI.saveItem(newItem);
      setNewItem({
        product_name: "",
        unit: "",
        brand: "",
        category: "",
        notes: ""
      });
      setShowAddForm(false);
      loadItems();
      
      toast({
        title: "Item added",
        description: `${newItem.product_name} added to inventory`,
      });
    } catch (error: any) {
      toast({
        title: "Error adding item",
        description: error?.message || "Failed to add item",
        variant: "destructive",
      });
    }
  };

  const handleError = (error: string) => {
    toast({
      title: "Error",
      description: error,
      variant: "destructive",
    });
  };

  const filtered = items.filter((item) =>
    item.product_name.toLowerCase().includes(search.toLowerCase()) ||
    item.brand?.toLowerCase().includes(search.toLowerCase()) ||
    item.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dynamic Inventory Management</h1>
            <p className="text-muted-foreground">AI-powered inventory with voice, image, and smart suggestions</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadItems}
              disabled={loading}
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button 
              size="sm" 
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>
        </div>

        {/* Business Insights Overview */}
        {insights && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Total Products</span>
                </div>
                <p className="text-2xl font-bold">{insights.overview.total_products}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Active Products</span>
                </div>
                <p className="text-2xl font-bold">{insights.overview.active_products}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="h-4 w-4 p-0" />
                  <span className="text-sm font-medium">Low Stock</span>
                </div>
                <p className="text-2xl font-bold">{insights.overview.low_stock_items}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium">Health Score</span>
                </div>
                <p className="text-2xl font-bold">{Math.round(insights.overview.stock_health_score)}%</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Multi-Modal Input Tabs */}
        <Tabs defaultValue="list" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="list">Inventory List</TabsTrigger>
            <TabsTrigger value="voice">
              <Mic className="h-4 w-4 mr-2" />
              Voice Input
            </TabsTrigger>
            <TabsTrigger value="image">
              <Camera className="h-4 w-4 mr-2" />
              Image Processing
            </TabsTrigger>
            <TabsTrigger value="smart">
              <Brain className="h-4 w-4 mr-2" />
              Smart Add
            </TabsTrigger>
            <TabsTrigger value="insights">
              <TrendingUp className="h-4 w-4 mr-2" />
              Insights
            </TabsTrigger>
          </TabsList>

          {/* Inventory List Tab */}
          <TabsContent value="list" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-base">Inventory Items ({filtered.length})</CardTitle>
                <Input
                  placeholder="Search by product, brand, or category"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-xs"
                />
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b text-xs text-muted-foreground">
                      <tr className="text-left">
                        <th className="py-2">Product</th>
                        <th className="py-2">Brand</th>
                        <th className="py-2">Category</th>
                        <th className="py-2">Stock</th>
                        <th className="py-2">Unit</th>
                        <th className="py-2">Aliases</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="py-2 font-medium">{item.product_name}</td>
                          <td className="py-2 text-muted-foreground">{item.brand || "-"}</td>
                          <td className="py-2">
                            {item.category ? (
                              <Badge variant="outline">{item.category}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-2">
                            {item.current_stock !== undefined ? (
                              <span
                                className={
                                  item.current_stock <= 0
                                    ? "text-destructive font-semibold"
                                    : ""
                                }
                              >
                                {item.current_stock}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                          <td className="py-2 text-muted-foreground">{item.unit || "-"}</td>
                          <td className="py-2">
                            {item.aliases && item.aliases.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {item.aliases.slice(0, 2).map((alias, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {alias}
                                  </Badge>
                                ))}
                                {item.aliases.length > 2 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{item.aliases.length - 2}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && !loading && (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-4 text-center text-muted-foreground text-xs"
                          >
                            {search ? "No items match your search." : "No inventory items yet. Use voice commands, image processing, or manual entry to add items."}
                          </td>
                        </tr>
                      )}
                      {loading && (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-4 text-center text-muted-foreground text-xs"
                          >
                            Loading inventory...
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Voice Input Tab */}
          <TabsContent value="voice">
            <VoiceInventoryInput
              onCommandProcessed={handleVoiceCommandProcessed}
              onError={handleError}
            />
          </TabsContent>

          {/* Image Processing Tab */}
          <TabsContent value="image">
            <ImageInventoryInput
              onDataExtracted={handleImageDataExtracted}
              onError={handleError}
            />
          </TabsContent>

          {/* Smart Add Tab */}
          <TabsContent value="smart" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Smart Inventory Entry</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Product Name</label>
                    <ProductSuggestionsInput
                      value={newItem.product_name}
                      onChange={(value) => setNewItem(prev => ({ ...prev, product_name: value }))}
                      onSelect={(suggestion) => {
                        setNewItem(prev => ({ ...prev, product_name: suggestion.text }));
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <CategorySuggestionsInput
                      value={newItem.category}
                      onChange={(value) => setNewItem(prev => ({ ...prev, category: value }))}
                      context={newItem.product_name}
                      onSelect={(suggestion) => {
                        setNewItem(prev => ({ ...prev, category: suggestion.text }));
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Brand</label>
                    <Input
                      value={newItem.brand}
                      onChange={(e) => setNewItem(prev => ({ ...prev, brand: e.target.value }))}
                      placeholder="Enter brand name"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Unit</label>
                    <Input
                      value={newItem.unit}
                      onChange={(e) => setNewItem(prev => ({ ...prev, unit: e.target.value }))}
                      placeholder="pieces, kg, boxes, etc."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes</label>
                  <Input
                    value={newItem.notes}
                    onChange={(e) => setNewItem(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes"
                  />
                </div>

                <Button onClick={handleAddItem} className="w-full">
                  Add to Inventory
                </Button>
              </CardContent>
            </Card>

            {/* Historical Recommendations */}
            <HistoricalRecommendations
              context={{ recent_activity: true }}
              onSelect={(suggestion) => {
                setNewItem(prev => ({ ...prev, product_name: suggestion.text }));
              }}
            />
          </TabsContent>

          {/* Insights Tab */}
          <TabsContent value="insights" className="space-y-4">
            {insights && insights.recommendations && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights.recommendations.slice(0, 6).map((rec, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium">{rec.title}</h4>
                        <Badge 
                          variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}
                        >
                          {rec.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{rec.description}</p>
                      <Badge variant="outline" className="mt-2 text-xs">
                        {rec.category}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
};

export default InventoryPage;
