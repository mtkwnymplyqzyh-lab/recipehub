import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const SEEN_KEY = 'recipehub_onboarding_seen';

export interface TourStep {
  selector: string;
  title: string;
  text: string;
  requiresAuth?: boolean;
}

const ALL_STEPS: TourStep[] = [
  { selector: '[data-tour="search"]', title: 'חיפוש מהיר', text: 'חפשו מתכון לפי שם או רכיב, בכל רגע שתרצו.' },
  { selector: '[data-tour="categories"]', title: 'סינון לפי קטגוריה', text: 'לחצו על קטגוריה כדי לראות רק מתכונים מהסוג הזה.' },
  { selector: '[data-tour="create-recipe"]', title: 'הוספת מתכון', text: 'כאן תוכלו לשתף מתכון חדש משלכם עם כולם.' },
  { selector: '[data-tour="profile-link"]', title: 'הפרופיל שלכם', text: 'כאן תמצאו את כל המתכונים והמועדפים שלכם במקום אחד.', requiresAuth: true },
];

interface OnboardingTourContextType {
  isActive: boolean;
  stepIndex: number;
  steps: TourStep[];
  next: () => void;
  skip: () => void;
  start: () => void;
  startIfNotSeen: () => void;
}

const OnboardingTourContext = createContext<OnboardingTourContextType | undefined>(undefined);

export function OnboardingTourProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = ALL_STEPS.filter(s => !s.requiresAuth || !!user);

  const finish = useCallback(() => {
    setIsActive(false);
    localStorage.setItem(SEEN_KEY, 'true');
  }, []);

  const start = useCallback(() => {
    setStepIndex(0);
    setIsActive(true);
  }, []);

  const startIfNotSeen = useCallback(() => {
    if (!localStorage.getItem(SEEN_KEY)) start();
  }, [start]);

  const next = useCallback(() => {
    setStepIndex(prev => {
      if (prev + 1 >= steps.length) {
        finish();
        return prev;
      }
      return prev + 1;
    });
  }, [steps.length, finish]);

  useEffect(() => {
    if (isActive && stepIndex >= steps.length) finish();
  }, [isActive, stepIndex, steps.length, finish]);

  return (
    <OnboardingTourContext.Provider value={{ isActive, stepIndex, steps, next, skip: finish, start, startIfNotSeen }}>
      {children}
    </OnboardingTourContext.Provider>
  );
}

export function useOnboardingTour() {
  const context = useContext(OnboardingTourContext);
  if (context === undefined) {
    throw new Error('useOnboardingTour must be used within an OnboardingTourProvider');
  }
  return { ...context, restart: context.start };
}
