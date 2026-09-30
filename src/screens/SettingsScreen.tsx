import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useApp } from '@/lib/AppContext';
import { useTheme } from '@/lib/ThemeContext';
import {
  Globe, Moon, Sun, Monitor, Bell, Lock, Database, Info,
  LogOut, Trash2, ChevronRight, BookOpen, Type,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { Language } from '@/lib/i18n';
import type { Theme } from '@/lib/ThemeContext';

export function SettingsScreen() {
  const { user, signOut, deleteAccount } = useAuth();
  const { t, lang, setLang } = useApp();
  const { theme, setTheme } = useTheme();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);

  const handleDelete = async () => {
    await deleteAccount();
    setShowDeleteConfirm(false);
  };

  return (
    <div className="min-h-screen pb-24 bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 px-5 pt-12 pb-4 border-b border-neutral-100 dark:border-neutral-800 sticky top-0 z-30">
        <h1 className="text-xl font-bold text-neutral-900 dark:text-white">{t('settings')}</h1>
      </div>

      <div className="px-5 py-4 space-y-6">
        {/* Profile */}
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary-700 flex items-center justify-center text-white font-bold text-lg">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">{user?.email}</p>
              <p className="text-xs text-neutral-500">{t('welcomeBack')}</p>
            </div>
          </div>
        </div>

        {/* Language */}
        <SettingsSection title={t('language')}>
          <SettingsRow
            icon={<Globe className="w-5 h-5 text-primary-700 dark:text-primary-400" />}
            label={t('language')}
            value={lang === 'ar' ? 'العربية' : 'English'}
            onClick={() => setShowLanguage(true)}
          />
        </SettingsSection>

        {/* Appearance */}
        <SettingsSection title={t('appearance')}>
          <div className="px-4 py-3">
            <div className="grid grid-cols-3 gap-2">
              {([
                { val: 'light' as Theme, label: t('themeLight'), icon: Sun },
                { val: 'dark' as Theme, label: t('themeDark'), icon: Moon },
                { val: 'system' as Theme, label: t('themeSystem'), icon: Monitor },
              ]).map((opt) => {
                const Icon = opt.icon;
                const active = theme === opt.val;
                return (
                  <button
                    key={opt.val}
                    onClick={() => setTheme(opt.val)}
                    className={`flex flex-col items-center gap-2 py-3 rounded-xl transition-all ${
                      active
                        ? 'bg-primary-700 text-white'
                        : 'bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </SettingsSection>

        {/* Account */}
        <SettingsSection title={t('account')}>
          <SettingsRow
            icon={<LogOut className="w-5 h-5 text-neutral-500" />}
            label={t('logout')}
            onClick={signOut}
          />
          <SettingsRow
            icon={<Trash2 className="w-5 h-5 text-error-500" />}
            label={t('deleteAccount')}
            onClick={() => setShowDeleteConfirm(true)}
            danger
          />
        </SettingsSection>

        {/* About */}
        <SettingsSection title={t('about')}>
          <div className="px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-700 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-neutral-900 dark:text-white">{t('appName')}</p>
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{t('aboutText')}</p>
                <p className="text-xs text-neutral-400 mt-2">{t('version')} 1.0.0</p>
              </div>
            </div>
          </div>
        </SettingsSection>
      </div>

      {/* Language Modal */}
      <Modal open={showLanguage} onClose={() => setShowLanguage(false)} title={t('language')} size="sm">
        <div className="space-y-2">
          {([
            { val: 'ar' as Language, label: 'العربية' },
            { val: 'en' as Language, label: 'English' },
          ]).map((opt) => (
            <button
              key={opt.val}
              onClick={() => { setLang(opt.val); setShowLanguage(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                lang === opt.val
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                  : 'hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
              }`}
            >
              <span className="text-sm font-medium">{opt.label}</span>
              {lang === opt.val && <div className="w-5 h-5 rounded-full bg-primary-700 flex items-center justify-center">
                <span className="text-white text-xs">✓</span>
              </div>}
            </button>
          ))}
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title={t('deleteAccount')} size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-error-50 dark:bg-error-900/20 px-4 py-3">
            <Trash2 className="w-5 h-5 text-error-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-error-700 dark:text-error-400">{t('deleteAccountConfirm')}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowDeleteConfirm(false)} className="btn-ghost flex-1 text-sm">
              {t('cancel')}
            </button>
            <button onClick={handleDelete} className="btn-primary flex-1 text-sm bg-error-600 hover:bg-error-700">
              {t('deleteAccount')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-bold text-neutral-400 uppercase mb-2 px-1">{title}</h2>
      <div className="card overflow-hidden p-0 divide-y divide-neutral-100 dark:divide-neutral-800">
        {children}
      </div>
    </div>
  );
}

function SettingsRow({
  icon, label, value, onClick, danger,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  const { isRTL } = useApp();
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors text-start"
    >
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${danger ? 'text-error-600 dark:text-error-400' : 'text-neutral-900 dark:text-white'}`}>{label}</p>
      </div>
      {value && <span className="text-xs text-neutral-400">{value}</span>}
      <ChevronRight className={`w-4 h-4 text-neutral-300 ${isRTL ? 'rotate-180' : ''}`} />
    </button>
  );
}
