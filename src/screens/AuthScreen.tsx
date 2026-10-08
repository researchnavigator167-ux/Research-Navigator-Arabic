import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useApp } from '@/lib/AppContext';
import { BookOpen, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { Spinner } from '@/components/ui';

export function AuthScreen() {
  const { signIn, signUp, resetPassword } = useAuth();
  const { t, isRTL } = useApp();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) setError(mapSignInError(error));
      } else if (mode === 'register') {
        if (password !== confirmPassword) {
          setError('كلمتا المرور غير متطابقتين');
          return;
        }
        if (password.length < 6) {
          setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
          return;
        }
        const { error } = await signUp(email, password);
        if (error) {
          setError(mapSignUpError(error));
        } else {
          setSuccess(t('registerSuccess'));
          setMode('login');
        }
      } else if (mode === 'reset') {
        const { error } = await resetPassword(email);
        if (error) {
          setError('تعذر إرسال رابط إعادة التعيين');
        } else {
          setSuccess(t('resetSent'));
        }
      }
    } catch {
      setError(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const ArrowIcon = isRTL ? ArrowRight : ArrowRight;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-primary-50 to-white dark:from-neutral-950 dark:to-neutral-900">
      <div className="flex-1 flex flex-col justify-center px-6 py-8 max-w-md w-full mx-auto">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-700 text-white mb-4 shadow-lg shadow-primary-700/20">
            <BookOpen className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">{t('appName')}</h1>
          <p className="text-sm text-neutral-500 mt-2">{t('appTagline')}</p>
        </div>

        {/* Form Card */}
        <div className="card animate-slide-up">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-6 text-center">
            {mode === 'login' ? t('loginToContinue') : mode === 'register' ? t('createAccount') : t('resetPassword')}
          </h2>

          {error && (
            <div className="mb-4 rounded-xl bg-error-50 border border-error-100 px-4 py-3 text-sm text-error-700 dark:bg-error-900/20 dark:border-error-900/30 dark:text-error-400 animate-slide-down">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-xl bg-success-50 border border-success-100 px-4 py-3 text-sm text-success-700 dark:bg-success-900/20 dark:border-success-900/30 dark:text-success-400 animate-slide-down">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                {t('email')}
              </label>
              <div className="relative">
                <Mail className="absolute top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 ltr:left-3 rtl:right-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field ltr:pl-10 rtl:pr-10"
                  placeholder="researcher@university.edu"
                  dir="ltr"
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  {t('password')}
                </label>
                <div className="relative">
                  <Lock className="absolute top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 ltr:left-3 rtl:right-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field ltr:pl-10 ltr:pr-10 rtl:pr-10 rtl:pl-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 ltr:right-3 rtl:left-3"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  {t('confirmPassword')}
                </label>
                <div className="relative">
                  <Lock className="absolute top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 ltr:left-3 rtl:right-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-field ltr:pl-10 ltr:pr-10 rtl:pr-10 rtl:pl-10"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            {mode === 'login' && (
              <div className="text-end">
                <button
                  type="button"
                  onClick={() => { setMode('reset'); setError(null); setSuccess(null); }}
                  className="text-xs text-primary-700 hover:text-primary-800 dark:text-primary-400"
                >
                  {t('forgotPassword')}
                </button>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <Spinner size="sm" /> : (
                <>
                  {mode === 'login' ? t('login') : mode === 'register' ? t('createAccount') : t('sendResetLink')}
                  <ArrowIcon className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm">
            {mode === 'login' && (
              <p className="text-neutral-500">
                {t('noAccount')}{' '}
                <button onClick={() => { setMode('register'); setError(null); setSuccess(null); }} className="font-semibold text-primary-700 hover:text-primary-800 dark:text-primary-400">
                  {t('register')}
                </button>
              </p>
            )}
            {mode === 'register' && (
              <p className="text-neutral-500">
                {t('haveAccount')}{' '}
                <button onClick={() => { setMode('login'); setError(null); setSuccess(null); }} className="font-semibold text-primary-700 hover:text-primary-800 dark:text-primary-400">
                  {t('login')}
                </button>
              </p>
            )}
            {mode === 'reset' && (
              <p className="text-neutral-500">
                <button onClick={() => { setMode('login'); setError(null); setSuccess(null); }} className="font-semibold text-primary-700 hover:text-primary-800 dark:text-primary-400">
                  {t('login')}
                </button>
              </p>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-neutral-400 mt-6">
          {t('aboutText')}
        </p>
      </div>
    </div>
  );
}

function mapSignUpError(code: string): string {
  switch (code) {
    case 'EMAIL_ALREADY_REGISTERED':
      return 'البريد الإلكتروني مستخدم بالفعل. حاول تسجيل الدخول أو استخدم بريدًا آخر.';
    case 'WEAK_PASSWORD':
      return 'كلمة المرور ضعيفة. استخدم 6 أحرف على الأقل مع أرقام ورموز.';
    case 'INVALID_EMAIL':
      return 'البريد الإلكتروني غير صالح.';
    case 'RATE_LIMITED':
      return 'تم تجاوز عدد المحاولات المسموح. حاول مرة أخرى لاحقًا.';
    case 'NETWORK_ERROR':
      return 'تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.';
    case 'EMAIL_CONFIRMATION_REQUIRED':
      return 'تم إنشاء الحساب. يرجى تأكيد بريدك الإلكتروني قبل تسجيل الدخول.';
    default:
      return 'تعذر إنشاء الحساب. تحقق من البيانات وحاول مرة أخرى.';
  }
}

function mapSignInError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid credentials') || m.includes('invalid login'))
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  if (m.includes('email not confirmed'))
    return 'يرجى تأكيد بريدك الإلكتروني قبل تسجيل الدخول.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'تم تجاوز عدد المحاولات. حاول لاحقًا.';
  if (m.includes('network') || m.includes('fetch'))
    return 'تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.';
  return 'تعذر تسجيل الدخول. تحقق من البيانات وحاول مرة أخرى.';
}
