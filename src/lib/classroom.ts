import { supabase } from './supabase';
import type {
  UserRole,
  UserRoleInfo,
  ClassRoom,
  ClassMember,
  Assignment,
  AssignmentType,
  AssignmentSubmission,
  AssignmentFeedback,
  FeedbackType,
  Announcement,
  ClassNotification,
  SubmissionStatus,
} from '@/types';

// ============================================================================
// User Role
// ============================================================================
export async function getUserRole(userId: string): Promise<UserRole | null> {
  const { data, error } = await supabase
    .rpc('get_user_role', { p_user_id: userId });
  if (error) return null;
  return data as UserRole | null;
}

export async function getUserRoleInfo(userId: string): Promise<UserRoleInfo | null> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null;
  return data as UserRoleInfo | null;
}

export async function setUserRole(
  userId: string,
  role: UserRole,
  displayName?: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('user_roles')
    .upsert({
      user_id: userId,
      role,
      display_name: displayName || null,
    }, { onConflict: 'user_id' });
  return { error: error?.message || null };
}

export async function updateDisplayName(
  userId: string,
  displayName: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('user_roles')
    .update({ display_name: displayName })
    .eq('user_id', userId);
  return { error: error?.message || null };
}

// ============================================================================
// Classes
// ============================================================================
export async function fetchDoctorClasses(doctorId: string): Promise<ClassRoom[]> {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as ClassRoom[];
}

export async function fetchStudentClasses(studentId: string): Promise<ClassRoom[]> {
  const { data: memberships } = await supabase
    .from('class_members')
    .select('class_id')
    .eq('user_id', studentId);

  if (!memberships || memberships.length === 0) return [];

  const classIds = memberships.map((m) => m.class_id);
  const { data: classes, error } = await supabase
    .from('classes')
    .select('*')
    .in('id', classIds)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (classes || []) as ClassRoom[];
}

export async function fetchClassById(classId: string): Promise<ClassRoom | null> {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('id', classId)
    .maybeSingle();
  if (error) throw error;
  return data as ClassRoom | null;
}

export async function fetchClassByJoinCode(code: string): Promise<ClassRoom | null> {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('join_code', code.toUpperCase())
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  return data as ClassRoom | null;
}

export async function createClass(
  doctorId: string,
  params: {
    name: string;
    description?: string;
    course_code?: string;
    section?: string;
    academic_year?: string;
  },
): Promise<ClassRoom | null> {
  const { data: code } = await supabase.rpc('generate_join_code');
  if (!code) return null;

  const { data, error } = await supabase
    .from('classes')
    .insert({
      doctor_id: doctorId,
      name: params.name,
      description: params.description || null,
      course_code: params.course_code || null,
      section: params.section || null,
      academic_year: params.academic_year || null,
      join_code: code,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as ClassRoom;
}

export async function updateClass(
  classId: string,
  updates: Partial<Pick<ClassRoom, 'name' | 'description' | 'course_code' | 'section' | 'academic_year' | 'is_active'>>,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('classes')
    .update(updates)
    .eq('id', classId);
  return { error: error?.message || null };
}

export async function deleteClass(classId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('classes')
    .delete()
    .eq('id', classId);
  return { error: error?.message || null };
}

// ============================================================================
// Class Members
// ============================================================================
export async function fetchClassMembers(classId: string): Promise<ClassMember[]> {
  const { data, error } = await supabase
    .from('class_members')
    .select(`
      id,
      class_id,
      user_id,
      joined_at,
      user_roles!inner(display_name, role)
    `)
    .eq('class_id', classId)
    .order('joined_at', { ascending: true });
  if (error) {
    // Fallback without join
    const { data: fallback, error: err2 } = await supabase
      .from('class_members')
      .select('*')
      .eq('class_id', classId)
      .order('joined_at', { ascending: true });
    if (err2) throw err2;
    return (fallback || []) as ClassMember[];
  }
  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    class_id: row.class_id as string,
    user_id: row.user_id as string,
    joined_at: row.joined_at as string,
    display_name: (row.user_roles as { display_name: string | null })?.display_name ?? null,
    role: (row.user_roles as { role: UserRole })?.role ?? undefined,
  }));
}

