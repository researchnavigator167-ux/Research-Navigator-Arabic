import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/lib/AppContext';
import { computeProjectProgress, fetchActivityLog, fetchMembers } from '@/lib/collaboration';
import { Spinner } from '@/components/ui';
import { TrendingUp, FileText, LayoutGrid, StickyNote, CheckCircle2, Users, Activity } from 'lucide-react';
import type { ProjectMember, ProjectActivity, ResearchProject } from '@/types';

export function ProjectDashboard({ project }: { project: ResearchProject }) {
  const { t } = useApp();
  const [progress, setProgress] = useState(0);
  const [counts, setCounts] = useState({ sources: 0, evidence: 0, notes: 0, tasksDone: 0, tasksTotal: 0 });
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [activity, setActivity] = useState<ProjectActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [prog, memberData, activityData, src, evi, notes, tasksDone, tasksTotal] = await Promise.all([
        computeProjectProgress(project.id),
        fetchMembers(project.id),
        fetchActivityLog(project.id, 10),
        supabase.from('sources').select('id', { count: 'exact' }).eq('project_id', project.id),
        supabase.from('evidence_items').select('id', { count: 'exact' }).eq('project_id', project.id),
        supabase.from('notes').select('id', { count: 'exact' }).eq('project_id', project.id),
        supabase.from('project_tasks').select('id', { count: 'exact' }).eq('project_id', project.id).eq('status', 'done'),
        supabase.from('project_tasks').select('id', { count: 'exact' }).eq('project_id', project.id),
      ]);
      setProgress(prog);
      setMembers(memberData);
      setActivity(activityData);
      setCounts({
        sources: src.count || 0,
        evidence: evi.count || 0,
        notes: notes.count || 0,
        tasksDone: tasksDone.count || 0,
        tasksTotal: tasksTotal.count || 0,
      });
      setLoading(false);
    }
    load();
  }, [project.id]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'الآن';
    if (mins < 60) return `${mins} د`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} س`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ي`;
    return date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
  };

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>;

  const statCards = [
    { icon: FileText, label: t('sourceCount'), value: counts.sources, color: 'text-primary-700 dark:text-primary-400' },
    { icon: LayoutGrid, label: t('evidenceCount'), value: counts.evidence, color: 'text-accent-600 dark:text-accent-400' },
    { icon: StickyNote, label: t('notesCount'), value: counts.notes, color: 'text-warning-600 dark:text-warning-400' },
    { icon: CheckCircle2, label: t('tasksCompleted'), value: `${counts.tasksDone}/${counts.tasksTotal}`, color: 'text-success-600 dark:text-success-400' },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Progress */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-primary-700 dark:text-primary-400" />
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white">{t('projectProgress')}</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-3 bg-neutral-100 rounded-full overflow-hidden dark:bg-neutral-800">
            <div className="h-full bg-gradient-to-r from-primary-600 to-primary-700 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-lg font-bold text-primary-700 dark:text-primary-400">{progress}%</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${stat.color}`} />
                <span className="text-[10px] text-neutral-500">{stat.label}</span>
              </div>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Team */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-primary-700 dark:text-primary-400" />
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white">{t('teamMembers')}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {members.length === 0 ? (
            <p className="text-xs text-neutral-400">{t('noMembers')}</p>
          ) : (
            members.map((m) => (
              <div key={m.id} className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg px-3 py-1.5">
                <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-primary-700 dark:text-primary-400">?</span>
                </div>
                <span className="text-xs text-neutral-600 dark:text-neutral-400">
                  {m.role === 'owner' ? t('roleOwner') : m.role === 'editor' ? t('roleEditor') : t('roleViewer')}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Activity */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-primary-700 dark:text-primary-400" />
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white">{t('recentActivity')}</h3>
        </div>
        {activity.length === 0 ? (
          <p className="text-xs text-neutral-400">{t('noActivity')}</p>
        ) : (
          <div className="space-y-2">
            {activity.map((act) => (
              <div key={act.id} className="flex items-start gap-2 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-400 mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-neutral-700 dark:text-neutral-300">{act.description || act.action}</span>
                  <span className="text-neutral-400 mr-2"> · {formatDate(act.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
