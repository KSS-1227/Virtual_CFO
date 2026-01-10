import { Check, Clock } from 'lucide-react';
import { useOnboardingProgress } from '../hooks/useOnboardingProgress';

const steps = [
  { id: 1, title: 'Business Setup', time: '2-3 min' },
  { id: 2, title: 'First Entry', time: '1-2 min' },
  { id: 3, title: 'AI Insights', time: '2-3 min' }
];

export function ProgressIndicator() {
  const { currentStep, completedSteps } = useOnboardingProgress();

  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                ${completedSteps.includes(step.id) 
                  ? 'bg-green-500 text-white' 
                  : currentStep === step.id 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-500'
                }
              `}>
                {completedSteps.includes(step.id) ? (
                  <Check className="w-5 h-5" />
                ) : (
                  step.id
                )}
              </div>
              
              {/* Step Info */}
              <div className="mt-2 text-center">
                <div className={`text-sm font-medium ${
                  currentStep === step.id ? 'text-blue-600' : 'text-gray-600'
                }`}>
                  {step.title}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                  <Clock className="w-3 h-3" />
                  {step.time}
                </div>
              </div>
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div className={`
                flex-1 h-0.5 mx-4 mt-[-20px]
                ${completedSteps.includes(step.id) ? 'bg-green-500' : 'bg-gray-200'}
              `} />
            )}
          </div>
        ))}
      </div>

      {/* Overall Progress */}
      <div className="mt-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Progress</span>
          <span>{Math.round((completedSteps.length / steps.length) * 100)}% Complete</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(completedSteps.length / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}