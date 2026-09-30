import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useApp } from '@/lib/AppContext';
import { Plus, Search, Bot, FolderOpen, FileText, BarChart3, BookOpen, ArrowRight, Inbox } from 'lucide-react';
import { EmptyState, SkeletonCard } from '@/components/ui';
import type { ResearchProject, Source } from '@/types';

interface HomeScreenProps {
  onNewResearch: () => void;
  onOpenProject: (project: ResearchProject) => void;
  onNavigate: (tab: 'discover' | 'assistant') => void;
}

export function HomeScreen({ onNewResearch, onOpenProject, onNavigate }: HomeScreenProps) {
  const { user } = useAuth();
  const { t, isRTL } = useApp();
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [recentSources, setRecentSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [projRes, srcRes] = await Promise.all([
        supabase.from('research_projects').select('*').order('updated_at', { ascending: false }).limit(3),
        supabase.from('sources').select('*').order('created_at', { ascending: false }).limit(3),
      ]);
      setProjects(projRes.data || []);
      setRecentSources(srcRes.data || []);
      setLoading(false);
    }
    load();
  }, []);

  const ArrowIcon = ArrowRight;
  const arrowClass = isRTL ? 'rotate-180' : '';

  return (
    <div className="min-h-screen pb-24 bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary-700 to-primary-800 px-5 pt-12 pb-8 rounded-b-3xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white/70 text-xs">{t('welcomeBack')}</p>
            <p className="text-white font-bold text-sm">{user?.email}</p>
          </div>
        </div>
        <h1 className="text-white text-xl font-bold mb-1">{t('homeWelcome')}</h1>
        <p className="text-white/80 text-sm leading-relaxed">{t('homeSubtitle')}</p>
      </div>

      <div className="px-5 -mt-4">
        {/* Primary CTA */}
        <button
          onClick={onNewResearch}
          className="w-full bg-white dark:bg-neutral-900 rounded-2xl shadow-lg shadow-primary-700/10 p-4 flex items-center gap-4 active:scale-[0.98] transition-all border border-neutral-100 dark:border-neutral-800"
        >
          <div className="w-12 h-12 rounded-xl bg-primary-700 flex items-center justify-center flex-shrink-0">
            <Plus className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 text-start">
            <p className="font-bold text-neutral-900 dark:text-white text-sm">{t('createResearch')}</p>
            <p className="text-xs text-neutral-500 mt-0.5">{t('appTagline')}</p>
          </div>
          <ArrowIcon className={`w-5 h-5 text-primary-700 dark:text-primary-400 ${arrowClass}`} />
        </button>

        {/* Secondary Actions */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <button
            onClick={() => onNavigate('discover')}
            className="bg-white dark:bg-neutral-900 rounded-2xl p-4 flex flex-col items-start gap-2 active:scale-[0.98] transition-all border border-neutral-100 dark:border-neutral-800"
          >
            <div className="w-10 h-10 rounded-xl bg-accent-50 dark:bg-accent-900/30 flex items-center justify-center">
              <Search className="w-5 h-5 text-accent-600 dark:text-accent-400" />
            </div>
            <p className="text-sm font-semibold text-neutral-900 dark:text-white">{t('exploreSources')}</p>
          </button>
          <button
            onClick={() => onNavigate('assistant')}
            className="bg-white dark:bg-neutral-900 rounded-2xl p-4 flex flex-col items-start gap-2 active:scale-[0.98] transition-all border border-neutral-100 dark:border-neutral-800"
          >
            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary-700 dark:text-primary-400" />
            </div>
            <p className="text-sm font-semibold text-neutral-900 dark:text-white">{t('askAssistant')}</p>
          </button>
        </div>
      </div>

      {/* Recent Projects */}
      <div className="px-5 mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-neutral-900 dark:text-white">{t('recentResearch')}</h2>
        </div>

        {loading ? (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<FolderOpen className="w-8 h-8 text-primary-700 dark:text-primary-400" />}
            title={t('noProjects')}
            description={t('noProjectsDesc')}
            action={
              <button onClick={onNewResearch} className="btn-primary">
                <Plus className="w-4 h-4" />
                {t('createResearch')}
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => onOpenProject(project)}
                className="w-full card text-start active:scale-[0.98] transition-all hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-neutral-900 dark:text-white truncate">{project.title}</h3>
                    {project.topic && (
                      <p className="text-xs text-neutral-500 mt-1 truncate">{project.topic}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      {project.field && (
                        <span className="badge bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                          {project.field}
                        </span>
                      )}
                      <span className="badge bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                        {project.status === 'active' ? t('statusActive') : project.status === 'completed' ? t('statusCompleted') : t('statusPaused')}
                      </span>
                    </div>
                  </div>
                  <ArrowIcon className={`w-5 h-5 text-neutral-300 flex-shrink-0 mt-1 ${arrowClass}`} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recent Sources */}
      {recentSources.length > 0 && (
        <div className="px-5 mt-8">
          <h2 className="text-base font-bold text-neutral-900 dark:text-white mb-3">{t('recentSources')}</h2>
          <div className="space-y-2">
            {recentSources.map((source) => (
              <div key={source.id} className="card">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-2">{source.title}</h3>
                <div className="flex items-center gap-2 mt-2 text-xs text-neutral-500">
                  {source.year && <span>{source.year}</span>}
                  {source.journal && (
                    <>
                      <span>·</span>
                      <span className="truncate">{source.journal}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
