import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/lib/AppContext';
import { FolderOpen, Plus, Inbox, Users, Trash2 } from 'lucide-react';
import { EmptyState, SkeletonCard } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import type { ResearchProject } from '@/types';

interface ResearchListProps {
  onNewResearch: () => void;
  onOpenProject: (project: ResearchProject) => void;
}

export function ResearchList({ onNewResearch, onOpenProject }: ResearchListProps) {
  const { t } = useApp();
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [sharedIds, setSharedIds] = useState<Set<string>>(new Set());
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ResearchProject | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [projRes, memberRes] = await Promise.all([
        supabase.from('research_projects').select('*').order('updated_at', { ascending: false }),
        supabase.from('project_members').select('project_id, role'),
      ]);
      setProjects(projRes.data || []);
      const owned = new Set<string>();
      const shared = new Set<string>();
      (memberRes.data || []).forEach((m: { project_id: string; role: string }) => {
        if (m.role !== 'owner') shared.add(m.project_id);
        else owned.add(m.project_id);
      });
      setSharedIds(shared);
      setOwnedIds(owned);
      setLoading(false);
    }
    load();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('research_projects').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (!error) {
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  };

  return (
    <div className="min-h-screen pb-24 bg-neutral-50 dark:bg-neutral-950">
      <div className="bg-white dark:bg-neutral-900 px-5 pt-12 pb-4 border-b border-neutral-100 dark:border-neutral-800 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">{t('navResearch')}</h1>
          <button onClick={onNewResearch} className="w-10 h-10 rounded-xl bg-primary-700 flex items-center justify-center active:scale-95 transition-all">
            <Plus className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <div className="space-y-3">
            <SkeletonCard />
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
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-bold text-sm text-neutral-900 dark:text-white">{project.title}</h3>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`badge ${
                      project.status === 'active' ? 'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400' :
                      project.status === 'completed' ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' :
                      'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                    }`}>
                      {project.status === 'active' ? t('statusActive') : project.status === 'completed' ? t('statusCompleted') : t('statusPaused')}
                    </span>
                    {ownedIds.has(project.id) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(project); }}
                        className="text-neutral-300 hover:text-error-500 p-1 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                {project.topic && <p className="text-xs text-neutral-500 mb-2 line-clamp-2">{project.topic}</p>}
                {project.research_question && (
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg px-3 py-2 line-clamp-2 mb-2">
                    {project.research_question}
                  </p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {project.field && (
                    <span className="badge bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">{project.field}</span>
                  )}
                  {sharedIds.has(project.id) && (
                    <span className="badge bg-accent-50 text-accent-700 dark:bg-accent-900/20 dark:text-accent-400 text-[10px]">
                      <Users className="w-3 h-3" /> {t('sharedProject')}
                    </span>
                  )}
                  {project.keywords?.slice(0, 2).map((kw) => (
                    <span key={kw} className="badge bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">{kw}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('deleteProject')} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('deleteProjectConfirm')}</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteTarget(null)} className="btn-ghost flex-1 text-sm">{t('cancel')}</button>
            <button onClick={handleDelete} disabled={deleting} className="btn-primary flex-1 text-sm bg-error-600 hover:bg-error-700">
              {deleting ? t('loading') : t('delete')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