export async function joinClass(
  classId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('class_members')
    .insert({
      class_id: classId,
      user_id: userId,
    });
  if (error) {
    if (error.code === '23505') return { error: 'alreadyMember' };
    return { error: error.message };
  }

  await supabase.from('class_notifications').insert({
    user_id: userId,
    class_id: classId,
    type: 'joined_class',
    title: 'joined_class',
    body: null,
  });

  return { error: null };
}

export async function joinClassByCode(
  code: string,
  userId: string,
): Promise<{ error: string | null; classRoom: ClassRoom | null }> {
  const classRoom = await fetchClassByJoinCode(code);
  if (!classRoom) return { error: 'invalidJoinCode', classRoom: null };

  const { error } = await joinClass(classRoom.id, userId);
  if (error === 'alreadyMember') return { error: 'alreadyMember', classRoom };
  if (error) return { error, classRoom: null };
  return { error: null, classRoom };
}

export async function leaveClass(
  classId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('class_members')
    .delete()
    .eq('class_id', classId)
    .eq('user_id', userId);
  return { error: error?.message || null };
}

export async function removeClassMember(
  classId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('class_members')
    .delete()
    .eq('class_id', classId)
    .eq('user_id', userId);
  return { error: error?.message || null };
}

export async function getClassMemberCount(classId: string): Promise<number> {
  const { count } = await supabase
    .from('class_members')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', classId);
  return count || 0;
}

// ============================================================================
// Assignments
// ============================================================================
export async function fetchAssignments(classId: string): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('class_id', classId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Assignment[];
}

export async function fetchPublishedAssignments(classId: string): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('class_id', classId)
    .eq('is_published', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Assignment[];
}

export async function fetchAssignmentById(assignmentId: string): Promise<Assignment | null> {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('id', assignmentId)
    .maybeSingle();
  if (error) throw error;
  return data as Assignment | null;
}

export async function createAssignment(
  doctorId: string,
  params: {
    class_id: string;
    title: string;
    description?: string;
    instructions?: string;
    assignment_type: AssignmentType;
    max_grade?: number;
    due_date?: string;
    linked_project_id?: string;
    is_published?: boolean;
  },
): Promise<Assignment | null> {
  const { data, error } = await supabase
    .from('assignments')
    .insert({
      class_id: params.class_id,
      doctor_id: doctorId,
      title: params.title,
      description: params.description || null,
      instructions: params.instructions || null,
      assignment_type: params.assignment_type,
      max_grade: params.max_grade ?? 100,
      due_date: params.due_date || null,
      linked_project_id: params.linked_project_id || null,
      is_published: params.is_published ?? false,
    })
    .select('*')
    .single();
  if (error) throw error;

  if (params.is_published) {
    const members = await fetchClassMembers(params.class_id);
    const notifications = members.map((m) => ({
      user_id: m.user_id,
      class_id: params.class_id,
      assignment_id: (data as Assignment).id,
      type: 'assignment_posted' as const,
      title: 'assignment_posted',
      body: params.title,
    }));
    if (notifications.length > 0) {
      await supabase.from('class_notifications').insert(notifications);
    }
  }

  return data as Assignment;
}

export async function updateAssignment(
  assignmentId: string,
  updates: Partial<Pick<Assignment, 'title' | 'description' | 'instructions' | 'max_grade' | 'due_date' | 'linked_project_id' | 'is_published'>>,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('assignments')
    .update(updates)
    .eq('id', assignmentId);
  return { error: error?.message || null };
}

export async function deleteAssignment(assignmentId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('assignments')
    .delete()
    .eq('id', assignmentId);
  return { error: error?.message || null };
}

export async function publishAssignment(assignmentId: string, classId: string, title: string): Promise<void> {
  await updateAssignment(assignmentId, { is_published: true });
  const members = await fetchClassMembers(classId);
  const notifications = members.map((m) => ({
    user_id: m.user_id,
    class_id: classId,
    assignment_id: assignmentId,
    type: 'assignment_posted' as const,
    title: 'assignment_posted',
    body: title,
  }));
  if (notifications.length > 0) {
    await supabase.from('class_notifications').insert(notifications);
  }
}

