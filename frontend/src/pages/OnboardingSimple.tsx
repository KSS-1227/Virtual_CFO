import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function OnboardingSimple() {
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-2xl font-bold mb-6">Simple Onboarding Test</h1>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="business">Business Name</Label>
              <Input
                id="business"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Enter your business name"
              />
            </div>
            
            <Button onClick={() => setStep(step + 1)}>
              Next Step ({step})
            </Button>
          </div>
          
          <div className="mt-4 p-4 bg-gray-100 rounded">
            <p>Current Step: {step}</p>
            <p>Business Name: {businessName}</p>
            <p>If you see this, basic components work!</p>
          </div>
        </div>
      </div>
    </div>
  );
}