import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/lib/AppContext';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowRight, Users, ClipboardList, Bell, ChartBar as BarChart3, Plus, Copy, Check, Trash2, Loader as Loader2, BookOpen, CircleUser as UserCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, Spinner } from '@/components/ui';
import {
  fetchClassMembers, fetchAssignments, fetchPublishedAssignments,
  fetchAnnouncements, createAnnouncement, deleteAnnouncement,
  deleteAssignment as deleteAssignmentFn,
  getClassStats, leaveClass,
} from '@/lib/classroom';
import type { ClassRoom, ClassMember, Assignment, Announcement } from '@/types';

interface ClassDetailScreenProps {
  classRoom: ClassRoom;
  onBack: () => void;
  onOpenAssignment: (assignmentId: string) => void;
}

type Tab = 'overview' | 'students' | 'assignments' | 'announcements' | 'progress';

export function ClassDetailScreen({ classRoom, onBack, onOpenAssignment }: ClassDetailScreenProps) {
  const { t, isRTL } = useApp();
  const { user, role } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [copied, setCopied] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);

  const isDoctor = classRoom.doctor_id === user?.id;
  const ArrowIcon = ArrowRight;
  const arrowClass = isRTL ? 'rotate-180' : '';

  const tabs: { id: Tab; key: string; icon: typeof Users }[] = [
    { id: 'overview', key: 'workspaceOverview', icon: BookOpen },
    { id: 'assignments', key: 'assignments', icon: ClipboardList },
    { id: 'students', key: 'students', icon: Users },
    { id: 'announcements', key: 'announcements', icon: Bell },
    { id: 'progress', key: 'progress', icon: BarChart3 },
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(classRoom.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = async () => {
    if (!user) return;
    await leaveClass(classRoom.id, user.id);
    onBack();
  };

  return (
    <div className="min-h-screen pb-24 bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 px-5 pt-12 pb-3 border-b border-neutral-100 dark:border-neutral-800 sticky top-0 z-30">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <ArrowIcon className={`w-5 h-5 ${arrowClass}`} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-neutral-900 dark:text-white truncate">{classRoom.name}</h1>
            {classRoom.course_code && (
              <p className="text-xs text-primary-700 dark:text-primary-400 font-medium">{classRoom.course_code}</p>
            )}
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs font-mono text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-3 py-1.5 rounded-lg flex-shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {classRoom.join_code}
          </button>
        </div>

        {/* Tab Scroller */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {tabs.map((tb) => {
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
        {tab === 'overview' && (
          <OverviewTab classRoom={classRoom} isDoctor={isDoctor} onLeave={() => setLeaveConfirm(true)} />
        )}
        {tab === 'assignments' && (
          <AssignmentsTab
            classRoom={classRoom}
            isDoctor={isDoctor}
            onOpenAssignment={onOpenAssignment}
          />
        )}
        {tab === 'students' && <StudentsTab classRoom={classRoom} isDoctor={isDoctor} />}
        {tab === 'announcements' && (
          <AnnouncementsTab classRoom={classRoom} isDoctor={isDoctor} />
        )}
        {tab === 'progress' && <ProgressTab classRoom={classRoom} isDoctor={isDoctor} />}
      </div>

      {/* Leave Confirm */}
      <Modal open={leaveConfirm} onClose={() => setLeaveConfirm(false)} title={t('leaveClass')} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('leaveClassConfirm')}</p>
          <div className="flex gap-3">
            <button onClick={() => setLeaveConfirm(false)} className="btn-ghost flex-1 text-sm">{t('cancel')}</button>
            <button onClick={handleLeave} className="btn-primary flex-1 text-sm bg-error-600 hover:bg-error-700">
              {t('leaveClass')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================================
// Overview Tab
// ============================================================================
function OverviewTab({ classRoom, isDoctor, onLeave }: { classRoom: ClassRoom; isDoctor: boolean; onLeave: () => void }) {
  const { t } = useApp();
  const [stats, setStats] = useState({ studentCount: 0, assignmentCount: 0, submissionCount: 0 });

  useEffect(() => {
    getClassStats(classRoom.id).then(setStats).catch(() => {});
  }, [classRoom.id]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="card">
        {classRoom.description && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">{classRoom.description}</p>
        )}

        <div className="grid grid-cols-3 gap-2">
          <StatBox label={t('studentsCount')} value={stats.studentCount} />
          <StatBox label={t('assignmentsCount')} value={stats.assignmentCount} />
          <StatBox label={t('submissionsCount')} value={stats.submissionCount} />
        </div>

        <div className="mt-4 space-y-2">
          {classRoom.section && (
            <InfoRow label={t('classSection')} value={classRoom.section} />
          )}
          {classRoom.academic_year && (
            <InfoRow label={t('academicYear')} value={classRoom.academic_year} />
          )}
        </div>
      </div>

      <div className="card bg-primary-50 dark:bg-primary-900/20 border-0">
        <p className="text-xs text-primary-700 dark:text-primary-400 font-medium mb-1">{t('joinCode')}</p>
        <p className="text-2xl font-mono font-bold text-primary-700 dark:text-primary-400 tracking-widest">{classRoom.join_code}</p>
        <p className="text-xs text-neutral-500 mt-2">{t('shareCode')}</p>
      </div>

      {!isDoctor && (
        <button onClick={onLeave} className="btn-ghost w-full text-sm text-error-600 dark:text-error-400">
          {t('leaveClass')}
        </button>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-3 text-center">
      <p className="text-xl font-bold text-primary-700 dark:text-primary-400">{value}</p>
      <p className="text-[10px] text-neutral-500 mt-0.5">{label}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium text-neutral-700 dark:text-neutral-300">{value}</span>
    </div>
  );
}

// ============================================================================
// Assignments Tab
// ============================================================================
function AssignmentsTab({
  classRoom, isDoctor, onOpenAssignment,
}: {
  classRoom: ClassRoom;
  isDoctor: boolean;
  onOpenAssignment: (id: string) => void;
}) {
  const { t } = useApp();
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [userProjects, setUserProjects] = useState<{ id: string; title: string }[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = isDoctor
        ? await fetchAssignments(classRoom.id)
        : await fetchPublishedAssignments(classRoom.id);
      setAssignments(data);
    } catch {
      setAssignments([]);
    }
    setLoading(false);
  }, [classRoom.id, isDoctor]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isDoctor && user) {
      supabase.from('research_projects').select('id, title').eq('user_id', user.id).order('created_at', { ascending: false })
        .then(({ data }) => setUserProjects(data || []));
    }
  }, [isDoctor, user]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await deleteAssignmentFn(deleteTarget.id);
    setDeleting(false);
    if (!error) {
      setAssignments((prev) => prev.filter((a) => a.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-3 animate-fade-in">
      {isDoctor && (
        <button onClick={() => setShowCreate(true)} className="btn-primary w-full text-sm">
          <Plus className="w-4 h-4 inline-block ms-1" />
          {t('createAssignment')}
        </button>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="w-8 h-8 text-primary-700 dark:text-primary-400" />}
          title={isDoctor ? t('noAssignments') : t('noAssignmentsStudent')}
          description={isDoctor ? t('noAssignmentsDesc') : ''}
        />
      ) : (
        assignments.map((a) => (
          <AssignmentCard
            key={a.id}
            assignment={a}
            isDoctor={isDoctor}
            onClick={() => onOpenAssignment(a.id)}
            onDelete={() => setDeleteTarget(a)}
          />
        ))
      )}

      {showCreate && (
        <CreateAssignmentModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          classId={classRoom.id}
          doctorId={user?.id || ''}
          userProjects={userProjects}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('deleteAssignment')} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('deleteAssignmentConfirm')}</p>
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

function AssignmentCard({ assignment, isDoctor, onClick, onDelete }: { assignment: Assignment; isDoctor: boolean; onClick: () => void; onDelete: () => void }) {
  const { t } = useApp();
  const typeIcons: Record<string, string> = {
    text: t('typeText'),
    file: t('typeFile'),
    research_project: t('typeResearchProject'),
  };

  return (
    <div className="card cursor-pointer hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex-1">{assignment.title}</h3>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`badge text-[10px] ${
            assignment.is_published
              ? 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-400'
              : 'bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400'
          }`}>
            {assignment.is_published ? t('assignmentPublished') : t('assignmentNotPublished')}
          </span>
          {isDoctor && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-neutral-300 hover:text-error-500 p-1 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {assignment.description && (
        <p className="text-xs text-neutral-500 line-clamp-2 mb-2">{assignment.description}</p>
      )}

      <div onClick={onClick} className="mt-2 flex items-center gap-3 text-xs text-neutral-400">
        <span className="badge bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">{typeIcons[assignment.assignment_type]}</span>
        {assignment.due_date && (
          <span>{new Date(assignment.due_date).toLocaleDateString()}</span>
        )}
        <span className="text-neutral-400">{t('maxGrade')}: {assignment.max_grade}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Create Assignment Modal
// ============================================================================
function CreateAssignmentModal({
  open, onClose, classId, doctorId, userProjects, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  classId: string;
  doctorId: string;
  userProjects: { id: string; title: string }[];
  onCreated: () => void;
}) {
  const { t } = useApp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [type, setType] = useState<'text' | 'file' | 'research_project'>('text');
  const [maxGrade, setMaxGrade] = useState('100');
  const [dueDate, setDueDate] = useState('');
  const [linkedProjectId, setLinkedProjectId] = useState('');
  const [publishNow, setPublishNow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const { createAssignment } = await import('@/lib/classroom');
      await createAssignment(doctorId, {
        class_id: classId,
        title: title.trim(),
        description: description.trim() || undefined,
        instructions: instructions.trim() || undefined,
        assignment_type: type,
        max_grade: parseFloat(maxGrade) || 100,
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
        linked_project_id: linkedProjectId || undefined,
        is_published: publishNow,
      });
      setTitle(''); setDescription(''); setInstructions(''); setMaxGrade('100'); setDueDate(''); setLinkedProjectId(''); setPublishNow(false);
      onCreated();
    } catch {
      setError(t('error'));
    }
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={onClose} title={t('createAssignment')} size="md">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        <div>
          <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">{t('assignmentTitle')} *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" />
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">{t('assignmentDescription')}</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input-field min-h-[60px] resize-none" />
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">{t('assignmentInstructions')}</label>
          <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} className="input-field min-h-[80px] resize-none" />
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">{t('assignmentType')}</label>
          <div className="grid grid-cols-3 gap-2">
            {(['text', 'file', 'research_project'] as const).map((ty) => (
              <button
                key={ty}
                onClick={() => setType(ty)}
                className={`py-2.5 rounded-xl text-xs font-medium transition-all ${
                  type === ty
                    ? 'bg-primary-700 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                {ty === 'text' ? t('typeText') : ty === 'file' ? t('typeFile') : t('typeResearchProject')}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">{t('maxGrade')}</label>
            <input type="number" value={maxGrade} onChange={(e) => setMaxGrade(e.target.value)} className="input-field" min="1" />
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">{t('dueDate')}</label>
            <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input-field" />
          </div>
        </div>

        {type === 'research_project' && userProjects.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">{t('linkResearchProject')}</label>
            <select value={linkedProjectId} onChange={(e) => setLinkedProjectId(e.target.value)} className="input-field">
              <option value="">{t('selectProject')}</option>
              {userProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
        )}

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={publishNow}
            onChange={(e) => setPublishNow(e.target.checked)}
            className="w-5 h-5 rounded text-primary-700"
          />
          <span className="text-sm text-neutral-700 dark:text-neutral-300">{t('publishAssignment')}</span>
        </label>

        {error && (
          <div className="rounded-xl bg-error-50 dark:bg-error-900/20 px-4 py-3 text-sm text-error-700 dark:text-error-400">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm">{t('cancel')}</button>
          <button onClick={handleCreate} disabled={saving || !title.trim()} className="btn-primary flex-1 text-sm">
            {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('createAssignment')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// Students Tab
// ============================================================================
function StudentsTab({ classRoom, isDoctor }: { classRoom: ClassRoom; isDoctor: boolean }) {
  const { t } = useApp();
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClassMembers(classRoom.id)
      .then(setMembers)
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, [classRoom.id]);

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  if (members.length === 0) {
    return (
      <EmptyState
        icon={<Users className="w-8 h-8 text-primary-700 dark:text-primary-400" />}
        title={t('noStudentsInClass')}
        description={t('joinCodeHint')}
      />
    );
  }

  return (
    <div className="space-y-2 animate-fade-in">
      {members.map((m) => (
        <div key={m.id} className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {(m.display_name || m.email || '?')[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
              {m.display_name || m.email || t('you')}
            </p>
            {m.joined_at && (
              <p className="text-xs text-neutral-400">{new Date(m.joined_at).toLocaleDateString()}</p>
            )}
          </div>
          {m.role && (
            <span className="badge bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-[10px]">
              {m.role === 'doctor' ? t('doctor') : t('student')}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Announcements Tab
// ============================================================================
function AnnouncementsTab({ classRoom, isDoctor }: { classRoom: ClassRoom; isDoctor: boolean }) {
  const { t } = useApp();
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAnnouncements(classRoom.id);
      setAnnouncements(data);
    } catch {
      setAnnouncements([]);
    }
    setLoading(false);
  }, [classRoom.id]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!title.trim() || !user) return;
    setSaving(true);
    try {
      await createAnnouncement(classRoom.id, user.id, title.trim(), body.trim());
      setTitle(''); setBody(''); setShowCreate(false); load();
    } catch {
      // ignore
    }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div className="space-y-3 animate-fade-in">
      {isDoctor && (
        <button onClick={() => setShowCreate(true)} className="btn-primary w-full text-sm">
          <Plus className="w-4 h-4 inline-block ms-1" />
          {t('createAnnouncement')}
        </button>
      )}

      {announcements.length === 0 ? (
        <EmptyState
          icon={<Bell className="w-8 h-8 text-primary-700 dark:text-primary-400" />}
          title={t('noAnnouncements')}
          description=""
        />
      ) : (
        announcements.map((ann) => (
          <div key={ann.id} className="card">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">{ann.title}</h3>
              {isDoctor && ann.doctor_id === user?.id && (
                <button
                  onClick={async () => { await deleteAnnouncement(ann.id); load(); }}
                  className="text-neutral-300 hover:text-error-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            {ann.body && <p className="text-xs text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap">{ann.body}</p>}
            <p className="text-[10px] text-neutral-400 mt-2">{new Date(ann.created_at).toLocaleString()}</p>
          </div>
        ))
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t('createAnnouncement')} size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">{t('announcementTitle')} *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">{t('announcementBody')}</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('announcementBodyPlaceholder')} className="input-field min-h-[100px] resize-none" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowCreate(false)} className="btn-ghost flex-1 text-sm">{t('cancel')}</button>
            <button onClick={handleCreate} disabled={saving || !title.trim()} className="btn-primary flex-1 text-sm">
              {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('postAnnouncement')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================================
// Progress Tab
// ============================================================================
function ProgressTab({ classRoom, isDoctor }: { classRoom: ClassRoom; isDoctor: boolean }) {
  const { t } = useApp();
  const [stats, setStats] = useState({ studentCount: 0, assignmentCount: 0, submissionCount: 0 });

  useEffect(() => {
    getClassStats(classRoom.id).then(setStats).catch(() => {});
  }, [classRoom.id]);

  if (!isDoctor) {
    return (
      <EmptyState
        icon={<BarChart3 className="w-8 h-8 text-primary-700 dark:text-primary-400" />}
        title={t('progress')}
        description={t('noProgress')}
      />
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="card">
        <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-3">{t('studentProgress')}</h3>
        <div className="grid grid-cols-3 gap-2">
          <StatBox label={t('studentsCount')} value={stats.studentCount} />
          <StatBox label={t('assignmentsCount')} value={stats.assignmentCount} />
          <StatBox label={t('submissionsCount')} value={stats.submissionCount} />
        </div>
      </div>
      <p className="text-xs text-neutral-400 text-center">{t('noProgress')}</p>
    </div>
  );
}
