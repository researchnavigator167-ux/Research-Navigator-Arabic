import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/lib/AppContext';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowRight, ClipboardList, FileText, BookOpen, Loader as Loader2, Upload, Send, MessageSquare, Trash2, Check, CircleAlert as AlertCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, Spinner } from '@/components/ui';
import {
  fetchAssignmentById, fetchSubmissionsForAssignment,
  fetchStudentSubmission, submitAssignment,
  gradeSubmission, fetchFeedback, addFeedback, deleteFeedback,
  uploadSubmissionFile, publishAssignment,
} from '@/lib/classroom';
import type {
  Assignment, AssignmentSubmission, AssignmentFeedback,
  FeedbackType, ResearchProject,
} from '@/types';

interface AssignmentDetailScreenProps {
  assignmentId: string;
  classId: string;
  onBack: () => void;
}

export function AssignmentDetailScreen({ assignmentId, classId, onBack }: AssignmentDetailScreenProps) {
  const { t, isRTL } = useApp();
  const { user, role } = useAuth();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const ArrowIcon = ArrowRight;
  const arrowClass = isRTL ? 'rotate-180' : '';

  const isDoctor = role === 'doctor';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const a = await fetchAssignmentById(assignmentId);
      setAssignment(a);
    } catch {
      setAssignment(null);
    }
    setLoading(false);
  }, [assignmentId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
        <div className="px-5 pt-12">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 mb-4">
            <ArrowIcon className={`w-5 h-5 ${arrowClass}`} />
          </button>
          <EmptyState
            icon={<AlertCircle className="w-8 h-8 text-error-500" />}
            title={t('error')}
            description={t('noAssignments')}
          />
        </div>
      </div>
    );
  }

  const typeIcons: Record<string, React.ReactNode> = {
    text: <FileText className="w-4 h-4" />,
    file: <Upload className="w-4 h-4" />,
    research_project: <BookOpen className="w-4 h-4" />,
  };

  return (
    <div className="min-h-screen pb-24 bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 px-5 pt-12 pb-4 border-b border-neutral-100 dark:border-neutral-800 sticky top-0 z-30">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <ArrowIcon className={`w-5 h-5 ${arrowClass}`} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-neutral-900 dark:text-white truncate">{assignment.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="flex items-center gap-1 text-xs text-primary-700 dark:text-primary-400">
                {typeIcons[assignment.assignment_type]}
                {assignment.assignment_type === 'text' ? t('typeText') : assignment.assignment_type === 'file' ? t('typeFile') : t('typeResearchProject')}
              </span>
              <span className="text-xs text-neutral-400">·</span>
              <span className="text-xs text-neutral-400">{t('maxGrade')}: {assignment.max_grade}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-4">
        {isDoctor ? (
          <DoctorView assignment={assignment} classId={classId} />
        ) : (
          <StudentView assignment={assignment} classId={classId} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Doctor View — see all submissions, grade, add feedback
// ============================================================================
function DoctorView({ assignment, classId }: { assignment: Assignment; classId: string }) {
  const { t } = useApp();
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSub, setSelectedSub] = useState<AssignmentSubmission | null>(null);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSubmissionsForAssignment(assignment.id);
      setSubmissions(data);
    } catch {
      setSubmissions([]);
    }
    setLoading(false);
  }, [assignment.id]);

  useEffect(() => { load(); }, [load]);

  const handlePublish = async () => {
    setPublishing(true);
    await publishAssignment(assignment.id, classId, assignment.title);
    setPublishing(false);
    window.location.reload();
  };

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Assignment details */}
      <div className="card">
        {assignment.description && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">{assignment.description}</p>
        )}
        {assignment.instructions && (
          <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-3">
            <p className="text-xs text-neutral-500 mb-1">{t('assignmentInstructions')}</p>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">{assignment.instructions}</p>
          </div>
        )}
        {assignment.due_date && (
          <p className="text-xs text-neutral-400 mt-3">{t('dueDate')}: {new Date(assignment.due_date).toLocaleString()}</p>
        )}
        {!assignment.is_published && (
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="btn-primary w-full text-sm mt-3"
          >
            {publishing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('publish')}
          </button>
        )}
      </div>

      {/* Submissions list */}
      <div>
        <h3 className="text-xs font-bold text-neutral-400 uppercase mb-3">{t('submissions')} ({submissions.length})</h3>
        {submissions.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="w-8 h-8 text-primary-700 dark:text-primary-400" />}
            title={t('noSubmissions')}
            description=""
          />
        ) : (
          <div className="space-y-2">
            {submissions.map((sub) => (
              <SubmissionCard
                key={sub.id}
                submission={sub}
                onClick={() => setSelectedSub(sub)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedSub && (
        <ReviewModal
          submission={selectedSub}
          assignment={assignment}
          classId={classId}
          doctorId={user?.id || ''}
          onClose={() => setSelectedSub(null)}
          onUpdate={() => { setSelectedSub(null); load(); }}
        />
      )}
    </div>
  );
}

function SubmissionCard({ submission, onClick }: { submission: AssignmentSubmission; onClick: () => void }) {
  const { t } = useApp();
  const statusColors: Record<string, string> = {
    submitted: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    reviewed: 'bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400',
    graded: 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-400',
    returned: 'bg-error-50 text-error-700 dark:bg-error-900/30 dark:text-error-400',
  };
  const statusLabels: Record<string, string> = {
    submitted: t('statusSubmitted'),
    reviewed: t('statusReviewed'),
    graded: t('statusGraded'),
    returned: t('statusReturned'),
  };

  return (
    <div onClick={onClick} className="card cursor-pointer hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-neutral-900 dark:text-white">
          {t('version')} {submission.version}
        </span>
        <span className={`badge text-[10px] ${statusColors[submission.status]}`}>
          {statusLabels[submission.status]}
        </span>
      </div>
      {submission.content && (
        <p className="text-xs text-neutral-500 line-clamp-2">{submission.content}</p>
      )}
      {submission.file_name && (
        <p className="text-xs text-primary-700 dark:text-primary-400 mt-1 flex items-center gap-1">
          <FileText className="w-3.5 h-3.5" />
          {submission.file_name}
        </p>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-neutral-400">{new Date(submission.created_at).toLocaleString()}</span>
        {submission.grade !== null && (
          <span className="text-xs font-bold text-success-700 dark:text-success-400">
            {submission.grade}/{submission.id ? '' : ''}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Review Modal (Doctor)
// ============================================================================
function ReviewModal({
  submission, assignment, classId, doctorId, onClose, onUpdate,
}: {
  submission: AssignmentSubmission;
  assignment: Assignment;
  classId: string;
  doctorId: string;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const { t } = useApp();
  const [feedback, setFeedback] = useState<AssignmentFeedback[]>([]);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('comment');
  const [gradeValue, setGradeValue] = useState(submission.grade?.toString() || '');
  const [saving, setSaving] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);

  useEffect(() => {
    fetchFeedback(submission.id).then(setFeedback).catch(() => {});
  }, [submission.id]);

  const handleAddFeedback = async () => {
    if (!feedbackText.trim()) return;
    setSavingFeedback(true);
    try {
      await addFeedback(
        submission.id, doctorId, feedbackText.trim(), feedbackType,
        submission.student_id, classId, assignment.id,
      );
      setFeedbackText('');
      const updated = await fetchFeedback(submission.id);
      setFeedback(updated);
    } catch {
      // ignore
    }
    setSavingFeedback(false);
  };

  const handleGrade = async () => {
    const grade = parseFloat(gradeValue);
    if (isNaN(grade)) return;
    setSaving(true);
    await gradeSubmission(submission.id, grade, assignment.id, classId, submission.student_id);
    setSaving(false);
    onUpdate();
  };

  const handleReturn = async () => {
    setSaving(true);
    await supabase.from('assignment_submissions').update({ status: 'returned' }).eq('id', submission.id);
    setSaving(false);
    onUpdate();
  };

  const feedbackTypeLabels: Record<string, string> = {
    comment: t('feedbackComment'),
    correction: t('feedbackCorrection'),
    praise: t('feedbackPraise'),
    suggestion: t('feedbackSuggestion'),
  };

  return (
    <Modal open={true} onClose={onClose} title={t('gradeSubmission')} size="md">
      <div className="space-y-4 max-h-[75vh] overflow-y-auto">
        {/* Submission content */}
        <div className="card bg-neutral-50 dark:bg-neutral-800/50 border-0">
          {submission.content && (
            <div className="mb-3">
              <p className="text-xs text-neutral-500 mb-1">{t('submissionText')}</p>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">{submission.content}</p>
            </div>
          )}
          {submission.file_name && (
            <div className="flex items-center gap-2 text-sm text-primary-700 dark:text-primary-400">
              <FileText className="w-4 h-4" />
              {submission.file_name}
            </div>
          )}
          {submission.linked_project_id && (
            <div className="mt-2">
              <span className="badge bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                <BookOpen className="w-3 h-3 inline-block me-1" />
                {t('typeResearchProject')}
              </span>
            </div>
          )}
          <p className="text-[10px] text-neutral-400 mt-3">
            {t('submittedOn')} {new Date(submission.created_at).toLocaleString()} · {t('version')} {submission.version}
          </p>
        </div>

        {/* Grading */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">{t('grade')} / {assignment.max_grade}</label>
            <input
              type="number"
              value={gradeValue}
              onChange={(e) => setGradeValue(e.target.value)}
              placeholder={t('enterGrade')}
              className="input-field"
              min="0"
              max={assignment.max_grade}
              step="0.5"
            />
          </div>
          <button onClick={handleGrade} disabled={saving || !gradeValue} className="btn-primary text-sm">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : t('saveGrade')}
          </button>
        </div>

        <button onClick={handleReturn} disabled={saving} className="btn-ghost w-full text-sm">
          {t('returnSubmission')}
        </button>

        {/* Feedback */}
        <div className="border-t border-neutral-100 dark:border-neutral-800 pt-4">
          <h4 className="text-sm font-bold text-neutral-900 dark:text-white mb-3">{t('feedback')}</h4>

          {feedback.length > 0 && (
            <div className="space-y-2 mb-4">
              {feedback.map((f) => (
                <div key={f.id} className="card bg-neutral-50 dark:bg-neutral-800/50 border-0">
                  <div className="flex items-start justify-between mb-1">
                    <span className="badge text-[10px] bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                      {feedbackTypeLabels[f.feedback_type]}
                    </span>
                    <button
                      onClick={async () => {
                        await deleteFeedback(f.id);
                        const updated = await fetchFeedback(submission.id);
                        setFeedback(updated);
                      }}
                      className="text-neutral-300 hover:text-error-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-sm text-neutral-700 dark:text-neutral-300">{f.content}</p>
                  <p className="text-[10px] text-neutral-400 mt-1">{new Date(f.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}

          {feedback.length === 0 && <p className="text-xs text-neutral-400 mb-3">{t('noFeedback')}</p>}

          <div className="space-y-2">
            <select
              value={feedbackType}
              onChange={(e) => setFeedbackType(e.target.value as FeedbackType)}
              className="input-field text-sm"
            >
              <option value="comment">{t('feedbackComment')}</option>
              <option value="correction">{t('feedbackCorrection')}</option>
              <option value="praise">{t('feedbackPraise')}</option>
              <option value="suggestion">{t('feedbackSuggestion')}</option>
            </select>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder={t('feedbackPlaceholder')}
              className="input-field min-h-[80px] resize-none text-sm"
            />
            <button
              onClick={handleAddFeedback}
              disabled={savingFeedback || !feedbackText.trim()}
              className="btn-secondary w-full text-sm"
            >
              {savingFeedback ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
                <>
                  <MessageSquare className="w-4 h-4 inline-block me-1" />
                  {t('addFeedback')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// Student View — submit, see feedback and grade
// ============================================================================
function StudentView({ assignment, classId }: { assignment: Assignment; classId: string }) {
  const { t } = useApp();
  const { user } = useAuth();
  const [submission, setSubmission] = useState<AssignmentSubmission | null>(null);
  const [feedback, setFeedback] = useState<AssignmentFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubmit, setShowSubmit] = useState(false);
  const [userProjects, setUserProjects] = useState<ResearchProject[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const sub = await fetchStudentSubmission(assignment.id, user.id);
      setSubmission(sub);
      if (sub) {
        const fb = await fetchFeedback(sub.id);
        setFeedback(fb);
      }
    } catch {
      setSubmission(null);
    }
    setLoading(false);
  }, [assignment.id, user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (user) {
      supabase.from('research_projects').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
        .then(({ data }) => setUserProjects((data || []) as ResearchProject[]));
    }
  }, [user]);

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  const statusColors: Record<string, string> = {
    submitted: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    reviewed: 'bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400',
    graded: 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-400',
    returned: 'bg-error-50 text-error-700 dark:bg-error-900/30 dark:text-error-400',
  };
  const statusLabels: Record<string, string> = {
    submitted: t('statusSubmitted'),
    reviewed: t('statusReviewed'),
    graded: t('statusGraded'),
    returned: t('statusReturned'),
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Assignment details */}
      <div className="card">
        {assignment.description && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">{assignment.description}</p>
        )}
        {assignment.instructions && (
          <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-3">
            <p className="text-xs text-neutral-500 mb-1">{t('assignmentInstructions')}</p>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">{assignment.instructions}</p>
          </div>
        )}
        {assignment.due_date && (
          <p className="text-xs text-neutral-400 mt-3">{t('dueDate')}: {new Date(assignment.due_date).toLocaleString()}</p>
        )}
      </div>

      {/* Submission status */}
      {submission ? (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">{t('yourSubmission')}</h3>
            <span className={`badge text-[10px] ${statusColors[submission.status]}`}>
              {statusLabels[submission.status]}
            </span>
          </div>

          {submission.content && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap mb-2">{submission.content}</p>
          )}
          {submission.file_name && (
            <p className="text-sm text-primary-700 dark:text-primary-400 flex items-center gap-1">
              <FileText className="w-4 h-4" />
              {submission.file_name}
            </p>
          )}
          {submission.linked_project_id && (
            <span className="badge bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 mt-2">
              <BookOpen className="w-3 h-3 inline-block me-1" />
              {t('typeResearchProject')}
            </span>
          )}

          <p className="text-[10px] text-neutral-400 mt-3">
            {t('submittedOn')} {new Date(submission.created_at).toLocaleString()} · {t('version')} {submission.version}
          </p>

          {submission.grade !== null && submission.status === 'graded' && (
            <div className="mt-3 bg-success-50 dark:bg-success-900/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-success-700 dark:text-success-400">
                {submission.grade} / {assignment.max_grade}
              </p>
              <p className="text-xs text-success-600 dark:text-success-500 mt-1">{t('gradedOn')} {new Date(submission.graded_at || '').toLocaleString()}</p>
            </div>
          )}

          <button onClick={() => setShowSubmit(true)} className="btn-ghost w-full text-sm mt-3">
            {t('resubmitAssignment')}
          </button>
        </div>
      ) : (
        <div className="card text-center py-8">
          <p className="text-sm text-neutral-500 mb-4">{t('noSubmission')}</p>
          <button onClick={() => setShowSubmit(true)} className="btn-primary">
            <Send className="w-4 h-4 inline-block me-1" />
            {t('submitAssignment')}
          </button>
        </div>
      )}

      {/* Feedback */}
      {feedback.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-neutral-400 uppercase mb-3">{t('feedback')}</h3>
          <div className="space-y-2">
            {feedback.map((f) => (
              <div key={f.id} className="card">
                <span className="badge text-[10px] bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 mb-2 inline-block">
                  {f.feedback_type === 'comment' ? t('feedbackComment') :
                   f.feedback_type === 'correction' ? t('feedbackCorrection') :
                   f.feedback_type === 'praise' ? t('feedbackPraise') : t('feedbackSuggestion')}
                </span>
                <p className="text-sm text-neutral-700 dark:text-neutral-300">{f.content}</p>
                <p className="text-[10px] text-neutral-400 mt-1">{new Date(f.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit Modal */}
      {showSubmit && (
        <SubmitModal
          open={showSubmit}
          onClose={() => setShowSubmit(false)}
          assignment={assignment}
          classId={classId}
          studentId={user?.id || ''}
          userProjects={userProjects}
          onSubmitted={() => { setShowSubmit(false); load(); }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Submit Modal (Student)
// ============================================================================
function SubmitModal({
  open, onClose, assignment, classId, studentId, userProjects, onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  assignment: Assignment;
  classId: string;
  studentId: string;
  userProjects: ResearchProject[];
  onSubmitted: () => void;
}) {
  const { t } = useApp();
  const [content, setContent] = useState('');
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [linkedProjectId, setLinkedProjectId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const { filePath: path, error: uploadErr } = await uploadSubmissionFile(classId, studentId, file);
    if (uploadErr) {
      setError(uploadErr === 'supportedFormats' ? t('supportedFormats') : t('fileUploadError'));
    } else if (path) {
      setFilePath(path);
      setFileName(file.name);
      setFileType(file.type);
      setFileSize(file.size);
    }
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (assignment.assignment_type === 'text' && !content.trim()) return;
    if (assignment.assignment_type === 'file' && !filePath) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitAssignment(assignment.id, studentId, {
        content: content.trim() || undefined,
        file_path: filePath || undefined,
        file_name: fileName || undefined,
        file_type: fileType || undefined,
        file_size: fileSize || undefined,
        linked_project_id: linkedProjectId || undefined,
      });
      onSubmitted();
    } catch {
      setError(t('submitError'));
    }
    setSubmitting(false);
  };

  return (
    <Modal open={open} onClose={onClose} title={t('submitAssignment')} size="md">
      <div className="space-y-4 max-h-[75vh] overflow-y-auto">
        {assignment.assignment_type === 'text' && (
          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">{t('submissionText')} *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('submissionTextPlaceholder')}
              className="input-field min-h-[150px] resize-none"
            />
          </div>
        )}

        {assignment.assignment_type === 'file' && (
          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">{t('uploadSubmissionFile')} *</label>
            <label className="block border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl p-6 text-center cursor-pointer hover:border-primary-400 transition-colors">
              <input type="file" onChange={handleFile} className="hidden" accept=".pdf,.docx,.pptx,.xlsx,.doc,.xls,.ppt,.txt,.jpg,.png" />
              {uploading ? (
                <Loader2 className="w-6 h-6 text-primary-700 animate-spin mx-auto mb-2" />
              ) : (
                <Upload className="w-6 h-6 text-neutral-400 mx-auto mb-2" />
              )}
              {fileName ? (
                <p className="text-sm text-primary-700 dark:text-primary-400 flex items-center justify-center gap-1">
                  <Check className="w-4 h-4" />
                  {fileName}
                </p>
              ) : (
                <p className="text-sm text-neutral-500">{t('uploadSubmissionFile')}</p>
              )}
              <p className="text-xs text-neutral-400 mt-1">{t('supportedFormats')}</p>
            </label>
          </div>
        )}

        {assignment.assignment_type === 'research_project' && (
          <>
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">{t('submissionText')}</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t('submissionTextPlaceholder')}
                className="input-field min-h-[100px] resize-none"
              />
            </div>
            {userProjects.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">{t('linkSubmissionProject')}</label>
                <select
                  value={linkedProjectId}
                  onChange={(e) => setLinkedProjectId(e.target.value)}
                  className="input-field"
                >
                  <option value="">{t('selectProject')}</option>
                  {userProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="rounded-xl bg-error-50 dark:bg-error-900/20 px-4 py-3 text-sm text-error-700 dark:text-error-400">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm">{t('cancel')}</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || (assignment.assignment_type === 'text' && !content.trim()) || (assignment.assignment_type === 'file' && !filePath)}
            className="btn-primary flex-1 text-sm"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('submitAssignment')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
