import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SmartInsightsPanel, GoalTracker, PredictiveAlerts } from "./smart-insights";
import { AchievementsPanel, ActiveChallenges, FinancialHealthScore } from "./gamification";

export function AdvancedDashboard() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="insights" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="insights">Smart Insights</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
        </TabsList>
        

        <TabsContent value="insights" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SmartInsightsPanel />
            <PredictiveAlerts />
          </div>
        </TabsContent>
        

        <TabsContent value="achievements" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <FinancialHealthScore />
            <AchievementsPanel />
            <ActiveChallenges />
          </div>
        </TabsContent>
        

        <TabsContent value="goals" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GoalTracker />
            <div className="space-y-6">
              <FinancialHealthScore />
              <ActiveChallenges />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}