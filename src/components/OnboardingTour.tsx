import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X, Download, Share } from 'lucide-react';
import { useOnboardingTour } from '../hooks/useOnboardingTour';
import { usePwaInstall } from '../hooks/usePwaInstall';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;
const VIEWPORT_MARGIN = 16;

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function InstallInstructions() {
  const { canInstall, promptInstall } = usePwaInstall();

  if (canInstall) {
    return (
      <>
        <p className="text-stone-500 dark:text-stone-400 font-medium leading-relaxed">
          אפשר להתקין את RecipeHub כאפליקציה על מסך הבית, ולפתוח אותו כמו כל אפליקציה אחרת.
        </p>
        <button
          onClick={promptInstall}
          className="w-full bg-primary-500 text-white py-3 rounded-xl font-bold hover:bg-primary-600 transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          התקנה עכשיו
        </button>
      </>
    );
  }

  if (isIOS()) {
    return (
      <p className="text-stone-500 dark:text-stone-400 font-medium leading-relaxed flex items-start gap-2">
        <Share className="w-4 h-4 flex-none mt-1" aria-hidden="true" />
        <span>
          באייפון: לחצו על כפתור <b>השיתוף</b> בסרגל הדפדפן, ואז על <b>"הוספה למסך הבית"</b>.
        </span>
      </p>
    );
  }

  return (
    <p className="text-stone-500 dark:text-stone-400 font-medium leading-relaxed">
      לחצו על שלוש הנקודות בפינת הדפדפן ובחרו <b>"התקנת אפליקציה"</b> או <b>"הוספה למסך הבית"</b>.
    </p>
  );
}

export function OnboardingTour() {
  const { isActive, stepIndex, steps, next, skip } = useOnboardingTour();
  const [rect, setRect] = useState<Rect | null>(null);
  const step = steps[stepIndex];
  const isStandaloneStep = !!step && !step.selector;

  useEffect(() => {
    if (!isActive || !step || isStandaloneStep) {
      setRect(null);
      return;
    }

    let frame: number;
    const measure = () => {
      const el = document.querySelector(step.selector!);
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
  }, [isActive, stepIndex, step, isStandaloneStep]);

  if (!isActive || !step) return null;
  if (!isStandaloneStep && !rect) return null;

  const bubbleWidth = Math.min(window.innerWidth - VIEWPORT_MARGIN * 2, 380);
  const bubbleLeft = Math.max(VIEWPORT_MARGIN, (window.innerWidth - bubbleWidth) / 2);

  // Anchor below the target if there's more room below than above; then
  // clamp so the bubble can never render partly off-screen top/bottom.
  let bubbleTop: number;
  if (rect) {
    const spaceBelow = window.innerHeight - (rect.top + rect.height);
    const spaceAbove = rect.top;
    const preferBelow = spaceBelow >= spaceAbove;
    bubbleTop = preferBelow ? rect.top + rect.height + 12 : rect.top - 220;
    bubbleTop = Math.max(VIEWPORT_MARGIN, Math.min(bubbleTop, window.innerHeight - VIEWPORT_MARGIN - 200));
  } else {
    bubbleTop = window.innerHeight / 2 - 120;
  }

  return createPortal(
    <AnimatePresence>
      {rect && (
        <motion.div
          key={`spotlight-${stepIndex}`}
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
          exit={{ opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed rounded-2xl z-[9997] pointer-events-none"
          style={{ boxShadow: '0 0 0 4px #8B3A6E, 0 0 0 9999px rgba(28, 20, 26, 0.65)' }}
          aria-hidden="true"
        />
      )}
      {!rect && (
        <motion.div
          key="spotlight-standalone"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-stone-900/65 z-[9997] pointer-events-none"
          aria-hidden="true"
        />
      )}
      <motion.div
        key={`bubble-${stepIndex}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, top: bubbleTop }}
        exit={{ opacity: 0 }}
        className="fixed z-[9999] bg-[var(--card)] rounded-2xl shadow-2xl p-6 space-y-4"
        style={{ width: bubbleWidth, left: bubbleLeft }}
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
        {step.id === 'install' ? <InstallInstructions /> : (
          <p className="text-stone-500 dark:text-stone-400 font-medium leading-relaxed">{step.text}</p>
        )}
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
