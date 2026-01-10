import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { productsAPI, handleAPIError } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Upload, Package, DollarSign, Users, Tag } from "lucide-react";

export default function ProductAdmin() {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    subcategory: "",
    target_business_types: [],
    target_business_sizes: [],
    min_revenue: "",
    max_revenue: "",
    price: "",
    pricing_model: "one_time",
    key_benefits: [],
    features: [],
    roi_potential: "",
    implementation_time: "",
    vendor_name: "",
    vendor_contact: "",
    vendor_website: "",
  });
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const businessTypes = [
    "Electronics", "Restaurant", "Clothing", "Grocery", "Medical Store", 
    "Salon", "Auto Parts", "Manufacturing", "Services", "Retail"
  ];

  const businessSizes = ["small", "medium", "large"];
  const pricingModels = ["one_time", "monthly", "yearly", "per_use"];

  useEffect(() => {
    checkAdminAccess();
    loadCategories();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('business_type')
      .eq('id', user.id)
      .single();

    if (!profile || profile.business_type !== 'Admin') {
      toast({
        title: "Access Denied",
        description: "Admin access required for this page.",
        variant: "destructive",
      });
      navigate('/');
    }
  };

  const loadCategories = async () => {
    try {
      const response = await productsAPI.getCategories();
      setCategories(response.data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleArrayInput = (field: string, value: string) => {
    const items = value.split(',').map(item => item.trim()).filter(Boolean);
    setFormData(prev => ({ ...prev, [field]: items }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.description || !formData.category || !formData.price || !formData.vendor_name) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        min_revenue: formData.min_revenue ? parseFloat(formData.min_revenue) : 0,
        max_revenue: formData.max_revenue ? parseFloat(formData.max_revenue) : 999999999,
      };

      await productsAPI.createProduct(productData);

      toast({
        title: "Success! 🎉",
        description: `Product "${formData.name}" has been created successfully.`,
      });

      // Reset form
      setFormData({
        name: "",
        description: "",
        category: "",
        subcategory: "",
        target_business_types: [],
        target_business_sizes: [],
        min_revenue: "",
        max_revenue: "",
        price: "",
        pricing_model: "one_time",
        key_benefits: [],
        features: [],
        roi_potential: "",
        implementation_time: "",
        vendor_name: "",
        vendor_contact: "",
        vendor_website: "",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: handleAPIError(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            Admin Panel
          </Badge>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Product Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Add New Product/Service
                </CardTitle>
                <CardDescription>
                  Create a new product or service that will be analyzed by AI for user recommendations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Basic Information
                    </h3>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Product/Service Name *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g., Digital Marketing Package"
                          required
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="category">Category *</Label>
                        <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((cat: any) => (
                              <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="description">Description *</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Detailed description of the product/service..."
                        rows={3}
                        required
                      />
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Pricing
                    </h3>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="price">Price (₹) *</Label>
                        <Input
                          id="price"
                          type="number"
                          value={formData.price}
                          onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                          placeholder="10000"
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="pricing_model">Pricing Model</Label>
                        <Select value={formData.pricing_model} onValueChange={(value) => setFormData(prev => ({ ...prev, pricing_model: value }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {pricingModels.map((model) => (
                              <SelectItem key={model} value={model}>
                                {model.replace('_', ' ').toUpperCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Target Audience */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Target Audience
                    </h3>
                    
                    <div>
                      <Label htmlFor="target_business_types">Target Business Types (comma-separated)</Label>
                      <Input
                        id="target_business_types"
                        value={formData.target_business_types.join(', ')}
                        onChange={(e) => handleArrayInput('target_business_types', e.target.value)}
                        placeholder="Electronics, Restaurant, Retail"
                      />
                      <div className="flex flex-wrap gap-1 mt-2">
                        {businessTypes.map(type => (
                          <Badge 
                            key={type} 
                            variant="outline" 
                            className="cursor-pointer hover:bg-primary/10"
                            onClick={() => {
                              const current = formData.target_business_types;
                              const updated = current.includes(type) 
                                ? current.filter(t => t !== type)
                                : [...current, type];
                              setFormData(prev => ({ ...prev, target_business_types: updated }));
                            }}
                          >
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="min_revenue">Min Monthly Revenue (₹)</Label>
                        <Input
                          id="min_revenue"
                          type="number"
                          value={formData.min_revenue}
                          onChange={(e) => setFormData(prev => ({ ...prev, min_revenue: e.target.value }))}
                          placeholder="50000"
                          min="0"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="max_revenue">Max Monthly Revenue (₹)</Label>
                        <Input
                          id="max_revenue"
                          type="number"
                          value={formData.max_revenue}
                          onChange={(e) => setFormData(prev => ({ ...prev, max_revenue: e.target.value }))}
                          placeholder="500000"
                          min="0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Benefits & Features */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Tag className="h-5 w-5" />
                      Benefits & Features
                    </h3>
                    
                    <div>
                      <Label htmlFor="key_benefits">Key Benefits (comma-separated)</Label>
                      <Textarea
                        id="key_benefits"
                        value={formData.key_benefits.join(', ')}
                        onChange={(e) => handleArrayInput('key_benefits', e.target.value)}
                        placeholder="Increase sales, Reduce costs, Improve efficiency"
                        rows={2}
                      />
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="roi_potential">ROI Potential</Label>
                        <Input
                          id="roi_potential"
                          value={formData.roi_potential}
                          onChange={(e) => setFormData(prev => ({ ...prev, roi_potential: e.target.value }))}
                          placeholder="200% ROI in 6 months"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="implementation_time">Implementation Time</Label>
                        <Input
                          id="implementation_time"
                          value={formData.implementation_time}
                          onChange={(e) => setFormData(prev => ({ ...prev, implementation_time: e.target.value }))}
                          placeholder="2-4 weeks"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Vendor Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Vendor Information</h3>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="vendor_name">Vendor Name *</Label>
                        <Input
                          id="vendor_name"
                          value={formData.vendor_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, vendor_name: e.target.value }))}
                          placeholder="Company Name"
                          required
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="vendor_contact">Contact</Label>
                        <Input
                          id="vendor_contact"
                          value={formData.vendor_contact}
                          onChange={(e) => setFormData(prev => ({ ...prev, vendor_contact: e.target.value }))}
                          placeholder="contact@company.com"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="vendor_website">Website</Label>
                      <Input
                        id="vendor_website"
                        value={formData.vendor_website}
                        onChange={(e) => setFormData(prev => ({ ...prev, vendor_website: e.target.value }))}
                        placeholder="https://company.com"
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating Product..." : "Create Product"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Preview/Help */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">AI Analysis Preview</CardTitle>
                <CardDescription>How AI will analyze this product</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Compatibility Factors:</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Business type matching</li>
                    <li>• Revenue range compatibility</li>
                    <li>• ROI potential analysis</li>
                    <li>• Implementation feasibility</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Impact Assessment:</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Financial benefit calculation</li>
                    <li>• Risk vs reward analysis</li>
                    <li>• Implementation challenges</li>
                    <li>• Timeline considerations</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <h4 className="font-medium">Better Descriptions:</h4>
                  <p className="text-muted-foreground">Include specific benefits, use cases, and measurable outcomes.</p>
                </div>
                
                <div>
                  <h4 className="font-medium">Target Audience:</h4>
                  <p className="text-muted-foreground">Be specific about business types and revenue ranges for better AI matching.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}