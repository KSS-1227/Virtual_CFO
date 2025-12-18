import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface OnboardingState {
  currentStep: number;
  completedSteps: number[];
  businessData: {
    name: string;
    type: string;
    location: string;
    size: string;
    phone: string;
  };
  earningsData: {
    dailySales: number;
    dailyCosts: number;
    profitMargin: number;
  };
  isCompleted: boolean;
  startTime: number;
}

interface OnboardingStore extends OnboardingState {
  setCurrentStep: (step: number) => void;
  completeStep: (step: number) => void;
  updateBusinessData: (data: Partial<OnboardingState['businessData']>) => void;
  updateEarningsData: (data: Partial<OnboardingState['earningsData']>) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  getTimeSpent: () => number;
}

export const useOnboardingProgress = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      currentStep: 1,
      completedSteps: [],
      businessData: {
        name: '',
        type: '',
        location: '',
        size: 'small',
        phone: ''
      },
      earningsData: {
        dailySales: 0,
        dailyCosts: 0,
        profitMargin: 0
      },
      isCompleted: false,
      startTime: Date.now(),

      setCurrentStep: (step) => set({ currentStep: step }),
      
      completeStep: (step) => set((state) => ({
        completedSteps: [...new Set([...state.completedSteps, step])]
      })),
      
      updateBusinessData: (data) => set((state) => ({
        businessData: { ...state.businessData, ...data }
      })),
      
      updateEarningsData: (data) => set((state) => ({
        earningsData: { ...state.earningsData, ...data }
      })),
      
      completeOnboarding: () => set({ isCompleted: true }),
      
      resetOnboarding: () => set({
        currentStep: 1,
        completedSteps: [],
        businessData: { name: '', type: '', location: '', size: 'small', phone: '' },
        earningsData: { dailySales: 0, dailyCosts: 0, profitMargin: 0 },
        isCompleted: false,
        startTime: Date.now()
      }),
      
      getTimeSpent: () => Math.floor((Date.now() - get().startTime) / 1000)
    }),
    {
      name: 'onboarding-progress',
      storage: createJSONStorage(() => localStorage)
    }
  )
);