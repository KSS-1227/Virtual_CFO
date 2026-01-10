import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/header";
import { LandingHero } from "@/components/landing-hero";
import { ProblemSection } from "@/components/problem-section";
import { SolutionDemo } from "@/components/solution-demo";
import { FeaturesSection } from "@/components/features-section";

import { PricingSection } from "@/components/pricing-section";
import { Footer } from "@/components/footer";
import { ModernDashboard } from "@/components/modern-dashboard";
import { FloatingVoiceAssistant } from "@/components/FloatingVoiceAssistant";
import { supabase } from "@/integrations/supabase/client";
import { User } from '@supabase/supabase-js';
import { LandingPage } from "./landing-page";

const Index = () => {
  const [showDashboard, setShowDashboard] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkUserAndProfile();
  }, []);

  const checkUserAndProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        // Check if user has a complete profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('business_name, owner_name')
          .eq('id', user.id)
          .single();
        
        if (profile && profile.business_name && profile.owner_name) {
          setHasProfile(true);
          setShowDashboard(true);
        } else {
          navigate('/profile');
        }
      } else {
        // User is not logged in, stay on Index to show LandingPage
      }
    } catch (error) {
      console.error('Error checking user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show dashboard for users with complete profiles
  if (user && hasProfile && showDashboard) {
    return (
      <>
        <ModernDashboard />
        <FloatingVoiceAssistant />
      </>
    );
  }

  const handleDemoClick = () => {
    setShowDashboard(true);
  };

  return <LandingPage />;
};

export default Index;
