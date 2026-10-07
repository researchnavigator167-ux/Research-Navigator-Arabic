import { Chrome as Home, FolderOpen, Compass, Bot, User, GraduationCap } from 'lucide-react';
import { useApp } from '@/lib/AppContext';

type Tab = 'home' | 'research' | 'discover' | 'assistant' | 'classroom' | 'account';

interface BottomNavProps {
  active: Tab;
  onChange: (tab: Tab) => void;
}

export function BottomNav({ active, onChange }: BottomNavProps) {
  const { t } = useApp();

  const tabs: { id: Tab; icon: typeof Home; label: string }[] = [
    { id: 'home', icon: Home, label: t('navHome') },
    { id: 'research', icon: FolderOpen, label: t('navResearch') },
    { id: 'discover', icon: Compass, label: t('navDiscover') },
    { id: 'assistant', icon: Bot, label: t('navAssistant') },
    { id: 'classroom', icon: GraduationCap, label: t('navClassroom') },
    { id: 'account', icon: User, label: t('navAccount') },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-t border-neutral-200 dark:border-neutral-800 pb-safe-bottom">
      <div className="max-w-md mx-auto flex items-center justify-around px-1 py-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl transition-all no-tap-select"
            >
              <div className={`relative transition-all ${isActive ? 'scale-110' : 'scale-100'}`}>
                <Icon
                  className={`w-5 h-5 transition-colors ${
                    isActive ? 'text-primary-700 dark:text-primary-400' : 'text-neutral-400 dark:text-neutral-500'
                  }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {isActive && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-700 dark:bg-primary-400" />
                )}
              </div>
              <span
                className={`text-[9px] font-medium transition-colors ${
                  isActive ? 'text-primary-700 dark:text-primary-400' : 'text-neutral-400 dark:text-neutral-500'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export type { Tab };
