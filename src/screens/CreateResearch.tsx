import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useApp } from '@/lib/AppContext';
import { callEdgeFunction } from '@/lib/api';
import { Sparkles, Plus, X, ArrowRight, Loader2 } from 'lucide-react';
import type { QueryExpansion, ResearchProject } from '@/types';

interface CreateResearchProps {
  onCreated: (project: ResearchProject) => void;
  onCancel: () => void;
}

const FIELDS = [
  'علم النفس', 'التربية', 'العلوم الاجتماعية', 'الطب', 'العلوم الإنسانية',
  'إدارة الأعمال', 'الهندسة', 'علوم الحاسب', 'الاقتصاد', 'القانون',
  'الإعلام', 'العلوم السياسية', 'الصحة العامة', 'البيئة',
];

export function CreateResearch({ onCreated, onCancel }: CreateResearchProps) {
  const { user } = useAuth();
  const { t, isRTL } = useApp();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [expansion, setExpansion] = useState<QueryExpansion | null>(null);

  const [form, setForm] = useState({
    title: '',
    topic: '',
    field: '',
    language: 'ar',
    description: '',
    research_question: '',
    keywords: [] as string[],
  });
  const [keywordInput, setKeywordInput] = useState('');

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const addKeyword = (kw: string) => {
    const trimmed = kw.trim();
    if (trimmed && !form.keywords.includes(trimmed)) {
      setForm((f) => ({ ...f, keywords: [...f.keywords, trimmed] }));
    }
    setKeywordInput('');
  };

  const removeKeyword = (kw: string) => {
    setForm((f) => ({ ...f, keywords: f.keywords.filter((k) => k !== kw) }));
  };

  const handleExpand = async () => {
    if (!form.topic && !form.research_question) return;
    setExpanding(true);
    try {
      const query = form.research_question || form.topic;
      const data = await callEdgeFunction<QueryExpansion>('query-expand', { query, field: form.field });
      setExpansion(data);
    } catch {
      // ignore
    } finally {
      setExpanding(false);
    }
  };

  const applyExpansion = () => {
    if (!expansion) return;
    setForm((f) => ({
      ...f,
      keywords: [...new Set([...f.keywords, ...expansion.keywords, ...expansion.englishTerms])],
      research_question: f.research_question || expansion.researchQuestions[0] || '',
    }));
  };

  const handleSave = async () => {
    if (!form.title || !form.topic) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('research_projects')
        .insert({
          title: form.title,
          topic: form.topic,
          field: form.field || null,
          language: form.language,
          description: form.description || null,
          research_question: form.research_question || null,
          keywords: form.keywords,
        })
        .select('*')
        .single();

      if (error) throw error;
      if (data) onCreated(data as ResearchProject);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const ArrowIcon = ArrowRight;
  const arrowClass = isRTL ? 'rotate-180' : '';
  const canNext1 = form.title.trim() && form.topic.trim();

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 px-5 pt-12 pb-4 border-b border-neutral-100 dark:border-neutral-800 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <button onClick={onCancel} className="w-10 h-10 flex items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold text-neutral-900 dark:text-white">{t('createTitle')}</h1>
          <div className="w-10" />
        </div>
        {/* Step indicator */}
        <div className="flex items-center gap-2 mt-4">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-1 rounded-full flex-1 transition-all ${
                s <= step ? 'bg-primary-700 dark:bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="px-5 py-6 pb-24">
        {step === 1 && (
          <div className="space-y-4 animate-slide-up">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                {t('researchTitle')} <span className="text-error-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                className="input-field"
                placeholder="مثال: تأثير وسائل التواصل الاجتماعي على القلق"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                {t('researchTopic')} <span className="text-error-500">*</span>
              </label>
              <textarea
                value={form.topic}
                onChange={(e) => update('topic', e.target.value)}
                className="input-field min-h-[80px] resize-none"
                placeholder="اكتب موضوع البحث بشكل مختصر..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                {t('researchField')}
              </label>
              <select
                value={form.field}
                onChange={(e) => update('field', e.target.value)}
                className="input-field"
              >
                <option value="">{t('selectField')}</option>
                {FIELDS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                {t('researchLanguage')}
              </label>
              <div className="flex gap-3">
                {[
                  { val: 'ar', label: 'العربية' },
                  { val: 'en', label: 'English' },
                ].map((l) => (
                  <button
                    key={l.val}
                    onClick={() => update('language', l.val)}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                      form.language === l.val
                        ? 'bg-primary-700 text-white'
                        : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-800'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                {t('researchDescription')} <span className="text-neutral-400">({t('optional')})</span>
              </label>
              <textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                className="input-field min-h-[60px] resize-none"
                placeholder="وصف مختصر لبحثك..."
              />
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!canNext1}
              className="btn-primary w-full"
            >
              {t('next')}
              <ArrowIcon className={`w-4 h-4 ${arrowClass}`} />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 animate-slide-up">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                {t('researchQuestion')}
              </label>
              <textarea
                value={form.research_question}
                onChange={(e) => update('research_question', e.target.value)}
                className="input-field min-h-[80px] resize-none"
                placeholder="مثال: ما العلاقة بين استخدام وسائل التواصل الاجتماعي والقلق لدى طلاب الجامعة؟"
              />
              <button
                onClick={handleExpand}
                disabled={expanding || (!form.topic && !form.research_question)}
                className="mt-2 btn-secondary w-full"
              >
                {expanding ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {t('aiExpanding')}</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> {t('aiExpand')}</>
                )}
              </button>
            </div>

            {/* AI Expansion Results */}
            {expansion && (
              <div className="card bg-primary-50/50 dark:bg-primary-900/10 border-primary-100 dark:border-primary-900/30 animate-scale-in">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary-700 dark:text-primary-400" />
                    <span className="text-sm font-bold text-primary-800 dark:text-primary-300">{t('aiAssist')}</span>
                  </div>
                  <button onClick={applyExpansion} className="text-xs font-semibold text-primary-700 dark:text-primary-400 hover:underline">
                    {t('add')}
                  </button>
                </div>

                {expansion.concepts.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-neutral-500 mb-1.5">{t('mainConcepts')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {expansion.concepts.map((c) => (
                        <span key={c} className="badge bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">{c}</span>
                      ))}
                    </div>
                  </div>
                )}

                {expansion.englishTerms.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-neutral-500 mb-1.5">{t('englishTerms')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {expansion.englishTerms.map((c) => (
                        <span key={c} className="badge bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400 ltr-text">{c}</span>
                      ))}
                    </div>
                  </div>
                )}

                {expansion.researchQuestions.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-neutral-500 mb-1.5">{t('potentialQuestions')}</p>
                    <ul className="space-y-1.5">
                      {expansion.researchQuestions.map((q) => (
                        <li key={q} className="text-xs text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 rounded-lg px-3 py-2">
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {expansion.axes.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-neutral-500 mb-1.5">{t('researchAxes')}</p>
                    <ul className="space-y-1.5">
                      {expansion.axes.map((a) => (
                        <li key={a} className="text-xs text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 rounded-lg px-3 py-2">
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Keywords */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                {t('researchKeywords')}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addKeyword(keywordInput);
                    }
                  }}
                  className="input-field flex-1"
                  placeholder="أضف كلمة مفتاحية واضغط Enter..."
                />
                <button
                  onClick={() => addKeyword(keywordInput)}
                  className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0"
                >
                  <Plus className="w-5 h-5 text-primary-700 dark:text-primary-400" />
                </button>
              </div>
              {form.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {form.keywords.map((kw) => (
                    <span key={kw} className="badge bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 gap-1.5">
                      {kw}
                      <button onClick={() => removeKeyword(kw)}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(1)} className="btn-ghost flex-1">
                {t('back')}
              </button>
              <button onClick={handleSave} disabled={saving || !form.title} className="btn-primary flex-1">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('save')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
