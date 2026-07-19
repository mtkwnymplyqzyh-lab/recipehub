import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const SEEN_KEY = 'recipehub_onboarding_seen';

export interface TourStep {
  /** CSS selector of the element to spotlight. Omitted for standalone steps
   *  (e.g. "install the app") that aren't tied to an on-page element. */
  selector?: string;
  id?: string;
  title: string;
  text: string;
  requiresAuth?: boolean;
}

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

// Ordered to match the page's actual top-to-bottom layout: the sticky
// navbar (profile link) sits above everything, then the hero's create-
// recipe button, then the search box, then the category filter row.
const ALL_STEPS: TourStep[] = [
  { selector: '[data-tour="profile-link"]', title: 'הפרופיל שלכם', text: 'כאן תמצאו את כל המתכונים והמועדפים שלכם במקום אחד.', requiresAuth: true },
  { selector: '[data-tour="create-recipe"]', title: 'הוספת מתכון', text: 'כאן תוכלו לשתף מתכון חדש משלכם עם כולם.' },
  { selector: '[data-tour="search"]', title: 'חיפוש מהיר', text: 'חפשו מתכון לפי שם או רכיב, בכל רגע שתרצו.' },
  { selector: '[data-tour="categories"]', title: 'סינון לפי קטגוריה', text: 'לחצו על קטגוריה כדי לראות רק מתכונים מהסוג הזה.' },
  { id: 'install', title: 'התקנת האפליקציה', text: '' },
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

  const steps = ALL_STEPS.filter(s => {
    if (s.requiresAuth && !user) return false;
    if (s.id === 'install' && isStandaloneDisplay()) return false;
    return true;
  });

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
