import { useState, useEffect } from 'react';
import { useOnboardingProgress } from './useOnboardingProgress';

export const useStepValidation = (step: number) => {
  const [isValid, setIsValid] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const { businessData, earningsData } = useOnboardingProgress();

  useEffect(() => {
    const validateStep = () => {
      const newErrors: string[] = [];
      let valid = false;

      switch (step) {
        case 1: // Business Setup
          if (!businessData.name.trim()) newErrors.push('Business name is required');
          if (!businessData.type) newErrors.push('Business type is required');
          if (!businessData.location.trim()) newErrors.push('Location is required');
          if (!businessData.phone.trim()) newErrors.push('Phone number is required');
          if (businessData.phone && !/^[6-9]\d{9}$/.test(businessData.phone)) {
            newErrors.push('Please enter a valid 10-digit phone number');
          }
          valid = businessData.name.trim() && businessData.type && businessData.location.trim() && 
                  businessData.phone.trim() && /^[6-9]\d{9}$/.test(businessData.phone);
          break;

        case 2: // Earnings Entry
          if (earningsData.dailySales <= 0) newErrors.push('Daily sales must be greater than 0');
          if (earningsData.dailyCosts < 0) newErrors.push('Daily costs cannot be negative');
          if (earningsData.dailyCosts >= earningsData.dailySales) {
            newErrors.push('Costs should be less than sales for profit');
          }
          valid = earningsData.dailySales > 0 && earningsData.dailyCosts >= 0 && 
                  earningsData.dailyCosts < earningsData.dailySales;
          break;

        case 3: // AI Demo
          valid = true; // Demo step is always valid
          break;

        default:
          valid = false;
      }

      setErrors(newErrors);
      setIsValid(valid);
    };

    validateStep();
  }, [step, businessData, earningsData]);

  return { isValid, errors };
};