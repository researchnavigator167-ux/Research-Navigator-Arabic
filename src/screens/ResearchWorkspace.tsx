import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/lib/AppContext';
import { useAuth } from '@/lib/AuthContext';
import { callEdgeFunction } from '@/lib/api';
import {
  ArrowRight, Search, FileText, LayoutGrid, BarChart3, GitBranch,
  ClipboardList, ShieldCheck, Plus, Bookmark, ExternalLink, Sparkles,
  Loader2, X, ChevronDown, Check, AlertTriangle, Info, BookOpen,
  ThumbsUp, ThumbsDown, MinusCircle, HelpCircle, Download, Save,
  Users, CheckSquare, MessageCircle, Upload, Calendar as CalendarIcon, LayoutDashboard,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, Spinner } from '@/components/ui';
import { openExternalUrl } from '@/lib/native';
import { ProjectTeam } from '@/components/ProjectTeam';
import { ProjectTasks } from '@/components/ProjectTasks';
import { ProjectDiscussions } from '@/components/ProjectDiscussions';
import { ProjectFiles } from '@/components/ProjectFiles';
import { ProjectCalendar } from '@/components/ProjectCalendar';
import { ProjectDashboard } from '@/components/ProjectDashboard';
import type { ResearchProject, Source, EvidenceItem, ResearchGap, BriefContent, PaperAnalysis, SearchResult } from '@/types';

interface WorkspaceProps {
  project: ResearchProject;
  onBack: () => void;
}

type Tab = 'overview' | 'search' | 'sources' | 'evidence' | 'analysis' | 'gaps' | 'brief' | 'integrity' | 'dashboard' | 'tasks' | 'team' | 'discussions' | 'files' | 'calendar';

const TABS: { id: Tab; key: string; icon: typeof Search }[] = [
  { id: 'overview', key: 'workspaceOverview', icon: BookOpen },
  { id: 'dashboard', key: 'workspaceDashboard', icon: LayoutDashboard },
  { id: 'search', key: 'workspaceSearch', icon: Search },
  { id: 'sources', key: 'workspaceSources', icon: FileText },
  { id: 'evidence', key: 'workspaceEvidence', icon: LayoutGrid },
  { id: 'analysis', key: 'workspaceAnalysis', icon: BarChart3 },
  { id: 'gaps', key: 'workspaceGaps', icon: GitBranch },
  { id: 'brief', key: 'workspaceBrief', icon: ClipboardList },
  { id: 'tasks', key: 'workspaceTasks', icon: CheckSquare },
  { id: 'files', key: 'workspaceFiles', icon: Upload },
  { id: 'calendar', key: 'workspaceCalendar', icon: CalendarIcon },
  { id: 'team', key: 'workspaceTeam', icon: Users },
  { id: 'discussions', key: 'workspaceDiscussions', icon: MessageCircle },
  { id: 'integrity', key: 'workspaceIntegrity', icon: ShieldCheck },
];

