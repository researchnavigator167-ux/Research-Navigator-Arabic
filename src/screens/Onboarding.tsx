import { useState } from 'react';
import { useApp } from '@/lib/AppContext';
import { BookOpen, Search, FileText, LayoutGrid, GitBranch, HelpCircle, ClipboardList, ShieldCheck, ArrowRight } from 'lucide-react';

const capabilities = [
  { icon: Search, key: 'onboardingCap1' },
  { icon: FileText, key: 'onboardingCap2' },
  { icon: LayoutGrid, key: 'onboardingCap3' },
  { icon: GitBranch, key: 'onboardingCap4' },
  { icon: HelpCircle, key: 'onboardingCap5' },
  { icon: ClipboardList, key: 'onboardingCap6' },
  { icon: ShieldCheck, key: 'onboardingCap7' },
];

export function Onboarding({ onFinish }: { onFinish: () => void }) {
  const { t, isRTL } = useApp();
  const [step, setStep] = useState(0);

  const handleNext = () => {
    if (step < capabilities.length - 1) {
      setStep(step + 1);
    } else {
      onFinish();
    }
  };

  const handleSkip = () => onFinish();

  const CapIcon = capabilities[step].icon;
  const ArrowIcon = ArrowRight;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-primary-50 to-white dark:from-neutral-950 dark:to-neutral-900">
      <div className="flex justify-end p-4">
        <button onClick={handleSkip} className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300">
          {t('onboardingSkip')}
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-md w-full mx-auto">
        {/* Logo */}
        <div className="text-center mb-8 animate-scale-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary-700 text-white mb-6 shadow-xl shadow-primary-700/20">
            <BookOpen className="w-10 h-10" />
          </div>
        </div>

        {/* Step Content */}
        <div key={step} className="text-center animate-slide-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 mb-6">
            <CapIcon className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">
            {t(capabilities[step].key)}
          </h2>
        </div>

        {step === 0 && (
          <p className="text-sm text-neutral-500 text-center max-w-xs mt-4 animate-fade-in">
            {t('onboardingTitle')}
          </p>
        )}

        {/* Progress Dots */}
        <div className="flex gap-2 mt-12">
          {capabilities.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6 bg-primary-700' : 'w-1.5 bg-neutral-300 dark:bg-neutral-700'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="p-6 max-w-md w-full mx-auto">
        <button onClick={handleNext} className="btn-primary w-full">
          {step < capabilities.length - 1 ? t('next') : t('onboardingStart')}
          <ArrowIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
