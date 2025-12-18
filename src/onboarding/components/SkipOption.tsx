import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface SkipOptionProps {
  onSkip: () => void;
  onSaveProgress: () => void;
}

export function SkipOption({ onSkip, onSaveProgress }: SkipOptionProps) {
  const [showExitDialog, setShowExitDialog] = useState(false);

  const handleExit = () => {
    setShowExitDialog(true);
  };

  return (
    <>
      {/* Exit Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleExit}
        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
      >
        <X className="w-5 h-5" />
      </Button>

      {/* Exit Confirmation Dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Save Your Progress?
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-gray-600">
              You're making great progress! Would you like to save and continue later, 
              or skip the setup entirely?
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Why complete the setup?</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Get personalized AI recommendations</li>
                <li>• See how you compare to similar businesses</li>
                <li>• Unlock advanced profit insights</li>
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  onSaveProgress();
                  setShowExitDialog(false);
                }}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Save Progress & Continue Later
              </Button>
              
              <Button
                variant="outline"
                onClick={() => {
                  onSkip();
                  setShowExitDialog(false);
                }}
                className="w-full"
              >
                Skip Setup (Not Recommended)
              </Button>
              
              <Button
                variant="ghost"
                onClick={() => setShowExitDialog(false)}
                className="w-full text-gray-500"
              >
                Continue Setup Now
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}