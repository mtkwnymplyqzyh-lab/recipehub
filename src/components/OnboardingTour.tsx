import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useOnboardingTour } from '../hooks/useOnboardingTour';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;

export function OnboardingTour() {
  const { isActive, stepIndex, steps, next, skip } = useOnboardingTour();
  const [rect, setRect] = useState<Rect | null>(null);
  const step = steps[stepIndex];

  useEffect(() => {
    if (!isActive || !step) {
      setRect(null);
      return;
    }

    let frame: number;
    const measure = () => {
      const el = document.querySelector(step.selector);
      if (!el) {
        // Target isn't on this page/route yet — skip forward instead of
        // showing a spotlight with nothing to point at.
        next();
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top - PADDING,
        left: r.left - PADDING,
        width: r.width + PADDING * 2,
        height: r.height + PADDING * 2,
      });
    };

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    frame = requestAnimationFrame(measure);

    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, stepIndex, step]);

  if (!isActive || !step || !rect) return null;

  const bubbleBelow = rect.top < window.innerHeight / 2;
  const bubbleTop = bubbleBelow ? rect.top + rect.height + 12 : rect.top - 12;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9997] pointer-events-none"
        style={{ boxShadow: '0 0 0 9999px rgba(28, 20, 26, 0.65)' }}
        aria-hidden="true"
      />
      <motion.div
        key={stepIndex}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{
          opacity: 1,
          scale: 1,
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed rounded-2xl ring-4 ring-primary-400 z-[9998] pointer-events-none"
        aria-hidden="true"
      />
      <motion.div
        key={`bubble-${stepIndex}`}
        initial={{ opacity: 0, y: bubbleBelow ? -8 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="fixed z-[9999] w-[90vw] max-w-sm bg-[var(--card)] rounded-2xl shadow-2xl p-6 space-y-4"
        style={{
          top: bubbleBelow ? bubbleTop : undefined,
          bottom: bubbleBelow ? undefined : window.innerHeight - bubbleTop,
          left: '50%',
          transform: 'translateX(-50%)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
      >
        <button
          onClick={skip}
          className="absolute left-4 top-4 p-1 text-stone-400 hover:text-stone-900 transition-colors"
          aria-label="דילוג על הסיור"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-primary-500">
            שלב {stepIndex + 1} מתוך {steps.length}
          </p>
          <h3 id="tour-step-title" className="font-serif text-xl font-bold text-[var(--foreground)]">
            {step.title}
          </h3>
        </div>
        <p className="text-stone-500 dark:text-stone-400 font-medium leading-relaxed">{step.text}</p>
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={skip}
            className="text-stone-400 font-bold text-sm hover:text-stone-600 transition-colors"
          >
            דילוג
          </button>
          <button
            onClick={next}
            className="bg-primary-500 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-primary-600 transition-all active:scale-95"
          >
            {stepIndex + 1 === steps.length ? 'סיימתי' : 'הבא'}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
