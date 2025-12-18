import { ArrowLeft, ArrowRight, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnboardingProgress } from '../hooks/useOnboardingProgress';
import { useStepValidation } from '../hooks/useStepValidation';

interface StepNavigationProps {
  onNext: () => void;
  onPrevious: () => void;
  onSkip?: () => void;
  showSkip?: boolean;
  nextLabel?: string;
  isLoading?: boolean;
}

export function StepNavigation({ 
  onNext, 
  onPrevious, 
  onSkip, 
  showSkip = false,
  nextLabel = 'Continue',
  isLoading = false
}: StepNavigationProps) {
  const { currentStep } = useOnboardingProgress();
  const { isValid } = useStepValidation(currentStep);

  return (
    <div className="flex items-center justify-between pt-6 border-t border-gray-200">
      {/* Previous Button */}
      <Button
        variant="outline"
        onClick={onPrevious}
        disabled={currentStep === 1}
        className="flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Previous
      </Button>

      {/* Skip Option */}
      {showSkip && onSkip && (
        <Button
          variant="ghost"
          onClick={onSkip}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700"
        >
          <SkipForward className="w-4 h-4" />
          Skip for now
        </Button>
      )}

      {/* Next Button */}
      <Button
        onClick={onNext}
        disabled={!isValid || isLoading}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Processing...
          </>
        ) : (
          <>
            {nextLabel}
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </Button>
    </div>
  );
}