import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { earningsAPI, handleAPIError } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Calendar as CalendarIcon, DollarSign, Package, TrendingUp, TrendingDown, AlertCircle, CheckCircle, ChevronDown, ChevronUp, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface EarningsEntry {
  id: string;
  user_id: string;
  earning_date: string;
  amount: number;
  inventory_cost: number;
  created_at: string;
}

export default function Earnings() {
  const [loading, setLoading] = useState(false);
  const [todayData, setTodayData] = useState<EarningsEntry | null>(null);
  const [recentEntries, setRecentEntries] = useState<EarningsEntry[]>([]);
  const [filledDates, setFilledDates] = useState<Date[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [streak, setStreak] = useState(0);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [showStatus, setShowStatus] = useState(true);
  const [formData, setFormData] = useState({
    earning_date: new Date().toISOString().split('T')[0], // Today's date
    amount: "",
    inventory_cost: ""
  });
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkUserAuth();
    loadTodayData();
    loadRecentEntries();
    loadFilledDates();
  }, []);

  const checkUserAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }
  };

  const loadTodayData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await earningsAPI.getEarningsByDateRange(today, today);
      
      if (data && data.length > 0) {
        setTodayData(data[0]);
      }
    } catch (error) {
      console.error('Error loading today data:', error);
    }
  };

  const loadRecentEntries = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Get last 7 entries directly from database
      const { data, error } = await supabase
        .from('earnings')
        .select('*')
        .eq('user_id', user.id)
        .order('earning_date', { ascending: false })
        .limit(7);
      
      if (error) {
        console.error('Error loading recent entries:', error);
        return;
      }
      
      setRecentEntries(data || []);
      
      // Calculate streak
      let currentStreak = 0;
      const sortedEntries = (data || []).sort((a, b) => b.earning_date.localeCompare(a.earning_date));
      
      for (let i = 0; i < sortedEntries.length; i++) {
        const expectedDate = new Date();
        expectedDate.setDate(expectedDate.getDate() - i);
        const expectedDateStr = expectedDate.toISOString().split('T')[0];
        
        if (sortedEntries[i]?.earning_date === expectedDateStr) {
          currentStreak++;
        } else {
          break;
        }
      }
      setStreak(currentStreak);
    } catch (error) {
      console.error('Error loading recent entries:', error);
    }
  };

  const loadFilledDates = async () => {
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3); // Load last 3 months
      const startDateStr = startDate.toISOString().split('T')[0];
      
      const { data } = await earningsAPI.getEarningsByDateRange(startDateStr, endDate);
      const dates = (data || []).map(entry => new Date(entry.earning_date));
      setFilledDates(dates);
    } catch (error) {
      console.error('Error loading filled dates:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('📝 Form submitted with data:', formData);
    
    if (!formData.amount || !formData.inventory_cost) {
      console.log('❌ Missing form data');
      toast({
        title: "Missing Information",
        description: "Please enter both daily revenue and inventory cost.",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(formData.amount);
    const inventoryCost = parseFloat(formData.inventory_cost);
    
    console.log('💰 Parsed amounts:', { amount, inventoryCost });
    
    if (amount < 0 || inventoryCost < 0) {
      console.log('❌ Negative amounts detected');
      toast({
        title: "Invalid Amount",
        description: "Revenue and costs must be positive numbers.",
        variant: "destructive",
      });
      return;
    }

    if (inventoryCost > amount) {
      console.log('⚠️ Inventory cost higher than revenue');
      toast({
        title: "Warning",
        description: "Inventory cost is higher than revenue. Are you sure?",
        variant: "destructive",
      });
    }

    setLoading(true);
    console.log('🔄 Starting API call...');
    
    try {
      const result = await earningsAPI.addEarnings({
        earning_date: formData.earning_date,
        amount,
        inventory_cost: inventoryCost,
      });

      console.log('✅ API call successful:', result);

      const isToday = formData.earning_date === new Date().toISOString().split('T')[0];
      const isUpdate = todayData && isToday;
      toast({
        title: "Success! 🎉",
        description: `Earnings ${isUpdate ? 'updated' : 'recorded'} for ${formData.earning_date}. Daily profit: ₹${(amount - inventoryCost).toLocaleString()}`,
      });

      console.log('🔄 Refreshing data...');
      // Refresh data
      await loadTodayData();
      await loadRecentEntries();
      await loadFilledDates();
      
      // Reset form if it was for today
      if (formData.earning_date === new Date().toISOString().split('T')[0]) {
        setFormData({
          earning_date: new Date().toISOString().split('T')[0],
          amount: "",
          inventory_cost: ""
        });
      }
      console.log('✅ Data refresh complete');
    } catch (error) {
      console.error('❌ Error in handleSubmit:', error);
      toast({
        title: "Error",
        description: handleAPIError(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      console.log('🏁 Form submission complete');
    }
  };

  const calculateProfit = () => {
    const amount = parseFloat(formData.amount) || 0;
    const cost = parseFloat(formData.inventory_cost) || 0;
    return amount - cost;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const todayProfit = todayData ? (todayData.amount - todayData.inventory_cost) : 0;
  const isToday = formData.earning_date === new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Current Streak</p>
            <p className="text-2xl font-bold text-primary">{streak} days 🔥</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Main Column: Form (Focus) */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="shadow-md border-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-2xl text-primary">
                  <DollarSign className="h-6 w-6" />
                  Record Daily Earnings
                </div>
                {isToday && (
                  <Badge variant={todayData ? "default" : "outline"} className={cn(todayData ? "bg-green-600 hover:bg-green-700" : "text-orange-600 border-orange-200 bg-orange-50")}>
                    {todayData ? "Recorded ✓" : "Pending"}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Track your daily revenue and inventory costs for accurate profit calculation
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="date" className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    Date
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.earning_date}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, earning_date: e.target.value }));
                      setSelectedDate(new Date(e.target.value));
                    }}
                    max={new Date().toISOString().split('T')[0]}
                    required
                    className="h-11 focus:ring-2 focus:ring-primary focus:border-primary transition-all font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount" className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Daily Revenue (₹)
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Enter total sales for the day"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    className="text-lg"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inventory_cost" className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Inventory Cost (₹)
                  </Label>
                  <Input
                    id="inventory_cost"
                    type="number"
                    placeholder="Cost of goods sold"
                    value={formData.inventory_cost}
                    onChange={(e) => setFormData(prev => ({ ...prev, inventory_cost: e.target.value }))}
                    className="text-lg"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                </div>

                {formData.amount && formData.inventory_cost && (
                  <div className={cn("p-4 rounded-xl border flex justify-between items-center transition-colors shadow-sm", 
                    calculateProfit() >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                  )}>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Net Profit</p>
                      <p className={cn("text-2xl font-bold", calculateProfit() >= 0 ? "text-green-700" : "text-red-700")}>
                        {formatCurrency(calculateProfit())}
                      </p>
                    </div>
                    <div className={cn("h-12 w-12 rounded-full flex items-center justify-center", calculateProfit() >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                      {calculateProfit() >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
                    </div>
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-14 text-lg font-bold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 rounded-xl" 
                  disabled={loading}
                >
                  {loading ? "Recording..." : "Record Earnings"}
                </Button>
                
                {todayData && isToday && (
                  <p className="text-xs text-center text-muted-foreground">
                    Today's earnings already recorded. This will update the existing record.
                  </p>
                )}
              </form>
            </CardContent>
          </Card>

            {/* Collapsible Calendar */}
            <Card>
              <CardHeader className="py-4 cursor-pointer hover:bg-muted/50 transition-colors select-none" onClick={() => setIsCalendarOpen(!isCalendarOpen)}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" /> 
                    Calendar View
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    {isCalendarOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              {isCalendarOpen && (
                <CardContent className="pt-0 pb-4">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (date) {
                        setSelectedDate(date);
                        setFormData(prev => ({ 
                          ...prev, 
                          earning_date: date.toISOString().split('T')[0] 
                        }));
                      }
                    }}
                    disabled={(date) => date > new Date()}
                    modifiers={{ filled: filledDates }}
                    modifiersStyles={{
                      filled: { backgroundColor: '#22c55e', color: 'white', fontWeight: 'bold', borderRadius: '6px' }
                    }}
                    className="rounded-xl border shadow-sm mx-auto p-4"
                  />
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-6 border-t pt-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-primary shadow-sm" />
                      <span className="text-xs font-medium text-muted-foreground">Selected Date</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-[#22c55e] shadow-sm" />
                      <span className="text-xs font-medium text-muted-foreground">Earnings Recorded</span>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          {/* Sidebar Column: Calendar & Recent */}
          <div className="lg:col-span-5 space-y-6">
            {/* Recent Entries */}
            <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Recent Entries</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {recentEntries.length > 0 ? (
                  recentEntries.map((entry) => {
                    const profit = entry.amount - entry.inventory_cost;
                    
                    return (
                      <div key={entry.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors border-l-2 border-l-transparent hover:border-l-primary">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", profit >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                            {profit >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{new Date(entry.earning_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })}</p>
                            <p className="text-xs text-muted-foreground">Revenue: {formatCurrency(entry.amount)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn("font-bold text-sm", 
                            profit >= 0 ? "text-green-700" : "text-red-700"
                          )}>
                            {profit >= 0 ? "+" : ""}{formatCurrency(profit)}
                          </p>
                          <p className="text-xs text-muted-foreground">Profit</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-muted-foreground p-4">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No recent entries</p>
                    <p className="text-xs">Start recording your daily earnings above</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          </div>
        </div>

        {/* Quick Tips */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">💡 CFO Tips for Better Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">📊 Daily Consistency</h4>
                <p className="text-muted-foreground">Record earnings every day at the same time to build a habit and get accurate trends.</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">💰 Accurate Costs</h4>
                <p className="text-muted-foreground">Include all costs: inventory, labor, utilities. This gives true profit margins.</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">📈 Track Patterns</h4>
                <p className="text-muted-foreground">Notice which days perform best. Use this data to optimize your business operations.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}