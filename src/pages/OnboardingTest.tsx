import { useOnboardingProgress } from '@/onboarding/hooks/useOnboardingProgress';

export default function OnboardingTest() {
  const { currentStep, businessData } = useOnboardingProgress();

  return (
    <div className="p-8">
      <h1>Onboarding Test</h1>
      <p>Current Step: {currentStep}</p>
      <p>Business Name: {businessData.name}</p>
      <p>If you see this, the store is working!</p>
    </div>
  );
}