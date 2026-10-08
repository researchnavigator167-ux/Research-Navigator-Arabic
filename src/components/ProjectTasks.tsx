import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useApp } from '@/lib/AppContext';
import { fetchTasks, createTask, updateTask, deleteTask } from '@/lib/collaboration';
import { fetchMembers } from '@/lib/collaboration';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, Spinner } from '@/components/ui';
import { Plus, CheckCircle2, Circle, Clock, Trash2, X, Flag, Calendar } from 'lucide-react';
import type { ProjectTask, TaskStatus, TaskPriority, ProjectMember, ResearchProject } from '@/types';

export function ProjectTasks({ project }: { project: ResearchProject }) {
  const { user } = useAuth();
  const { t } = useApp();
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<ProjectTask | null>(null);
  const [form, setForm] = useState({ title: '', description: '', assigned_to: '', priority: 'medium' as TaskPriority, due_date: '' });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [taskData, memberData] = await Promise.all([
          fetchTasks(project.id),
          fetchMembers(project.id),
        ]);
        if (cancelled) return;
        setTasks(taskData);
        setMembers(memberData);
      } catch {
        if (!cancelled) setError(t('error'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [project.id, t]);

  const handleCreate = async () => {
    if (!form.title.trim() || !user) return;
    try {
      const newTask = await createTask(project.id, user.id, {
        title: form.title,
        description: form.description || undefined,
        assigned_to: form.assigned_to || undefined,
        priority: form.priority,
        due_date: form.due_date || undefined,
      });
      if (newTask) {
        setTasks((prev) => [newTask, ...prev]);
        setShowAdd(false);
        setForm({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '' });
      }
    } catch { /* ignore */ }
  };

  const handleStatusToggle = async (task: ProjectTask) => {
    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : task.status === 'todo' ? 'in_progress' : 'done';
    setTasks((prev) => prev.map((tk) => (tk.id === task.id ? { ...tk, status: newStatus } : tk)));
    await updateTask(task.id, { status: newStatus }, project.id, user?.id);
  };

  const handleDelete = async (taskId: string) => {
    await deleteTask(taskId);
    setTasks((prev) => prev.filter((tk) => tk.id !== taskId));
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    await updateTask(editing.id, {
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      assigned_to: form.assigned_to || null,
      due_date: form.due_date || null,
    });
    setTasks((prev) => prev.map((tk) => (tk.id === editing.id ? {
      ...tk, title: form.title, description: form.description, priority: form.priority,
      assigned_to: form.assigned_to || null, due_date: form.due_date || null,
    } : tk)));
    setEditing(null);
    setForm({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '' });
  };

  const openEdit = (task: ProjectTask) => {
    setEditing(task);
    setForm({
      title: task.title,
      description: task.description || '',
      assigned_to: task.assigned_to || '',
      priority: task.priority,
      due_date: task.due_date || '',
    });
  };

  const completed = tasks.filter((t) => t.status === 'done').length;
  const progress = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

  const statusIcons: Record<TaskStatus, typeof Circle> = {
    todo: Circle,
    in_progress: Clock,
    done: CheckCircle2,
  };

  const statusColors: Record<TaskStatus, string> = {
    todo: 'text-neutral-400',
    in_progress: 'text-warning-500',
    done: 'text-success-500',
  };

  const priorityColors: Record<TaskPriority, string> = {
    low: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
    medium: 'bg-warning-50 text-warning-700 dark:bg-warning-900/20 dark:text-warning-400',
    high: 'bg-error-50 text-error-700 dark:bg-error-900/20 dark:text-error-400',
  };

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="animate-fade-in">
      {tasks.length > 0 && (
        <div className="card mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-500">{t('tasksProgress')}</span>
            <span className="text-sm font-bold text-primary-700 dark:text-primary-400">{progress}%</span>
          </div>
          <div className="h-2 bg-neutral-100 rounded-full overflow-hidden dark:bg-neutral-800">
            <div className="h-full bg-primary-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-neutral-400 mt-2">{completed}/{tasks.length} {t('taskDone')}</p>
        </div>
      )}

      <button onClick={() => { setShowAdd(true); setForm({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '' }); }} className="btn-primary w-full mb-4 text-xs">
        <Plus className="w-4 h-4" /> {t('addTask')}
      </button>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="w-8 h-8 text-primary-700 dark:text-primary-400" />}
          title={t('noTasks')}
          description={t('noTasksDesc')}
        />
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const StatusIcon = statusIcons[task.status];
            const assignee = members.find((m) => m.user_id === task.assigned_to);
            return (
              <div key={task.id} className="card">
                <div className="flex items-start gap-3">
                  <button onClick={() => handleStatusToggle(task)} className={`flex-shrink-0 mt-0.5 ${statusColors[task.status]}`}>
                    <StatusIcon className="w-5 h-5" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-neutral-400' : 'text-neutral-900 dark:text-white'}`}>
                      {task.title}
                    </h3>
                    {task.description && <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{task.description}</p>}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`badge ${priorityColors[task.priority]} text-[10px]`}>
                        <Flag className="w-3 h-3" /> {t(`priority${task.priority.charAt(0).toUpperCase()}${task.priority.slice(1)}` as string)}
                      </span>
                      {task.due_date && (
                        <span className="badge bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 text-[10px]">
                          <Calendar className="w-3 h-3" /> {task.due_date}
                        </span>
                      )}
                      {assignee && (
                        <span className="text-[10px] text-neutral-400">
                          {assignee.user_id === user?.id ? t('you') : assignee.user_id.substring(0, 6) + '...'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => openEdit(task)} className="text-neutral-300 hover:text-primary-500 p-1">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(task.id)} className="text-neutral-300 hover:text-error-500 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={showAdd || !!editing}
        onClose={() => { setShowAdd(false); setEditing(null); }}
        title={editing ? t('editTask') : t('addTask')}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">{t('taskTitle')}</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-field"
              placeholder={t('taskTitle')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">{t('taskDescription')}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-field min-h-[60px] resize-none"
              placeholder={t('taskDescription')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">{t('taskAssignee')}</label>
            <select
              value={form.assigned_to}
              onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
              className="input-field"
            >
              <option value="">{t('unassigned')}</option>
              {members.map((m) => (
                <option key={m.id} value={m.user_id}>
                  {m.user_id === user?.id ? t('you') : m.user_id.substring(0, 8) + '...'}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">{t('taskPriority')}</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
                className="input-field"
              >
                <option value="low">{t('priorityLow')}</option>
                <option value="medium">{t('priorityMedium')}</option>
                <option value="high">{t('priorityHigh')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">{t('taskDueDate')}</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="input-field"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowAdd(false); setEditing(null); }} className="btn-ghost flex-1 text-xs">
              <X className="w-4 h-4" /> {t('cancel')}
            </button>
            <button
              onClick={editing ? handleSaveEdit : handleCreate}
              disabled={!form.title.trim()}
              className="btn-primary flex-1 text-xs"
            >
              {t('save')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>;
}
