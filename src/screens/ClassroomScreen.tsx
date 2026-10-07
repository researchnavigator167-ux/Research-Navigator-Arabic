import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/lib/AppContext';
import { useAuth } from '@/lib/AuthContext';
import { GraduationCap, Plus, Users, ClipboardList, BookOpen, ArrowRight, Loader as Loader2, Copy, Check, Search } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, Spinner } from '@/components/ui';
import {
  fetchDoctorClasses, fetchStudentClasses, createClass,
  joinClassByCode, getClassMemberCount,
} from '@/lib/classroom';
import type { ClassRoom, UserRole } from '@/types';

interface ClassroomScreenProps {
  role: UserRole | null;
  onOpenClass: (classRoom: ClassRoom) => void;
}

export function ClassroomScreen({ role, onOpenClass }: ClassroomScreenProps) {
  const { t, isRTL } = useApp();
  const { user } = useAuth();

  if (!role) {
    return <RoleSelectionScreen />;
  }

  if (role === 'doctor') {
    return <DoctorClassList onOpenClass={onOpenClass} />;
  }

  return <StudentClassList onOpenClass={onOpenClass} userId={user?.id || ''} />;
}

// ============================================================================
// Role Selection
// ============================================================================
function RoleSelectionScreen() {
  const { t } = useApp();
  const { user, setRole } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!selectedRole || !user) return;
    setSaving(true);
    setError(null);
    const { error } = await setRole(selectedRole, displayName.trim() || undefined);
    if (error) setError(error);
    setSaving(false);
  };

  return (
    <div className="min-h-screen pb-24 bg-neutral-50 dark:bg-neutral-950">
      <div className="bg-white dark:bg-neutral-900 px-5 pt-12 pb-4 border-b border-neutral-100 dark:border-neutral-800 sticky top-0 z-30">
        <h1 className="text-xl font-bold text-neutral-900 dark:text-white">{t('classroomTitle')}</h1>
        <p className="text-sm text-neutral-500 mt-1">{t('classroomSubtitle')}</p>
      </div>

      <div className="px-5 py-6 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-700 flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">{t('selectRole')}</h2>
        </div>

        <div className="space-y-3">
          <RoleCard
            icon={<GraduationCap className="w-7 h-7" />}
            label={t('roleDoctor')}
            description={t('createClass')}
            selected={selectedRole === 'doctor'}
            onClick={() => setSelectedRole('doctor')}
          />
          <RoleCard
            icon={<BookOpen className="w-7 h-7" />}
            label={t('roleStudent')}
            description={t('joinClass')}
            selected={selectedRole === 'student'}
            onClick={() => setSelectedRole('student')}
          />
        </div>

        {selectedRole && (
          <div className="animate-fade-in space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">
                {t('displayName')}
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('displayNamePlaceholder')}
                className="input-field"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-error-50 dark:bg-error-900/20 px-4 py-3 text-sm text-error-700 dark:text-error-400">
                {error}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary w-full"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('saveRole')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RoleCard({
  icon, label, description, selected, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-start ${
        selected
          ? 'border-primary-700 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-500'
          : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
      }`}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
        selected ? 'bg-primary-700 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
      }`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-bold ${selected ? 'text-primary-700 dark:text-primary-400' : 'text-neutral-900 dark:text-white'}`}>{label}</p>
        <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
      </div>
      {selected && (
        <div className="w-6 h-6 rounded-full bg-primary-700 flex items-center justify-center flex-shrink-0">
          <Check className="w-4 h-4 text-white" />
        </div>
      )}
    </button>
  );
}

// ============================================================================
// Doctor Class List
// ============================================================================
function DoctorClassList({ onOpenClass }: { onOpenClass: (c: ClassRoom) => void }) {
  const { t, isRTL } = useApp();
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchDoctorClasses(user.id);
      setClasses(data);
      const counts: Record<string, number> = {};
      await Promise.all(data.map(async (c) => {
        counts[c.id] = await getClassMemberCount(c.id);
      }));
      setMemberCounts(counts);
    } catch {
      setClasses([]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const ArrowIcon = ArrowRight;
  const arrowClass = isRTL ? 'rotate-180' : '';

  return (
    <div className="min-h-screen pb-24 bg-neutral-50 dark:bg-neutral-950">
      <div className="bg-white dark:bg-neutral-900 px-5 pt-12 pb-4 border-b border-neutral-100 dark:border-neutral-800 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">{t('doctorDashboard')}</h1>
            <p className="text-sm text-neutral-500 mt-0.5">{t('classroomSubtitle')}</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="w-10 h-10 rounded-xl bg-primary-700 flex items-center justify-center text-white hover:bg-primary-800 transition-colors flex-shrink-0"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : classes.length === 0 ? (
          <EmptyState
            icon={<GraduationCap className="w-8 h-8 text-primary-700 dark:text-primary-400" />}
            title={t('noClasses')}
            description={t('noClassesDesc')}
            action={
              <button onClick={() => setShowCreate(true)} className="btn-primary">
                <Plus className="w-4 h-4 inline-block ms-1" />
                {t('createClass')}
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {classes.map((cls) => (
              <ClassCard
                key={cls.id}
                classRoom={cls}
                memberCount={memberCounts[cls.id] || 0}
                onClick={() => onOpenClass(cls)}
              />
            ))}
          </div>
        )}
      </div>

      <CreateClassModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(cls) => {
          setShowCreate(false);
          onOpenClass(cls);
        }}
      />
    </div>
  );
}

// ============================================================================
// Student Class List
// ============================================================================
function StudentClassList({ onOpenClass, userId }: { onOpenClass: (c: ClassRoom) => void; userId: string }) {
  const { t } = useApp();
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await fetchStudentClasses(userId);
      setClasses(data);
    } catch {
      setClasses([]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setJoining(true);
    setJoinError(null);
    const { error, classRoom } = await joinClassByCode(joinCode.trim(), userId);
    if (error) {
      setJoinError(error === 'alreadyMember' ? t('alreadyMember') : t('invalidJoinCode'));
    } else if (classRoom) {
      setShowJoin(false);
      setJoinCode('');
      onOpenClass(classRoom);
    }
    setJoining(false);
  };

  return (
    <div className="min-h-screen pb-24 bg-neutral-50 dark:bg-neutral-950">
      <div className="bg-white dark:bg-neutral-900 px-5 pt-12 pb-4 border-b border-neutral-100 dark:border-neutral-800 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">{t('studentDashboard')}</h1>
            <p className="text-sm text-neutral-500 mt-0.5">{t('classroomSubtitle')}</p>
          </div>
          <button
            onClick={() => setShowJoin(true)}
            className="w-10 h-10 rounded-xl bg-primary-700 flex items-center justify-center text-white hover:bg-primary-800 transition-colors flex-shrink-0"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : classes.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="w-8 h-8 text-primary-700 dark:text-primary-400" />}
            title={t('noJoinedClasses')}
            description={t('noJoinedClassesDesc')}
            action={
              <button onClick={() => setShowJoin(true)} className="btn-primary">
                {t('joinClass')}
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {classes.map((cls) => (
              <ClassCard
                key={cls.id}
                classRoom={cls}
                onClick={() => onOpenClass(cls)}
              />
            ))}
          </div>
        )}
      </div>

      <Modal open={showJoin} onClose={() => { setShowJoin(false); setJoinError(null); }} title={t('joinClass')} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">{t('enterJoinCode')}</label>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder={t('joinCodePlaceholder')}
              className="input-field text-center text-lg font-mono tracking-widest"
              maxLength={8}
            />
          </div>
          {joinError && (
            <div className="rounded-xl bg-error-50 dark:bg-error-900/20 px-4 py-3 text-sm text-error-700 dark:text-error-400">
              {joinError}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => { setShowJoin(false); setJoinError(null); }} className="btn-ghost flex-1 text-sm">
              {t('cancel')}
            </button>
            <button
              onClick={handleJoin}
              disabled={joining || !joinCode.trim()}
              className="btn-primary flex-1 text-sm"
            >
              {joining ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('joinClass')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================================
// Shared Class Card
// ============================================================================
function ClassCard({
  classRoom, memberCount, onClick,
}: {
  classRoom: ClassRoom;
  memberCount?: number;
  onClick: () => void;
}) {
  const { t, isRTL } = useApp();
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(classRoom.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const ArrowIcon = ArrowRight;
  const arrowClass = isRTL ? 'rotate-180' : '';

  return (
    <div
      onClick={onClick}
      className="card cursor-pointer hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white truncate">{classRoom.name}</h3>
          {classRoom.course_code && (
            <p className="text-xs text-primary-700 dark:text-primary-400 font-medium mt-0.5">{classRoom.course_code}</p>
          )}
        </div>
        <span className={`badge text-[10px] ${
          classRoom.is_active
            ? 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-400'
            : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800'
        }`}>
          {classRoom.is_active ? t('classActive') : t('classInactive')}
        </span>
      </div>

      {classRoom.description && (
        <p className="text-xs text-neutral-500 line-clamp-2 mb-3">{classRoom.description}</p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {memberCount !== undefined && (
            <span className="flex items-center gap-1 text-xs text-neutral-500">
              <Users className="w-3.5 h-3.5" />
              {memberCount} {t('students')}
            </span>
          )}
          {classRoom.academic_year && (
            <span className="text-xs text-neutral-400">{classRoom.academic_year}</span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs font-mono text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2 py-1 rounded-lg"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {classRoom.join_code}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Create Class Modal
// ============================================================================
function CreateClassModal({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (cls: ClassRoom) => void;
}) {
  const { t } = useApp();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [section, setSection] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim() || !user) return;
    setSaving(true);
    setError(null);
    try {
      const cls = await createClass(user.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        course_code: courseCode.trim() || undefined,
        section: section.trim() || undefined,
        academic_year: academicYear.trim() || undefined,
      });
      if (cls) {
        setName(''); setDescription(''); setCourseCode(''); setSection(''); setAcademicYear('');
        onCreated(cls);
      }
    } catch {
      setError(t('error'));
    }
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={onClose} title={t('createClass')} size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">{t('className')} *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('className')}
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">{t('classDescription')}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('classDescription')}
            className="input-field min-h-[80px] resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">{t('courseCode')}</label>
            <input
              type="text"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              placeholder="CS101"
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">{t('classSection')}</label>
            <input
              type="text"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="A"
              className="input-field"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">{t('academicYear')}</label>
          <input
            type="text"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            placeholder="2026-2027"
            className="input-field"
          />
        </div>

        {error && (
          <div className="rounded-xl bg-error-50 dark:bg-error-900/20 px-4 py-3 text-sm text-error-700 dark:text-error-400">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm">{t('cancel')}</button>
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim()}
            className="btn-primary flex-1 text-sm"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('createClass')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
