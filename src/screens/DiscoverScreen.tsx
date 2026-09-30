import { useState } from 'react';
import { useApp } from '@/lib/AppContext';
import { callEdgeFunction } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { Search, Loader2, Bookmark, Check, ExternalLink, Info, Filter } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import type { SearchResult } from '@/types';

const POPULAR_TOPICS = [
  'تأثير وسائل التواصل الاجتماعي على الصحة النفسية',
  'الذكاء الاصطناعي في التعليم',
  'القلق لدى طلاب الجامعة',
  'الأداء الأكاديمي والضغط النفسي',
  'التعلم عن بُد والتحصيل الدراسي',
  'النوم والذاكرة',
];

export function DiscoverScreen() {
  const { t } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partialFailure, setPartialFailure] = useState(false);
  const [openResult, setOpenResult] = useState<SearchResult | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [filterOA, setFilterOA] = useState(false);

  const handleSearch = async (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!q.trim()) return;
    setQuery(q);
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const data = await callEdgeFunction<{ results: SearchResult[]; partialFailure: boolean }>('academic-search', {
        query: q,
        limit: 20,
      });
      setResults(data.results || []);
      setPartialFailure(data.partialFailure || false);
    } catch {
      setError(t('searchError'));
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

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
      project_id: null,
      tags: [],
    });
    if (!err) {
      setSavedIds((prev) => new Set([...prev, `doi:${result.doi || ''}`, `title:${result.title.toLowerCase()}`]));
    }
  };

  const isSaved = (r: SearchResult) =>
    (r.doi && savedIds.has(`doi:${r.doi}`)) || savedIds.has(`title:${r.title.toLowerCase()}`);

  const filteredResults = filterOA ? results.filter((r) => r.openAccess) : results;

  return (
    <div className="min-h-screen pb-24 bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 px-5 pt-12 pb-4 border-b border-neutral-100 dark:border-neutral-800 sticky top-0 z-30">
        <h1 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">{t('navDiscover')}</h1>
        <div className="relative">
          <Search className="absolute top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 ltr:left-3 rtl:right-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="input-field ltr:pl-10 ltr:pr-10 rtl:pr-10 rtl:pl-10"
            placeholder={t('searchPlaceholder')}
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="absolute top-1/2 -translate-y-1/2 ltr:right-3 rtl:left-3 text-neutral-400 hover:text-neutral-600"
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>
        {showFilters && (
          <div className="mt-3 flex items-center gap-2 animate-slide-down">
            <button
              onClick={() => setFilterOA(!filterOA)}
              className={`badge ${filterOA ? 'bg-primary-700 text-white' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'}`}
            >
              <Check className="w-3 h-3" /> {t('openAccess')}
            </button>
          </div>
        )}
      </div>

      <div className="px-5 py-4">
        {/* Popular Topics */}
        {!searched && !loading && (
          <div className="animate-fade-in">
            <h2 className="text-sm font-bold text-neutral-900 dark:text-white mb-3">مواضيع شائعة</h2>
            <div className="space-y-2">
              {POPULAR_TOPICS.map((topic) => (
                <button
                  key={topic}
                  onClick={() => handleSearch(topic)}
                  className="w-full card text-start active:scale-[0.98] transition-all hover:shadow-md"
                >
                  <p className="text-sm text-neutral-800 dark:text-neutral-200">{topic}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {partialFailure && (
          <div className="mb-4 rounded-xl bg-warning-50 border border-warning-100 px-4 py-3 text-xs text-warning-700 dark:bg-warning-900/20 dark:border-warning-900/30 dark:text-warning-400 flex items-start gap-2">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{t('partialFailure')}</span>
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-4 bg-neutral-200 rounded w-3/4 mb-3 dark:bg-neutral-800" />
                <div className="h-3 bg-neutral-200 rounded w-1/2 mb-2 dark:bg-neutral-800" />
                <div className="h-3 bg-neutral-200 rounded w-2/3 dark:bg-neutral-800" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && <ErrorState message={error} onRetry={() => handleSearch()} />}

        {!loading && !error && searched && filteredResults.length === 0 && (
          <EmptyState
            icon={<Search className="w-8 h-8 text-primary-700 dark:text-primary-400" />}
            title={t('noResults')}
            description={t('noResultsDesc')}
          />
        )}

        {!loading && !error && filteredResults.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-neutral-500">{t('searchResults')} ({filteredResults.length})</p>
            {filteredResults.map((result, i) => (
              <div key={i} className="card">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white line-clamp-2 mb-1.5">{result.title}</h3>
                <div className="flex items-center gap-2 text-xs text-neutral-500 mb-2 flex-wrap">
                  {result.year && <span>{result.year}</span>}
                  {result.journal && (
                    <>
                      <span>·</span>
                      <span className="truncate max-w-[150px]">{result.journal}</span>
                    </>
                  )}
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
                  {result.citationCount !== null && result.citationCount > 0 && (
                    <span className="badge bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500 text-[10px]">
                      {result.citationCount} {t('citations')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setOpenResult(result)} className="flex-1 btn-secondary text-xs py-2">
                    {t('sourceDetails')}
                  </button>
                  <button
                    onClick={() => handleSave(result)}
                    disabled={isSaved(result)}
                    className="btn-primary text-xs py-2 px-3"
                  >
                    {isSaved(result) ? <><Check className="w-4 h-4" /> {t('saved')}</> : <><Bookmark className="w-4 h-4" /> {t('saveSource')}</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Source Detail Modal */}
      <Modal open={!!openResult} onClose={() => setOpenResult(null)} title={t('sourceDetails')} size="lg">
        {openResult && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white">{openResult.title}</h3>
            {openResult.authors.length > 0 && (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                <span className="font-medium">{t('authors')}: </span>
                <span className="ltr-text">{openResult.authors.join(', ')}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {openResult.providers.map((p) => (
                <span key={p} className="badge bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                  {t('availableVia')} {p}
                </span>
              ))}
              {openResult.openAccess && (
                <span className="badge bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400">
                  <Check className="w-3 h-3" /> {t('openAccess')}
                </span>
              )}
            </div>
            {openResult.abstract && (
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-1">{t('abstract')}</p>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed ltr-text">{openResult.abstract}</p>
              </div>
            )}
            {openResult.doi && (
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-1">{t('doi')}</p>
                <p className="text-sm text-accent-600 ltr-text" dir="ltr">{openResult.doi}</p>
              </div>
            )}
            {openResult.url && (
              <a href={openResult.url} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full text-xs">
                <ExternalLink className="w-4 h-4" /> {t('openOriginal')}
              </a>
            )}
            <button
              onClick={() => { handleSave(openResult); }}
              disabled={isSaved(openResult)}
              className="btn-primary w-full text-xs"
            >
              {isSaved(openResult) ? <><Check className="w-4 h-4" /> {t('saved')}</> : <><Bookmark className="w-4 h-4" /> {t('saveSource')}</>}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
