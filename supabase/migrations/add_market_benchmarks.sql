-- Market Benchmarks for Industry Comparison
CREATE TABLE public.industry_benchmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  industry_type TEXT NOT NULL,
  business_size TEXT NOT NULL CHECK (business_size IN ('small', 'medium', 'large')),
  
  -- Profit Margins (Industry Averages)
  avg_profit_margin_percent NUMERIC NOT NULL,
  good_profit_margin_percent NUMERIC NOT NULL,
  excellent_profit_margin_percent NUMERIC NOT NULL,
  
  -- Revenue Benchmarks (Monthly)
  avg_monthly_revenue NUMERIC NOT NULL,
  median_monthly_revenue NUMERIC NOT NULL,
  top_25_percent_revenue NUMERIC NOT NULL,
  
  -- Growth Benchmarks
  avg_monthly_growth_percent NUMERIC DEFAULT 0,
  good_monthly_growth_percent NUMERIC DEFAULT 5,
  excellent_monthly_growth_percent NUMERIC DEFAULT 15,
  
  -- Market Data
  region TEXT DEFAULT 'India',
  currency TEXT DEFAULT 'INR',
  last_updated TIMESTAMP DEFAULT now(),
  
  UNIQUE(industry_type, business_size, region)
);

-- Insert Sample Industry Data (Indian Market)
INSERT INTO public.industry_benchmarks VALUES
-- Retail/Electronics
(gen_random_uuid(), 'Electronics Retail', 'small', 15.0, 25.0, 35.0, 300000, 250000, 500000, 3.0, 8.0, 20.0, 'India', 'INR', now()),
(gen_random_uuid(), 'Electronics Retail', 'medium', 18.0, 28.0, 40.0, 800000, 600000, 1200000, 5.0, 12.0, 25.0, 'India', 'INR', now()),

-- Food & Restaurant
(gen_random_uuid(), 'Food & Restaurant', 'small', 8.0, 15.0, 25.0, 200000, 150000, 350000, 2.0, 6.0, 15.0, 'India', 'INR', now()),
(gen_random_uuid(), 'Food & Restaurant', 'medium', 12.0, 20.0, 30.0, 500000, 400000, 800000, 4.0, 10.0, 20.0, 'India', 'INR', now()),

-- Clothing/Fashion
(gen_random_uuid(), 'Clothing & Fashion', 'small', 20.0, 35.0, 50.0, 250000, 200000, 450000, 3.0, 8.0, 18.0, 'India', 'INR', now()),
(gen_random_uuid(), 'Clothing & Fashion', 'medium', 25.0, 40.0, 55.0, 600000, 500000, 1000000, 5.0, 12.0, 22.0, 'India', 'INR', now()),

-- Services/Consulting
(gen_random_uuid(), 'Services & Consulting', 'small', 25.0, 40.0, 60.0, 180000, 120000, 300000, 4.0, 10.0, 25.0, 'India', 'INR', now()),
(gen_random_uuid(), 'Services & Consulting', 'medium', 30.0, 45.0, 65.0, 450000, 350000, 700000, 6.0, 15.0, 30.0, 'India', 'INR', now()),

-- Manufacturing
(gen_random_uuid(), 'Manufacturing', 'small', 12.0, 20.0, 30.0, 400000, 300000, 600000, 2.0, 5.0, 12.0, 'India', 'INR', now()),
(gen_random_uuid(), 'Manufacturing', 'medium', 15.0, 25.0, 35.0, 1000000, 800000, 1500000, 3.0, 8.0, 18.0, 'India', 'INR', now());

-- Enable RLS
ALTER TABLE public.industry_benchmarks ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read benchmarks
CREATE POLICY "All users can view industry benchmarks" 
ON public.industry_benchmarks FOR SELECT 
USING (auth.role() = 'authenticated');

-- Create indexes
CREATE INDEX idx_industry_benchmarks_type ON public.industry_benchmarks(industry_type);
CREATE INDEX idx_industry_benchmarks_size ON public.industry_benchmarks(business_size);