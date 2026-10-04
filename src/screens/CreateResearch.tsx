import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/lib/AppContext';
import { callEdgeFunction } from '@/lib/api';
import { Sparkles, Plus, X, ArrowRight, Loader2, Search, Bookmark, Check, ExternalLink, FileText } from 'lucide-react';
import { openExternalUrl } from '@/lib/native';
import { EmptyState } from '@/components/ui';
import type { QueryExpansion, ResearchProject, SearchResult } from '@/types';

interface CreateResearchProps {
  onCreated: (project: ResearchProject) => void;
  onCancel: () => void;
}

const FIELDS = [
  'علم النفس', 'التربية', 'العلوم الاجتماعية', 'الطب', 'العلوم الإنسانية',
  'إدارة الأعمال', 'الهندسة', 'علوم الحاسب', 'الاقتصاد', 'القانون',
  'الإعلام', 'العلوم السياسية', 'الصحة العامة', 'البيئة',
];

const TOTAL_STEPS = 4;

export function CreateResearch({ onCreated, onCancel }: CreateResearchProps) {
  const { t, isRTL } = useApp();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [expansion, setExpansion] = useState<QueryExpansion | null>(null);
  const [createdProject, setCreatedProject] = useState<ResearchProject | null>(null);
  const [savedSourceCount, setSavedSourceCount] = useState(0);

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
      // ignore — user can still proceed without AI expansion
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

  // Step 2: create the project once, then advance to step 3
  const handleCreateAndAdvance = async () => {
    if (!form.title || !form.topic || saving) return;
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
      if (data) {
        setCreatedProject(data as ResearchProject);
        setStep(3);
      }
    } catch {
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
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
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
        {/* ==================== STEP 1: Basic Data ==================== */}
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

        {/* ==================== STEP 2: Research Question + Keywords ==================== */}
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
              <button onClick={() => setStep(1)} disabled={saving} className="btn-ghost flex-1">
                {t('back')}
              </button>
              <button
                onClick={handleCreateAndAdvance}
                disabled={saving || !canNext1}
                className="btn-primary flex-1"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {t('loading')}</>
                ) : (
                  <>
                    {t('next')}
                    <ArrowIcon className={`w-4 h-4 ${arrowClass}`} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ==================== STEP 3: Academic Search ==================== */}
        {step === 3 && createdProject && (
          <Step3Search
            project={createdProject}
            savedCount={savedSourceCount}
            onSavedCountChange={setSavedSourceCount}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}

        {/* ==================== STEP 4: Review & Enter Workspace ==================== */}
        {step === 4 && createdProject && (
          <Step4Review
            project={createdProject}
            savedSourceCount={savedSourceCount}
            onBack={() => setStep(3)}
            onEnter={() => onCreated(createdProject)}
          />
        )}
      </div>
    </div>
  );
}

