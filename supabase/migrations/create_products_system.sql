-- Products and Services Recommendation System

-- 1. Products/Services Table
CREATE TABLE public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  
  -- Business targeting
  target_business_types TEXT[] DEFAULT '{}', -- Array of business types
  target_business_sizes TEXT[] DEFAULT '{}', -- small, medium, large
  min_revenue NUMERIC DEFAULT 0,
  max_revenue NUMERIC DEFAULT 999999999,
  
  -- Product details
  price NUMERIC NOT NULL,
  pricing_model TEXT DEFAULT 'one_time', -- one_time, monthly, yearly
  currency TEXT DEFAULT 'INR',
  
  -- Benefits and features
  key_benefits TEXT[] DEFAULT '{}',
  features TEXT[] DEFAULT '{}',
  roi_potential TEXT, -- Expected ROI description
  implementation_time TEXT, -- Time to implement
  
  -- Media and content
  image_url TEXT,
  video_url TEXT,
  brochure_url TEXT,
  
  -- Vendor information
  vendor_name TEXT NOT NULL,
  vendor_contact TEXT,
  vendor_website TEXT,
  
  -- System fields
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 2. Product Recommendations Table (AI Analysis Results)
CREATE TABLE public.product_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  product_id UUID NOT NULL REFERENCES products(id),
  
  -- AI Analysis Results
  compatibility_score NUMERIC NOT NULL CHECK (compatibility_score >= 0 AND compatibility_score <= 100),
  business_impact_score NUMERIC NOT NULL CHECK (business_impact_score >= 0 AND business_impact_score <= 100),
  
  -- Analysis details
  analysis_summary TEXT NOT NULL,
  potential_benefits TEXT[] DEFAULT '{}',
  implementation_challenges TEXT[] DEFAULT '{}',
  estimated_roi_months INTEGER,
  estimated_monthly_impact NUMERIC,
  
  -- Recommendation status
  recommendation_type TEXT DEFAULT 'suggested' CHECK (recommendation_type IN ('highly_recommended', 'recommended', 'suggested', 'not_recommended')),
  priority_level INTEGER DEFAULT 3 CHECK (priority_level >= 1 AND priority_level <= 5),
  
  -- User interaction
  is_viewed BOOLEAN DEFAULT false,
  is_interested BOOLEAN DEFAULT false,
  user_feedback TEXT,
  
  -- System fields
  analyzed_at TIMESTAMP DEFAULT now(),
  expires_at TIMESTAMP DEFAULT (now() + interval '30 days'),
  
  UNIQUE(user_id, product_id)
);

-- 3. Product Categories Table
CREATE TABLE public.product_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon_name TEXT, -- Lucide icon name
  color_class TEXT DEFAULT 'bg-blue-500',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0
);

-- Insert default categories
INSERT INTO product_categories (name, description, icon_name, color_class) VALUES
('Software & Tools', 'Business software, apps, and digital tools', 'Laptop', 'bg-blue-500'),
('Marketing Services', 'Digital marketing, advertising, and promotion services', 'Megaphone', 'bg-green-500'),
('Financial Services', 'Banking, loans, insurance, and financial products', 'CreditCard', 'bg-purple-500'),
('Equipment & Hardware', 'Machinery, computers, and physical equipment', 'Settings', 'bg-orange-500'),
('Training & Education', 'Courses, workshops, and skill development', 'GraduationCap', 'bg-indigo-500'),
('Consulting Services', 'Business consulting, legal, and advisory services', 'Users', 'bg-teal-500');

-- 4. Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- Products: Public read, admin write
CREATE POLICY "Anyone can view active products" ON products
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage products" ON products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.business_type = 'Admin'
    )
  );

-- Product Recommendations: Users see only their recommendations
CREATE POLICY "Users can view own recommendations" ON product_recommendations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own recommendation interactions" ON product_recommendations
  FOR UPDATE USING (auth.uid() = user_id);

-- Categories: Public read
CREATE POLICY "Anyone can view categories" ON product_categories
  FOR SELECT USING (is_active = true);

-- 6. Indexes for performance
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_business_types ON products USING GIN(target_business_types);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_recommendations_user ON product_recommendations(user_id);
CREATE INDEX idx_recommendations_score ON product_recommendations(compatibility_score DESC);
CREATE INDEX idx_recommendations_expires ON product_recommendations(expires_at);

-- 7. Functions

-- Function to clean expired recommendations
CREATE OR REPLACE FUNCTION clean_expired_recommendations()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM product_recommendations 
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's business profile for AI analysis
CREATE OR REPLACE FUNCTION get_user_business_context(target_user_id UUID)
RETURNS JSON AS $$
DECLARE
  user_context JSON;
BEGIN
  SELECT json_build_object(
    'business_type', business_type,
    'business_size', CASE 
      WHEN monthly_revenue < 100000 THEN 'small'
      WHEN monthly_revenue < 500000 THEN 'medium'
      ELSE 'large'
    END,
    'monthly_revenue', monthly_revenue,
    'monthly_expenses', monthly_expenses,
    'location', location,
    'profit_margin', CASE 
      WHEN monthly_revenue > 0 THEN 
        ROUND(((monthly_revenue - monthly_expenses) / monthly_revenue * 100)::numeric, 2)
      ELSE 0
    END
  ) INTO user_context
  FROM profiles 
  WHERE id = target_user_id;
  
  RETURN user_context;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;