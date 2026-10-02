import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useApp } from '@/lib/AppContext';
import { fetchEvents, createEvent, deleteEvent, fetchTasks } from '@/lib/collaboration';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, Spinner } from '@/components/ui';
import { Plus, Calendar, Trash2, Clock, Flag, CheckSquare, Users } from 'lucide-react';
import type { ProjectEvent, EventType, ProjectTask, ResearchProject } from '@/types';

const EVENT_ICONS: Record<EventType, typeof Calendar> = {
  deadline: Flag,
  meeting: Users,
  milestone: CheckSquare,
  review: Clock,
  other: Calendar,
};

const EVENT_COLORS: Record<EventType, string> = {
  deadline: 'bg-error-50 text-error-700 dark:bg-error-900/20 dark:text-error-400',
  meeting: 'bg-accent-50 text-accent-700 dark:bg-accent-900/20 dark:text-accent-400',
  milestone: 'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400',
  review: 'bg-warning-50 text-warning-700 dark:bg-warning-900/20 dark:text-warning-400',
  other: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
};

function isUpcoming(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr) >= today;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return 'اليوم';
  if (date.toDateString() === tomorrow.toDateString()) return 'غدًا';
  return date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function ProjectCalendar({ project }: { project: ResearchProject }) {
  const { user } = useAuth();
  const { t } = useApp();
  const [events, setEvents] = useState<ProjectEvent[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', event_date: '', event_type: 'deadline' as EventType });

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [eventData, taskData] = await Promise.all([
        fetchEvents(project.id),
        fetchTasks(project.id),
      ]);
      setEvents(eventData);
      setTasks(taskData);
      setLoading(false);
    }
    load();
  }, [project.id]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.event_date || !user) return;
    try {
      const newEvent = await createEvent(project.id, user.id, {
        title: form.title,
        description: form.description || undefined,
        event_date: form.event_date,
        event_type: form.event_type,
      });
      if (newEvent) {
        setEvents((prev) => [...prev, newEvent].sort((a, b) => a.event_date.localeCompare(b.event_date)));
        setShowAdd(false);
        setForm({ title: '', description: '', event_date: '', event_type: 'deadline' });
      }
    } catch { /* ignore */ }
  };

  const handleDelete = async (eventId: string) => {
    await deleteEvent(eventId);
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
  };

  const taskEvents = tasks
    .filter((tk) => tk.due_date)
    .map((tk) => ({
      id: `task-${tk.id}`,
      title: tk.title,
      description: t('taskDueDate'),
      event_date: tk.due_date!,
      event_type: 'deadline' as EventType,
      isTask: true,
      task_id: tk.id,
    }));

  const allEvents = [...events.map((e) => ({ ...e, isTask: false })), ...taskEvents].sort(
    (a, b) => a.event_date.localeCompare(b.event_date)
  );

  const upcoming = allEvents.filter((e) => isUpcoming(e.event_date));
  const past = allEvents.filter((e) => !isUpcoming(e.event_date)).reverse();

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>;

  return (
    <div className="animate-fade-in">
      <button onClick={() => setShowAdd(true)} className="btn-primary w-full mb-4 text-xs">
        <Plus className="w-4 h-4" /> {t('addEvent')}
      </button>

      {allEvents.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-8 h-8 text-primary-700 dark:text-primary-400" />}
          title={t('noEvents')}
          description={t('noEventsDesc')}
        />
      ) : (
        <div className="space-y-4">
          {upcoming.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-neutral-500 mb-2">{t('upcomingEvents')}</h3>
              <div className="space-y-2">
                {upcoming.map((event) => {
                  const Icon = EVENT_ICONS[event.event_type] || Calendar;
                  const isTaskEvent = 'isTask' in event && event.isTask;
                  return (
                    <div key={event.id} className="card flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${EVENT_COLORS[event.event_type]}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{event.title}</p>
                        <p className="text-[10px] text-neutral-400">{formatDateLabel(event.event_date)}</p>
                        {event.description && <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{event.description}</p>}
                      </div>
                      {!isTaskEvent && 'id' in event && (
                        <button onClick={() => handleDelete(event.id)} className="text-neutral-300 hover:text-error-500 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-neutral-400 mb-2">{t('pastEvents')}</h3>
              <div className="space-y-2 opacity-60">
                {past.map((event) => {
                  const Icon = EVENT_ICONS[event.event_type] || Calendar;
                  return (
                    <div key={event.id} className="card flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${EVENT_COLORS[event.event_type]}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 truncate">{event.title}</p>
                        <p className="text-[10px] text-neutral-400">{formatDateLabel(event.event_date)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={t('addEvent')} size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">{t('eventTitle')}</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-field"
              placeholder={t('eventTitle')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">{t('eventDate')}</label>
              <input
                type="date"
                value={form.event_date}
                onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">{t('eventType')}</label>
              <select
                value={form.event_type}
                onChange={(e) => setForm({ ...form, event_type: e.target.value as EventType })}
                className="input-field"
              >
                <option value="deadline">{t('eventDeadline')}</option>
                <option value="meeting">{t('eventMeeting')}</option>
                <option value="milestone">{t('eventMilestone')}</option>
                <option value="review">{t('eventReview')}</option>
                <option value="other">{t('eventOther')}</option>
              </select>
            </div>
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
          <button onClick={handleCreate} disabled={!form.title.trim() || !form.event_date} className="btn-primary w-full">
            {t('addEvent')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