// ==================== STEP 3: Academic Search ====================
function Step3Search({
  project,
  savedCount,
  onSavedCountChange,
  onBack,
  onNext,
}: {
  project: ResearchProject;
  savedCount: number;
  onSavedCountChange: (n: number) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { t, isRTL } = useApp();
  const [query, setQuery] = useState(project.research_question || project.topic || (project.keywords || []).join(' '));
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const data = await callEdgeFunction<{ results: SearchResult[] }>('academic-search', {
        query,
        limit: 15,
      });
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    async function loadSaved() {
      const { data } = await supabase.from('sources').select('doi,title').eq('project_id', project.id);
      if (data) {
        const ids = new Set<string>();
        data.forEach((s) => {
          if (s.doi) ids.add(`doi:${s.doi}`);
          ids.add(`title:${s.title.toLowerCase()}`);
        });
        setSavedIds(ids);
        onSavedCountChange(data.length);
      }
    }
    loadSaved();
  }, [project.id, onSavedCountChange]);

  const handleSave = async (result: SearchResult) => {
    const { error: err } = await supabase.from('sources').insert({
      title: result.title,
      authors: result.authors.join(', '),
      year: result.year,
      journal: result.journal,
      abstract: result.abstract,
      doi: result.doi,
      url: result.url,
      provider: result.providers.join(', '),
      open_access: result.openAccess,
      citation_count: result.citationCount,
      keywords: result.keywords,
      project_id: project.id,
      tags: [],
    });

    if (!err) {
      setSavedIds((prev) => new Set([...prev, `doi:${result.doi || ''}`, `title:${result.title.toLowerCase()}`]));
      onSavedCountChange(savedCount + 1);
    }
  };

  const isSaved = (r: SearchResult) =>
    (r.doi && savedIds.has(`doi:${r.doi}`)) || savedIds.has(`title:${r.title.toLowerCase()}`);

  const ArrowIcon = ArrowRight;
  const arrowClass = isRTL ? 'rotate-180' : '';

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="card bg-primary-50/50 dark:bg-primary-900/10 border-primary-100 dark:border-primary-900/30">
        <h2 className="text-sm font-bold text-primary-800 dark:text-primary-300 mb-1">{t('setupStep3')}</h2>
        <p className="text-xs text-neutral-600 dark:text-neutral-400">{t('setupStep3Desc')}</p>
      </div>

      <div className="relative">
        <Search className="absolute top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 ltr:left-3 rtl:right-3" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="input-field ltr:pl-10 ltr:pr-4 rtl:pr-10 rtl:pl-4"
          placeholder={t('searchPlaceholder')}
        />
      </div>

      <p className="text-xs text-neutral-500">{t('setupSearchHint')}</p>

      <button onClick={handleSearch} disabled={loading || !query.trim()} className="btn-primary w-full">
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> {t('searching')}</>
        ) : (
          <><Search className="w-4 h-4" /> {t('search')}</>
        )}
      </button>

      {/* Search Results */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-neutral-200 rounded w-3/4 mb-3 dark:bg-neutral-800" />
              <div className="h-3 bg-neutral-200 rounded w-1/2 mb-2 dark:bg-neutral-800" />
              <div className="h-3 bg-neutral-200 rounded w-2/3 dark:bg-neutral-800" />
            </div>
          ))}
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <EmptyState
          icon={<Search className="w-8 h-8 text-primary-700 dark:text-primary-400" />}
          title={t('noResults')}
          description={t('noResultsDesc')}
        />
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-neutral-500">{t('searchResults')} ({results.length})</p>
          {results.map((result, i) => (
            <div key={i} className="card">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white line-clamp-2 mb-1.5">{result.title}</h3>
              <div className="flex items-center gap-2 text-xs text-neutral-500 mb-2 flex-wrap">
                {result.year && <span>{result.year}</span>}
                {result.journal && <><span>·</span><span className="truncate max-w-[150px]">{result.journal}</span></>}
              </div>
              {result.abstract && (
                <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-3 mb-2">{result.abstract}</p>
              )}
              <div className="flex items-center gap-1.5 flex-wrap mb-3">
                {result.providers.map((p) => (
                  <span key={p} className="badge bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 text-[10px]">{p}</span>
                ))}
                {result.openAccess && (
                  <span className="badge bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400 text-[10px]">
                    <Check className="w-3 h-3" /> {t('openAccess')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {result.url && (
                  <button onClick={() => openExternalUrl(result.url!)} className="btn-secondary text-xs py-2 px-3">
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleSave(result)}
                  disabled={isSaved(result)}
                  className="btn-primary text-xs py-2 flex-1"
                >
                  {isSaved(result) ? <><Check className="w-4 h-4" /> {t('saved')}</> : <><Bookmark className="w-4 h-4" /> {t('saveSource')}</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <button onClick={onBack} className="btn-ghost flex-1">
          {t('back')}
        </button>
        <button onClick={onNext} className="btn-primary flex-1">
          {t('next')}
          <ArrowIcon className={`w-4 h-4 ${arrowClass}`} />
        </button>
      </div>

      <button onClick={onNext} className="w-full text-xs text-neutral-400 hover:text-neutral-500 pt-1">
        {t('setupSkipSearch')}
      </button>
    </div>
  );
}

// ==================== STEP 4: Review & Enter Workspace ====================
function Step4Review({
  project,
  savedSourceCount,
  onBack,
  onEnter,
}: {
  project: ResearchProject;
  savedSourceCount: number;
  onBack: () => void;
  onEnter: () => void;
}) {
  const { t, isRTL } = useApp();
  const ArrowIcon = ArrowRight;
  const arrowClass = isRTL ? 'rotate-180' : '';

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="card bg-primary-50/50 dark:bg-primary-900/10 border-primary-100 dark:border-primary-900/30">
        <h2 className="text-sm font-bold text-primary-800 dark:text-primary-300 mb-1">{t('setupStep4')}</h2>
        <p className="text-xs text-neutral-600 dark:text-neutral-400">{t('setupStep4Desc')}</p>
      </div>

      <div className="card">
        <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-3">{t('setupReviewTitle')}</h3>

        <div className="space-y-3">
          <ReviewRow label={t('researchTitle')} value={project.title} />
          {project.topic && <ReviewRow label={t('researchTopic')} value={project.topic} />}
          {project.field && <ReviewRow label={t('researchField')} value={project.field} />}
          {project.research_question && <ReviewRow label={t('researchQuestion')} value={project.research_question} />}
          {project.description && <ReviewRow label={t('researchDescription')} value={project.description} />}
        </div>

        {project.keywords && project.keywords.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-neutral-500 mb-1.5">{t('researchKeywords')}</p>
            <div className="flex flex-wrap gap-1.5">
              {project.keywords.map((kw) => (
                <span key={kw} className="badge bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">{kw}</span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 mt-4">
          <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-3 flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary-700 dark:text-primary-400" />
            <div>
              <p className="text-sm font-bold text-neutral-900 dark:text-white">{savedSourceCount}</p>
              <p className="text-[10px] text-neutral-500">{t('setupSourcesSaved')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={onBack} className="btn-ghost flex-1">
          {t('back')}
        </button>
        <button onClick={onEnter} className="btn-primary flex-1">
          {t('setupEnterWorkspace')}
          <ArrowIcon className={`w-4 h-4 ${arrowClass}`} />
        </button>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-neutral-500 mb-0.5">{label}</p>
      <p className="text-sm text-neutral-800 dark:text-neutral-200">{value}</p>
    </div>
  );
}
