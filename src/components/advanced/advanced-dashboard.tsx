import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SmartInsightsPanel, GoalTracker, PredictiveAlerts } from "./smart-insights";
import { AIInsightsPanel } from "./ai-insights";

export function AdvancedDashboard() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="insights" className="w-full">
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="insights">Smart Insights</TabsTrigger>
        </TabsList>
        

        <TabsContent value="insights" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AIInsightsPanel />
            <PredictiveAlerts />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}