export function ResearchWorkspace({ project, onBack }: WorkspaceProps) {
  const { t, isRTL } = useApp();
  const [tab, setTab] = useState<Tab>('overview');
  const ArrowIcon = ArrowRight;
  const arrowClass = isRTL ? 'rotate-180' : '';

  return (
    <div className="min-h-screen pb-24 bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 px-5 pt-12 pb-3 border-b border-neutral-100 dark:border-neutral-800 sticky top-0 z-30">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <ArrowIcon className={`w-5 h-5 ${arrowClass}`} />
          </button>
          <h1 className="text-base font-bold text-neutral-900 dark:text-white flex-1 truncate">{project.title}</h1>
        </div>
        {/* Tab Scroller */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {TABS.map((tb) => {
            const Icon = tb.icon;
            const active = tab === tb.id;
            return (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  active
                    ? 'bg-primary-700 text-white'
                    : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t(tb.key)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-5 py-4">
        {tab === 'overview' && <OverviewTab project={project} />}
        {tab === 'dashboard' && <ProjectDashboard project={project} />}
        {tab === 'search' && <SearchTab project={project} />}
        {tab === 'sources' && <SourcesTab project={project} />}
        {tab === 'evidence' && <EvidenceTab project={project} />}
        {tab === 'analysis' && <AnalysisTab project={project} />}
        {tab === 'gaps' && <GapsTab project={project} />}
        {tab === 'brief' && <BriefTab project={project} />}
        {tab === 'tasks' && <ProjectTasks project={project} />}
        {tab === 'files' && <ProjectFiles project={project} />}
        {tab === 'calendar' && <ProjectCalendar project={project} />}
        {tab === 'team' && <ProjectTeam project={project} />}
        {tab === 'discussions' && <ProjectDiscussions project={project} />}
        {tab === 'integrity' && <IntegrityTab project={project} />}
      </div>
    </div>
  );
}

// ==================== OVERVIEW TAB ====================
function OverviewTab({ project }: { project: ResearchProject }) {
  const { t } = useApp();
  const [stats, setStats] = useState({ sources: 0, evidence: 0, gaps: 0 });

  useEffect(() => {
    async function load() {
      const [src, evi, gap] = await Promise.all([
        supabase.from('sources').select('id', { count: 'exact' }).eq('project_id', project.id),
        supabase.from('evidence_items').select('id', { count: 'exact' }).eq('project_id', project.id),
        supabase.from('research_gaps').select('id', { count: 'exact' }).eq('project_id', project.id),
      ]);
      setStats({
        sources: src.count || 0,
        evidence: evi.count || 0,
        gaps: gap.count || 0,
      });
    }
    load();
  }, [project.id]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="card">
        <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-3">{project.title}</h3>
        {project.topic && <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">{project.topic}</p>}
        {project.research_question && (
          <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-3 mb-3">
            <p className="text-xs text-primary-700 dark:text-primary-400 font-medium mb-1">{t('researchQuestion')}</p>
            <p className="text-sm text-neutral-800 dark:text-neutral-200">{project.research_question}</p>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <StatCard label={t('sourceCount')} value={stats.sources} />
          <StatCard label={t('evidenceCount')} value={stats.evidence} />
          <StatCard label={t('gapCount')} value={stats.gaps} />
        </div>
        {project.field && (
          <div className="mt-3">
            <span className="badge bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">{project.field}</span>
          </div>
        )}
        {project.keywords?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {project.keywords.map((kw) => (
              <span key={kw} className="badge bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">{kw}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-3 text-center">
      <p className="text-xl font-bold text-primary-700 dark:text-primary-400">{value}</p>
      <p className="text-[10px] text-neutral-500 mt-0.5">{label}</p>
    </div>
  );
}

// ==================== SEARCH TAB ====================
function SearchTab({ project }: { project: ResearchProject }) {
  const { t } = useApp();
  const { user } = useAuth();
  const [query, setQuery] = useState(project.research_question || project.topic || '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partialFailure, setPartialFailure] = useState(false);
  const [openResult, setOpenResult] = useState<SearchResult | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const data = await callEdgeFunction<{ results: SearchResult[]; partialFailure: boolean }>('academic-search', {
        query,
        limit: 15,
      });
      setResults(data.results || []);
      setPartialFailure(data.partialFailure || false);
    } catch (err) {
      setError(t('searchError'));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, t]);

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
      }
    }
    loadSaved();
  }, [project.id]);

  const handleSave = async (result: SearchResult) => {
    const { data, error: err } = await supabase.from('sources').insert({
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
    }).select('id').single();

    if (!err && data) {
      setSavedIds((prev) => new Set([...prev, `doi:${result.doi || ''}`, `title:${result.title.toLowerCase()}`]));
    }
  };

  const isSaved = (r: SearchResult) =>
    (r.doi && savedIds.has(`doi:${r.doi}`)) || savedIds.has(`title:${r.title.toLowerCase()}`);

  return (
    <div className="animate-fade-in">
      <div className="relative mb-4">
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

      {partialFailure && (
        <div className="mb-4 rounded-xl bg-warning-50 border border-warning-100 px-4 py-3 text-xs text-warning-700 dark:bg-warning-900/20 dark:border-warning-900/30 dark:text-warning-400 flex items-start gap-2">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{t('partialFailure')}</span>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-neutral-200 rounded w-3/4 mb-3 dark:bg-neutral-800" />
              <div className="h-3 bg-neutral-200 rounded w-1/2 mb-2 dark:bg-neutral-800" />
              <div className="h-3 bg-neutral-200 rounded w-2/3 dark:bg-neutral-800" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && <ErrorState message={error} onRetry={handleSearch} />}

      {!loading && !error && searched && results.length === 0 && (
        <EmptyState
          icon={<Search className="w-8 h-8 text-primary-700 dark:text-primary-400" />}
          title={t('noResults')}
          description={t('noResultsDesc')}
        />
      )}

      {!loading && !error && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-neutral-500">{t('searchResults')} ({results.length})</p>
          {results.map((result, i) => (
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
                <button
                  onClick={() => setOpenResult(result)}
                  className="flex-1 btn-secondary text-xs py-2"
                >
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

      {/* Source Detail Modal */}
      <Modal open={!!openResult} onClose={() => setOpenResult(null)} title={t('sourceDetails')} size="lg">
        {openResult && (
          <SourceDetail
            result={openResult}
            onSave={() => { handleSave(openResult); }}
            isSaved={isSaved(openResult)}
            onAnalyze={async () => {
              const analysis = await callEdgeFunction<PaperAnalysis & { evidenceLevelText: string }>('paper-analysis', {
                title: openResult.title,
                abstract: openResult.abstract,
                authors: openResult.authors.join(', '),
                year: openResult.year,
                journal: openResult.journal,
                researchTopic: project.topic,
              });
              return analysis;
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function SourceDetail({ result, onSave, isSaved, onAnalyze }: {
  result: SearchResult;
  onSave: () => void;
  isSaved: boolean;
  onAnalyze: () => Promise<PaperAnalysis & { evidenceLevelText: string }>;
}) {
  const { t } = useApp();
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<(PaperAnalysis & { evidenceLevelText: string }) | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const data = await onAnalyze();
      setAnalysis(data);
    } catch {
      setAnalysisError(t('error'));
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-2">{result.title}</h3>
        {result.authors.length > 0 && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            <span className="font-medium">{t('authors')}: </span>
            <span className="ltr-text">{result.authors.join(', ')}</span>
          </p>
        )}
        <div className="flex items-center gap-2 mt-2 text-xs text-neutral-500 flex-wrap">
          {result.year && <span>{result.year}</span>}
          {result.journal && <><span>·</span><span>{result.journal}</span></>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {result.providers.map((p) => (
          <span key={p} className="badge bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
            {t('availableVia')} {p}
          </span>
        ))}
        {result.openAccess ? (
          <span className="badge bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400">
            <Check className="w-3 h-3" /> {t('openAccess')}
          </span>
        ) : (
          <span className="badge bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">{t('closedAccess')}</span>
        )}
      </div>

      {result.abstract && (
        <div>
          <p className="text-xs font-medium text-neutral-500 mb-1">{t('abstract')}</p>
          <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed ltr-text">{result.abstract}</p>
        </div>
      )}

      {result.doi && (
        <div>
          <p className="text-xs font-medium text-neutral-500 mb-1">{t('doi')}</p>
          <p className="text-sm text-accent-600 ltr-text" dir="ltr">{result.doi}</p>
        </div>
      )}

      {result.url && (
        <button onClick={() => openExternalUrl(result.url!)} className="btn-secondary w-full text-xs">
          <ExternalLink className="w-4 h-4" /> {t('openOriginal')}
        </button>
      )}

      <div className="flex gap-2">
        <button onClick={onSave} disabled={isSaved} className="btn-secondary flex-1 text-xs">
          {isSaved ? <><Check className="w-4 h-4" /> {t('saved')}</> : <><Bookmark className="w-4 h-4" /> {t('saveSource')}</>}
        </button>
        <button onClick={handleAnalyze} disabled={analyzing} className="btn-primary flex-1 text-xs">
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> {t('analyzePaper')}</>}
        </button>
      </div>

      {analysisError && <ErrorState message={analysisError} />}

      {analysis && (
        <div className="card bg-primary-50/50 dark:bg-primary-900/10 animate-scale-in">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary-700 dark:text-primary-400" />
            <span className="text-sm font-bold text-primary-800 dark:text-primary-300">{t('paperAnalysis')}</span>
          </div>
          <div className="mb-3 rounded-lg bg-warning-50 dark:bg-warning-900/20 px-3 py-2 text-xs text-warning-700 dark:text-warning-400 flex items-center gap-2">
            <Info className="w-4 h-4 flex-shrink-0" />
            {analysis.evidenceLevelText}
          </div>
          <AnalysisFields analysis={analysis} />
        </div>
      )}
    </div>
  );
}

function AnalysisFields({ analysis }: { analysis: PaperAnalysis & { evidenceLevelText: string } }) {
  const { t } = useApp();
  const fields: { key: keyof PaperAnalysis; label: string }[] = [
    { key: 'objective', label: t('objective') },
    { key: 'researchQuestion', label: t('researchQuestion') },
    { key: 'hypotheses', label: t('hypotheses') },
    { key: 'methodology', label: t('methodology') },
    { key: 'sample', label: t('sample') },
    { key: 'instruments', label: t('instruments') },
    { key: 'variables', label: t('variables') },
    { key: 'results', label: t('results') },
    { key: 'limitations', label: t('limitations') },
    { key: 'recommendations', label: t('recommendations') },
    { key: 'relationToUserTopic', label: t('relationToTopic') },
  ];
  return (
    <div className="space-y-3">
      {fields.map((f) => {
        const value = analysis[f.key];
        if (!value || value === 'غير متوفر') return null;
        return (
          <div key={f.key}>
            <p className="text-xs font-medium text-neutral-500 mb-0.5">{f.label}</p>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">{value}</p>
          </div>
        );
      })}
    </div>
  );
}

// ==================== SOURCES TAB ====================
function SourcesTab({ project }: { project: ResearchProject }) {
  const { t } = useApp();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSource, setOpenSource] = useState<Source | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase.from('sources').select('*').eq('project_id', project.id).order('created_at', { ascending: false });
      setSources(data || []);
      setLoading(false);
    }
    load();
  }, [project.id]);

  const handleDelete = async (id: string) => {
    await supabase.from('sources').delete().eq('id', id);
    setSources((prev) => prev.filter((s) => s.id !== id));
    setOpenSource(null);
  };

  const filtered = sources.filter((s) =>
    !searchTerm || s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.authors || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      {sources.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 ltr:left-3 rtl:right-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field ltr:pl-10 ltr:pr-4 rtl:pr-10 rtl:pl-4"
            placeholder={t('search')}
          />
        </div>
      )}

      {loading && <div className="space-y-3"><div className="card animate-pulse h-24" /><div className="card animate-pulse h-24" /></div>}

      {!loading && sources.length === 0 && (
        <EmptyState
          icon={<FileText className="w-8 h-8 text-primary-700 dark:text-primary-400" />}
          title={t('noSources')}
          description={t('noResultsDesc')}
        />
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((source) => (
            <div key={source.id} className="card">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white line-clamp-2 mb-1">{source.title}</h3>
              <div className="flex items-center gap-2 text-xs text-neutral-500 mb-2 flex-wrap">
                {source.year && <span>{source.year}</span>}
                {source.journal && <><span>·</span><span className="truncate max-w-[120px]">{source.journal}</span></>}
                {source.open_access && <span className="badge bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400 text-[10px]">{t('openAccess')}</span>}
              </div>
              {source.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {source.tags.map((tag) => (
                    <span key={tag} className="badge bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 text-[10px]">{tag}</span>
                  ))}
                </div>
              )}
              <button onClick={() => setOpenSource(source)} className="text-xs text-primary-700 dark:text-primary-400 font-medium">
                {t('sourceDetails')}
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!openSource} onClose={() => setOpenSource(null)} title={t('sourceDetails')} size="lg">
        {openSource && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white">{openSource.title}</h3>
            {openSource.authors && <p className="text-sm text-neutral-600 dark:text-neutral-400 ltr-text">{openSource.authors}</p>}
            {openSource.abstract && <p className="text-sm text-neutral-700 dark:text-neutral-300 ltr-text leading-relaxed">{openSource.abstract}</p>}
            {openSource.doi && <p className="text-sm text-accent-600 ltr-text" dir="ltr">DOI: {openSource.doi}</p>}
            {openSource.url && (
              <button onClick={() => openExternalUrl(openSource.url!)} className="btn-secondary w-full text-xs">
                <ExternalLink className="w-4 h-4" /> {t('openOriginal')}
              </button>
            )}
            <button onClick={() => handleDelete(openSource.id)} className="btn-ghost w-full text-xs text-error-600 dark:text-error-400">
              {t('delete')}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ==================== EVIDENCE TAB ====================
function EvidenceTab({ project }: { project: ResearchProject }) {
  const { t } = useApp();
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [sources, setSources] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [analysis, setAnalysis] = useState<{ generalTrend: string; agreement: string; disagreement: string; reasonsForDisagreement: string; methodologicalLimitations: string; insufficientEvidence: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [newClaim, setNewClaim] = useState({ claim: '', evidence_type: 'supports' as EvidenceItem['evidence_type'], evidence_text: '', source_id: '' });

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [eviRes, srcRes] = await Promise.all([
        supabase.from('evidence_items').select('*').eq('project_id', project.id).order('created_at', { ascending: false }),
        supabase.from('sources').select('id,title').eq('project_id', project.id),
      ]);
      setEvidence(eviRes.data || []);
      setSources((srcRes.data as { id: string; title: string }[]) || []);
      setLoading(false);
    }
    load();
  }, [project.id]);

  const handleAdd = async () => {
    if (!newClaim.claim.trim()) return;
    const { data } = await supabase.from('evidence_items').insert({
      project_id: project.id,
      claim: newClaim.claim,
      evidence_type: newClaim.evidence_type,
      evidence_text: newClaim.evidence_text || null,
      source_id: newClaim.source_id || null,
    }).select('*').single();
    if (data) {
      setEvidence((prev) => [data as EvidenceItem, ...prev]);
      setNewClaim({ claim: '', evidence_type: 'supports', evidence_text: '', source_id: '' });
      setShowAdd(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('evidence_items').delete().eq('id', id);
    setEvidence((prev) => prev.filter((e) => e.id !== id));
  };

  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const data = await callEdgeFunction<typeof analysis>('evidence-analysis', { projectId: project.id });
      setAnalysis(data);
    } catch {
      setAnalysisError(t('error'));
    } finally {
      setAnalyzing(false);
    }
  };

  const typeIcons: Record<string, typeof ThumbsUp> = {
    supports: ThumbsUp,
    opposes: ThumbsDown,
    mixed: MinusCircle,
    insufficient: HelpCircle,
  };
  const typeColors: Record<string, string> = {
    supports: 'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400',
    opposes: 'bg-error-50 text-error-700 dark:bg-error-900/20 dark:text-error-400',
    mixed: 'bg-warning-50 text-warning-700 dark:bg-warning-900/20 dark:text-warning-400',
    insufficient: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
  };

  return (
    <div className="animate-fade-in">
      {evidence.length > 0 && (
        <button onClick={handleAnalyze} disabled={analyzing} className="btn-secondary w-full mb-4 text-xs">
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> {t('analyzeEvidence')}</>}
        </button>
      )}

      {analysisError && (
        <div className="mb-4 rounded-xl bg-error-50 dark:bg-error-900/20 border border-error-100 dark:border-error-900/30 px-4 py-3 text-xs text-error-700 dark:text-error-400">
          {analysisError}
        </div>
      )}

      {analysis && (
        <div className="card bg-primary-50/50 dark:bg-primary-900/10 mb-4 animate-scale-in">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary-700 dark:text-primary-400" />
            <span className="text-sm font-bold text-primary-800 dark:text-primary-300">{t('evidenceAnalysis')}</span>
          </div>
          <div className="space-y-3 text-xs text-neutral-700 dark:text-neutral-300">
            <div><p className="font-medium text-neutral-500 mb-0.5">{t('generalTrend')}</p><p>{analysis.generalTrend}</p></div>
            <div><p className="font-medium text-neutral-500 mb-0.5">{t('agreement')}</p><p>{analysis.agreement}</p></div>
            <div><p className="font-medium text-neutral-500 mb-0.5">{t('disagreement')}</p><p>{analysis.disagreement}</p></div>
            <div><p className="font-medium text-neutral-500 mb-0.5">أسباب الاختلاف المحتملة</p><p>{analysis.reasonsForDisagreement}</p></div>
            <div><p className="font-medium text-neutral-500 mb-0.5">القيود المنهجية المتكررة</p><p>{analysis.methodologicalLimitations}</p></div>
            <div><p className="font-medium text-neutral-500 mb-0.5">ما لا تزال الأدلة غير كافية لإثباته</p><p>{analysis.insufficientEvidence}</p></div>
          </div>
        </div>
      )}

      {loading && <div className="card animate-pulse h-20" />}

      {!loading && evidence.length === 0 && !showAdd && (
        <EmptyState
          icon={<LayoutGrid className="w-8 h-8 text-primary-700 dark:text-primary-400" />}
          title={t('noEvidence')}
          description={t('noEvidenceDesc')}
          action={<button onClick={() => setShowAdd(true)} className="btn-primary"><Plus className="w-4 h-4" /> {t('addClaim')}</button>}
        />
      )}

      {evidence.length > 0 && !showAdd && (
        <button onClick={() => setShowAdd(true)} className="btn-primary w-full mb-4 text-xs">
          <Plus className="w-4 h-4" /> {t('addClaim')}
        </button>
      )}

      {showAdd && (
        <div className="card mb-4 animate-slide-down">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-neutral-900 dark:text-white">{t('addClaim')}</span>
            <button onClick={() => setShowAdd(false)} className="text-neutral-400"><X className="w-5 h-5" /></button>
          </div>
          <div className="space-y-3">
            <textarea
              value={newClaim.claim}
              onChange={(e) => setNewClaim({ ...newClaim, claim: e.target.value })}
              className="input-field min-h-[60px] resize-none"
              placeholder="اكتب الادعاء هنا..."
            />
            <select
              value={newClaim.evidence_type}
              onChange={(e) => setNewClaim({ ...newClaim, evidence_type: e.target.value as EvidenceItem['evidence_type'] })}
              className="input-field"
            >
              <option value="supports">{t('supports')}</option>
              <option value="opposes">{t('opposes')}</option>
              <option value="mixed">{t('mixed')}</option>
              <option value="insufficient">{t('insufficient')}</option>
            </select>
            {sources.length > 0 && (
              <select
                value={newClaim.source_id}
                onChange={(e) => setNewClaim({ ...newClaim, source_id: e.target.value })}
                className="input-field"
              >
                <option value="">{t('selectField')} {t('workspaceSources')}</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>{s.title.substring(0, 50)}...</option>
                ))}
              </select>
            )}
            <textarea
              value={newClaim.evidence_text}
              onChange={(e) => setNewClaim({ ...newClaim, evidence_text: e.target.value })}
              className="input-field min-h-[60px] resize-none"
              placeholder={t('evidenceText')}
            />
            <button onClick={handleAdd} disabled={!newClaim.claim.trim()} className="btn-primary w-full text-xs">
              {t('add')}
            </button>
          </div>
        </div>
      )}

      {evidence.length > 0 && (
        <div className="space-y-3">
          {evidence.map((item) => {
            const Icon = typeIcons[item.evidence_type] || HelpCircle;
            return (
              <div key={item.id} className="card">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className={`badge ${typeColors[item.evidence_type] || typeColors.insufficient}`}>
                    <Icon className="w-3 h-3" /> {t(item.evidence_type)}
                  </span>
                  <button onClick={() => handleDelete(item.id)} className="text-neutral-300 hover:text-error-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-neutral-800 dark:text-neutral-200 font-medium mb-1">{item.claim}</p>
                {item.evidence_text && <p className="text-xs text-neutral-600 dark:text-neutral-400">{item.evidence_text}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==================== ANALYSIS TAB ====================
function AnalysisTab({ project }: { project: ResearchProject }) {
  const { t } = useApp();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, PaperAnalysis & { evidenceLevelText: string }>>({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase.from('sources').select('*').eq('project_id', project.id).order('created_at', { ascending: false });
      setSources(data || []);
      setLoading(false);
    }
    load();
  }, [project.id]);

  const handleAnalyze = async (source: Source) => {
    setAnalyzing(source.id);
    try {
      const data = await callEdgeFunction<PaperAnalysis & { evidenceLevelText: string }>('paper-analysis', {
        title: source.title,
        abstract: source.abstract,
        authors: source.authors,
        year: source.year,
        journal: source.journal,
        researchTopic: project.topic,
      });
      setAnalyses((prev) => ({ ...prev, [source.id]: data }));
    } catch {
      // ignore
    } finally {
      setAnalyzing(null);
    }
  };

  if (loading) return <div className="card animate-pulse h-20" />;

  if (sources.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 className="w-8 h-8 text-primary-700 dark:text-primary-400" />}
        title={t('noAnalysis')}
        description={t('noSources')}
      />
    );
  }

  return (
    <div className="space-y-3 animate-fade-in">
      {sources.map((source) => (
        <div key={source.id} className="card">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white line-clamp-2 mb-2">{source.title}</h3>
          {!analyses[source.id] ? (
            <button onClick={() => handleAnalyze(source)} disabled={analyzing === source.id} className="btn-secondary w-full text-xs">
              {analyzing === source.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> {t('analyzePaper')}</>}
            </button>
          ) : (
            <div className="animate-scale-in">
              <div className="mb-3 rounded-lg bg-warning-50 dark:bg-warning-900/20 px-3 py-2 text-xs text-warning-700 dark:text-warning-400 flex items-center gap-2">
                <Info className="w-4 h-4 flex-shrink-0" />
                {analyses[source.id].evidenceLevelText}
              </div>
              <AnalysisFields analysis={analyses[source.id]} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ==================== GAPS TAB ====================
function GapsTab({ project }: { project: ResearchProject }) {
  const { t } = useApp();
  const [gaps, setGaps] = useState<ResearchGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [gapError, setGapError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase.from('research_gaps').select('*').eq('project_id', project.id).order('created_at', { ascending: false });
      setGaps(data || []);
      setLoading(false);
    }
    load();
  }, [project.id]);

  const handleDiscover = async () => {
    setDiscovering(true);
    setGapError(null);
    try {
      await callEdgeFunction('gap-discovery', { projectId: project.id });
      const { data } = await supabase.from('research_gaps').select('*').eq('project_id', project.id).order('created_at', { ascending: false });
      setGaps(data || []);
    } catch {
      setGapError(t('error'));
    } finally {
      setDiscovering(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('research_gaps').delete().eq('id', id);
    setGaps((prev) => prev.filter((g) => g.id !== id));
  };

  const gapTypeLabels: Record<string, string> = {
    gapLimited: t('gapLimited'),
    gapContradictory: t('gapContradictory'),
    gapMethodological: t('gapMethodological'),
    gapGeographic: t('gapGeographic'),
    gapTemporal: t('gapTemporal'),
    gapPopulation: t('gapPopulation'),
    gapConceptual: t('gapConceptual'),
    gapMeasurement: t('gapMeasurement'),
  };

  return (
    <div className="animate-fade-in">
      <button onClick={handleDiscover} disabled={discovering} className="btn-secondary w-full mb-4 text-xs">
        {discovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> {t('discoverGaps')}</>}
      </button>

      {gapError && (
        <div className="mb-4 rounded-xl bg-error-50 dark:bg-error-900/20 border border-error-100 dark:border-error-900/30 px-4 py-3 text-xs text-error-700 dark:text-error-400">
          {gapError}
        </div>
      )}

      <div className="mb-4 rounded-xl bg-warning-50 border border-warning-100 px-4 py-3 text-xs text-warning-700 dark:bg-warning-900/20 dark:border-warning-900/30 dark:text-warning-400 flex items-start gap-2">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>هذه فجوات بحثية محتملة وليست مؤكدة. كل فجوة مرتبطة بالمصادر المتاحة.</span>
      </div>

      {loading && <div className="card animate-pulse h-20" />}

      {!loading && gaps.length === 0 && (
        <EmptyState
          icon={<GitBranch className="w-8 h-8 text-primary-700 dark:text-primary-400" />}
          title={t('noGaps')}
          description={t('noGapsDesc')}
        />
      )}

      {gaps.length > 0 && (
        <div className="space-y-3">
          {gaps.map((gap) => (
            <div key={gap.id} className="card">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="badge bg-warning-50 text-warning-700 dark:bg-warning-900/20 dark:text-warning-400">
                  {gapTypeLabels[gap.gap_type] || gap.gap_type}
                </span>
                <button onClick={() => handleDelete(gap.id)} className="text-neutral-300 hover:text-error-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed">{gap.description}</p>
              {gap.supporting_sources && (
                <div className="mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <p className="text-xs font-medium text-neutral-500 mb-1">{t('supportingSources')}</p>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">{gap.supporting_sources}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== BRIEF TAB ====================
function BriefTab({ project }: { project: ResearchProject }) {
  const { t } = useApp();
  const [brief, setBrief] = useState<BriefContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editedBrief, setEditedBrief] = useState<BriefContent>({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase.from('research_briefs').select('*').eq('project_id', project.id).maybeSingle();
      if (data) {
        setBrief(data.content as BriefContent);
        setEditedBrief(data.content as BriefContent);
      }
      setLoading(false);
    }
    load();
  }, [project.id]);

  const handleGenerate = async () => {
    setGenerating(true);
    setBriefError(null);
    try {
      const data = await callEdgeFunction<{ brief: BriefContent }>('brief-generate', { projectId: project.id });
      setBrief(data.brief);
      setEditedBrief(data.brief);
    } catch {
      setBriefError(t('error'));
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveEdit = async () => {
    const { data: existing } = await supabase.from('research_briefs').select('id').eq('project_id', project.id).maybeSingle();
    if (existing) {
      await supabase.from('research_briefs').update({ content: editedBrief }).eq('id', existing.id);
    } else {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (userId) {
        await supabase.from('research_briefs').insert({ project_id: project.id, user_id: userId, content: editedBrief });
      }
    }
    setBrief(editedBrief);
    setEditing(false);
  };

  const handleExport = () => {
    if (!brief) return;
    const sections: { key: keyof BriefContent; label: string }[] = [
      { key: 'title', label: t('researchTitle') },
      { key: 'problem', label: t('briefProblem') },
      { key: 'question', label: t('researchQuestion') },
      { key: 'concepts', label: t('briefConcepts') },
      { key: 'keyStudies', label: t('briefKeyStudies') },
      { key: 'availableEvidence', label: t('briefAvailableEvidence') },
      { key: 'agreementPoints', label: t('briefAgreement') },
      { key: 'disagreementPoints', label: t('briefDisagreement') },
      { key: 'limitations', label: t('briefLimitations') },
      { key: 'potentialGap', label: t('briefPotentialGap') },
      { key: 'suggestedQuestions', label: t('briefSuggestedQuestions') },
      { key: 'references', label: t('briefReferences') },
    ];
    let content = `دليل الباحث — ملخص البحث\n\n`;
    for (const section of sections) {
      const val = brief[section.key];
      if (val) {
        content += `${section.label}\n${val}\n\n`;
      }
    }
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title}-brief.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="card animate-pulse h-40" />;

  if (!brief && !generating) {
    return (
      <div className="animate-fade-in">
        {briefError && (
          <div className="mb-4 rounded-xl bg-error-50 dark:bg-error-900/20 border border-error-100 dark:border-error-900/30 px-4 py-3 text-xs text-error-700 dark:text-error-400">
            {briefError}
          </div>
        )}
        <EmptyState
        icon={<ClipboardList className="w-8 h-8 text-primary-700 dark:text-primary-400" />}
        title={t('researchBrief')}
        description={t('generateBrief')}
        action={<button onClick={handleGenerate} className="btn-primary"><Sparkles className="w-4 h-4" /> {t('generateBrief')}</button>}
      />
      </div>
    );
  }

  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Spinner size="lg" />
        <p className="text-sm text-neutral-500 mt-4">{t('loading')}</p>
      </div>
    );
  }

  const sections: { key: keyof BriefContent; label: string }[] = [
    { key: 'problem', label: t('briefProblem') },
    { key: 'question', label: t('researchQuestion') },
    { key: 'concepts', label: t('briefConcepts') },
    { key: 'keyStudies', label: t('briefKeyStudies') },
    { key: 'availableEvidence', label: t('briefAvailableEvidence') },
    { key: 'agreementPoints', label: t('briefAgreement') },
    { key: 'disagreementPoints', label: t('briefDisagreement') },
    { key: 'limitations', label: t('briefLimitations') },
    { key: 'potentialGap', label: t('briefPotentialGap') },
    { key: 'suggestedQuestions', label: t('briefSuggestedQuestions') },
    { key: 'references', label: t('briefReferences') },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex gap-2 mb-4">
        <button onClick={handleGenerate} className="btn-secondary flex-1 text-xs">
          <Sparkles className="w-4 h-4" /> {t('generateBrief')}
        </button>
        <button onClick={handleExport} className="btn-secondary text-xs px-3">
          <Download className="w-4 h-4" /> {t('exportPdf')}
        </button>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-neutral-900 dark:text-white">{t('editBrief')}</span>
            <div className="flex gap-2">
              <button onClick={() => { setEditedBrief(brief || {}); setEditing(false); }} className="btn-ghost text-xs px-3 py-2">{t('cancel')}</button>
              <button onClick={handleSaveEdit} className="btn-primary text-xs px-3 py-2"><Save className="w-4 h-4" /> {t('save')}</button>
            </div>
          </div>
          {sections.map((s) => (
            <div key={s.key}>
              <label className="block text-xs font-medium text-neutral-500 mb-1">{s.label}</label>
              <textarea
                value={editedBrief[s.key] || ''}
                onChange={(e) => setEditedBrief({ ...editedBrief, [s.key]: e.target.value })}
                className="input-field min-h-[60px] resize-none text-sm"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {brief?.title && <h2 className="text-lg font-bold text-neutral-900 dark:text-white">{brief.title}</h2>}
          {sections.map((s) => {
            const val = brief?.[s.key];
            if (!val) return null;
            return (
              <div key={s.key} className="card">
                <h3 className="text-sm font-bold text-primary-800 dark:text-primary-300 mb-2">{s.label}</h3>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-line leading-relaxed">{val}</p>
              </div>
            );
          })}
          <button onClick={() => setEditing(true)} className="btn-ghost w-full text-xs">
            {t('editBrief')}
          </button>
        </div>
      )}
    </div>
  );
}

// ==================== INTEGRITY TAB ====================
function IntegrityTab({ project }: { project: ResearchProject }) {
  const { t } = useApp();
  const [sources, setSources] = useState<Source[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [srcRes, eviRes] = await Promise.all([
          supabase.from('sources').select('*').eq('project_id', project.id),
          supabase.from('evidence_items').select('*').eq('project_id', project.id),
        ]);
        if (cancelled) return;
        setSources(srcRes.data || []);
        setEvidence(eviRes.data || []);
      } catch {
        if (!cancelled) setError(t('error'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [project.id, t]);

  if (loading) return <div className="card animate-pulse h-40" />;
  if (error) return <ErrorState message={error} />;

  const issues: { type: string; label: string; description: string; severity: 'warning' | 'info' | 'error' }[] = [];

  // Unverified sources (no DOI and no URL)
  const unverified = sources.filter((s) => !s.doi && !s.url);
  unverified.forEach((s) => {
    issues.push({ type: 'unverified', label: t('unverifiedSources'), description: `المصدر: "${s.title}" - لا يحتوي على DOI أو رابط موثوق`, severity: 'warning' });
  });

  // Claims without sources
  const claimsWithoutSource = evidence.filter((e) => !e.source_id);
  if (claimsWithoutSource.length > 0) {
    issues.push({ type: 'noSource', label: t('claimsWithoutSources'), description: `${claimsWithoutSource.length} ادعاء بدون مصدر مرتبط`, severity: 'warning' });
  }

  // Overinterpretation - evidence marked as supports but with insufficient text
  const overinterpreted = evidence.filter((e) => e.evidence_type === 'supports' && (!e.evidence_text || e.evidence_text.length < 20));
  overinterpreted.forEach((e) => {
    issues.push({ type: 'over', label: t('overinterpretation'), description: `الادعاء: "${e.claim}" - قد يحتاج إلى مزيد من الأدلة الداعمة`, severity: 'info' });
  });

  // Conflicting results
  const hasSupports = evidence.some((e) => e.evidence_type === 'supports');
  const hasOpposes = evidence.some((e) => e.evidence_type === 'opposes');
  if (hasSupports && hasOpposes) {
    issues.push({ type: 'conflict', label: t('conflictingResults'), description: 'يوجد أدلة متعارضة في المشروع. راجع التحليل للمزيد من التفاصيل', severity: 'info' });
  }

  // Incomplete data - sources without abstract
  const incomplete = sources.filter((s) => !s.abstract);
  if (incomplete.length > 0) {
    issues.push({ type: 'incomplete', label: t('incompleteData'), description: `${incomplete.length} مصدر بدون ملخص - قد تحتاج لمراجعة النص الكامل`, severity: 'info' });
  }

  // Duplicate references (same DOI)
  const doiMap: Record<string, number> = {};
  sources.forEach((s) => { if (s.doi) doiMap[s.doi] = (doiMap[s.doi] || 0) + 1; });
  const duplicates = Object.entries(doiMap).filter(([, count]) => count > 1);
  if (duplicates.length > 0) {
    issues.push({ type: 'dup', label: t('duplicateRefs'), description: `${duplicates.length} مرجع مكرر بناءً على DOI`, severity: 'warning' });
  }

  const severityConfig = {
    warning: { bg: 'bg-warning-50 dark:bg-warning-900/20', text: 'text-warning-700 dark:text-warning-400', border: 'border-warning-100 dark:border-warning-900/30', icon: AlertTriangle },
    error: { bg: 'bg-error-50 dark:bg-error-900/20', text: 'text-error-700 dark:text-error-400', border: 'border-error-100 dark:border-error-900/30', icon: AlertTriangle },
    info: { bg: 'bg-accent-50 dark:bg-accent-900/20', text: 'text-accent-700 dark:text-accent-400', border: 'border-accent-100 dark:border-accent-900/30', icon: Info },
  };

  return (
    <div className="animate-fade-in">
      <div className="card mb-4 bg-primary-50/50 dark:bg-primary-900/10">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-5 h-5 text-primary-700 dark:text-primary-400" />
          <h3 className="text-sm font-bold text-primary-800 dark:text-primary-300">{t('researchIntegrity')}</h3>
        </div>
        <p className="text-xs text-neutral-600 dark:text-neutral-400">{t('integrityDesc')}</p>
      </div>

      {issues.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="w-8 h-8 text-success-600 dark:text-success-400" />}
          title={t('noIssues')}
          description={t('integrityDesc')}
        />
      ) : (
        <div className="space-y-3">
          {issues.map((issue, i) => {
            const cfg = severityConfig[issue.severity];
            const Icon = cfg.icon;
            return (
              <div key={i} className={`card border ${cfg.border} ${cfg.bg}`}>
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 ${cfg.text} flex-shrink-0 mt-0.5`} />
                  <div>
                    <p className={`text-sm font-bold ${cfg.text}`}>{issue.label}</p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">{issue.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
