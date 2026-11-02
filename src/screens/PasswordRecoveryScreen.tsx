import { useState } from 'react';
import { Lock, CheckCircle2 } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';
import { useApp } from '@/lib/AppContext';

export function PasswordRecoveryScreen() {
  const { updatePassword } = useAuth();
  const { t } = useApp();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError(t('passwordTooShort'));
      return;
    }
    if (password !== confirmation) {
      setError(t('passwordMismatch'));
      return;
    }

    setLoading(true);
    const result = await updatePassword(password);
    setLoading(false);
    if (result.error) {
      setError(t('passwordUpdateError'));
      return;
    }
    setSaved(true);
  };

  if (saved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-6">
        <div className="card w-full max-w-md text-center">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-success-600" />
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">{t('passwordUpdated')}</h1>
          <p className="mt-2 text-sm text-neutral-500">{t('passwordUpdatedDesc')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-6">
      <div className="card w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-700 text-white">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">{t('chooseNewPassword')}</h1>
          <p className="mt-2 text-sm text-neutral-500">{t('chooseNewPasswordDesc')}</p>
        </div>

        {error && <p className="mb-4 rounded-xl bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-900/20 dark:text-error-400">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('newPassword')}
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input-field mt-1.5"
            />
          </label>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('confirmPassword')}
            <input
              type="password"
              required
              minLength={6}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="input-field mt-1.5"
            />
          </label>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Spinner size="sm" /> : t('saveNewPassword')}
          </button>
        </form>
      </div>
    </div>
  );
}