// ============================================================================
// Submissions
// ============================================================================
export async function fetchSubmissionsForAssignment(assignmentId: string): Promise<AssignmentSubmission[]> {
  const { data, error } = await supabase
    .from('assignment_submissions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as AssignmentSubmission[];
}

export async function fetchStudentSubmission(
  assignmentId: string,
  studentId: string,
): Promise<AssignmentSubmission | null> {
  const { data, error } = await supabase
    .from('assignment_submissions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as AssignmentSubmission | null;
}

export async function fetchStudentSubmissions(studentId: string): Promise<AssignmentSubmission[]> {
  const { data, error } = await supabase
    .from('assignment_submissions')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as AssignmentSubmission[];
}

export async function submitAssignment(
  assignmentId: string,
  studentId: string,
  params: {
    content?: string;
    file_path?: string;
    file_name?: string;
    file_type?: string;
    file_size?: number;
    linked_project_id?: string;
  },
): Promise<AssignmentSubmission | null> {
  const existing = await fetchStudentSubmission(assignmentId, studentId);
  const version = existing ? existing.version + 1 : 1;

  const { data, error } = await supabase
    .from('assignment_submissions')
    .insert({
      assignment_id: assignmentId,
      student_id: studentId,
      content: params.content || null,
      file_path: params.file_path || null,
      file_name: params.file_name || null,
      file_type: params.file_type || null,
      file_size: params.file_size || null,
      linked_project_id: params.linked_project_id || null,
      version,
      status: 'submitted',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as AssignmentSubmission;
}

export async function updateSubmissionStatus(
  submissionId: string,
  status: SubmissionStatus,
  grade?: number,
): Promise<{ error: string | null }> {
  const updates: Record<string, unknown> = { status };
  if (grade !== undefined) {
    updates.grade = grade;
    updates.graded_at = new Date().toISOString();
  }
  const { error } = await supabase
    .from('assignment_submissions')
    .update(updates)
    .eq('id', submissionId);
  return { error: error?.message || null };
}

export async function gradeSubmission(
  submissionId: string,
  grade: number,
  assignmentId: string,
  classId: string,
  studentId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('assignment_submissions')
    .update({
      grade,
      status: 'graded',
      graded_at: new Date().toISOString(),
    })
    .eq('id', submissionId);
  if (error) return { error: error.message };

  await supabase.from('class_notifications').insert({
    user_id: studentId,
    class_id: classId,
    assignment_id: assignmentId,
    type: 'submission_graded',
    title: 'submission_graded',
    body: null,
  });

  return { error: null };
}

// ============================================================================
// Feedback
// ============================================================================
export async function fetchFeedback(submissionId: string): Promise<AssignmentFeedback[]> {
  const { data, error } = await supabase
    .from('assignment_feedback')
    .select('*')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as AssignmentFeedback[];
}

export async function addFeedback(
  submissionId: string,
  doctorId: string,
  content: string,
  feedbackType: FeedbackType = 'comment',
  studentId?: string,
  classId?: string,
  assignmentId?: string,
): Promise<AssignmentFeedback | null> {
  const { data, error } = await supabase
    .from('assignment_feedback')
    .insert({
      submission_id: submissionId,
      doctor_id: doctorId,
      content,
      feedback_type: feedbackType,
    })
    .select('*')
    .single();
  if (error) throw error;

  if (studentId && classId && assignmentId) {
    await supabase.from('class_notifications').insert({
      user_id: studentId,
      class_id: classId,
      assignment_id: assignmentId,
      type: 'feedback_received',
      title: 'feedback_received',
      body: content.substring(0, 100),
    });
  }

  return data as AssignmentFeedback;
}

export async function deleteFeedback(feedbackId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('assignment_feedback')
    .delete()
    .eq('id', feedbackId);
  return { error: error?.message || null };
}

// ============================================================================
// Announcements
// ============================================================================
export async function fetchAnnouncements(classId: string): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('class_id', classId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Announcement[];
}

export async function createAnnouncement(
  classId: string,
  doctorId: string,
  title: string,
  body: string,
): Promise<Announcement | null> {
  const { data, error } = await supabase
    .from('announcements')
    .insert({
      class_id: classId,
      doctor_id: doctorId,
      title,
      body,
    })
    .select('*')
    .single();
  if (error) throw error;

  const members = await fetchClassMembers(classId);
  const notifications = members.map((m) => ({
    user_id: m.user_id,
    class_id: classId,
    type: 'announcement' as const,
    title: 'announcement',
    body: title,
  }));
  if (notifications.length > 0) {
    await supabase.from('class_notifications').insert(notifications);
  }

  return data as Announcement;
}

export async function deleteAnnouncement(announcementId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', announcementId);
  return { error: error?.message || null };
}

// ============================================================================
// Notifications
// ============================================================================
export async function fetchClassNotifications(userId: string): Promise<ClassNotification[]> {
  const { data, error } = await supabase
    .from('class_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data || []) as ClassNotification[];
}

export async function markClassNotificationRead(id: string): Promise<void> {
  await supabase.from('class_notifications').update({ read: true }).eq('id', id);
}

export async function markAllClassNotificationsRead(userId: string): Promise<void> {
  await supabase
    .from('class_notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
}

// ============================================================================
// Progress
// ============================================================================
export async function getStudentProgress(
  classId: string,
  studentId: string,
): Promise<{
  totalAssignments: number;
  submittedCount: number;
  gradedCount: number;
  averageGrade: number | null;
}> {
  const { count: total } = await supabase
    .from('assignments')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', classId)
    .eq('is_published', true);

  const { data: submissions } = await supabase
    .from('assignment_submissions')
    .select('id, status, grade')
    .eq('student_id', studentId)
    .in('assignment_id', (
      await supabase.from('assignments').select('id').eq('class_id', classId)
    ).data?.map((a) => a.id) || []);

  const submitted = submissions?.length || 0;
  const graded = submissions?.filter((s) => s.status === 'graded' && s.grade !== null) || [];
  const avgGrade = graded.length > 0
    ? graded.reduce((sum, s) => sum + (s.grade || 0), 0) / graded.length
    : null;

  return {
    totalAssignments: total || 0,
    submittedCount: submitted,
    gradedCount: graded.length,
    averageGrade: avgGrade,
  };
}

export async function getClassStats(classId: string): Promise<{
  studentCount: number;
  assignmentCount: number;
  submissionCount: number;
}> {
  const [students, assignments, submissions] = await Promise.all([
    supabase.from('class_members').select('id', { count: 'exact', head: true }).eq('class_id', classId),
    supabase.from('assignments').select('id', { count: 'exact', head: true }).eq('class_id', classId),
    supabase.from('assignment_submissions').select('id', { count: 'exact', head: true })
      .in('assignment_id', (await supabase.from('assignments').select('id').eq('class_id', classId)).data?.map((a) => a.id) || []),
  ]);

  return {
    studentCount: students.count || 0,
    assignmentCount: assignments.count || 0,
    submissionCount: submissions.count || 0,
  };
}

// ============================================================================
// File Upload
// ============================================================================
const SUBMISSION_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'text/plain',
  'image/jpeg',
  'image/png',
];

const MAX_SUBMISSION_SIZE = 25 * 1024 * 1024;

export async function uploadSubmissionFile(
  classId: string,
  studentId: string,
  file: File,
): Promise<{ filePath: string | null; error: string | null }> {
  if (!SUBMISSION_FILE_TYPES.includes(file.type)) {
    return { filePath: null, error: 'supportedFormats' };
  }
  if (file.size > MAX_SUBMISSION_SIZE) {
    return { filePath: null, error: 'fileUploadError' };
  }

  const filePath = `class-submissions/${classId}/${studentId}/${Date.now()}-${file.name}`;

  const { error: uploadErr } = await supabase.storage
    .from('project-files')
    .upload(filePath, file);

  if (uploadErr) return { filePath: null, error: 'fileUploadError' };
  return { filePath, error: null };
}

export async function getSubmissionFileUrl(filePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('project-files')
    .createSignedUrl(filePath, 3600);
  if (error) return null;
  return data?.signedUrl || null;
}
