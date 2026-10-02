import { supabase } from './supabase';
import type {
  ProjectMember, ProjectRole,
  ProjectTask, TaskStatus, TaskPriority,
  ProjectComment, CommentTarget,
  ProjectFile,
  ProjectEvent, EventType,
  ProjectActivity,
  ProjectNotification,
} from '@/types';

const ACTIVITY_EVENTS = {
  project_created: 'activityProjectCreated',
  source_added: 'activitySourceAdded',
  note_added: 'activityNoteAdded',
  evidence_added: 'activityEvidenceAdded',
  task_created: 'activityTaskCreated',
  task_status_changed: 'activityTaskStatusChanged',
  member_added: 'activityMemberAdded',
  comment_added: 'activityCommentAdded',
  file_uploaded: 'activityFileUploaded',
} as const;

export async function logActivity(
  projectId: string,
  userId: string | undefined,
  action: keyof typeof ACTIVITY_EVENTS | string,
  description?: string,
  entityType?: string,
  entityId?: string,
) {
  if (!userId) return;
  await supabase.from('project_activity_log').insert({
    project_id: projectId,
    user_id: userId,
    action,
    description: description || null,
    entity_type: entityType || null,
    entity_id: entityId || null,
  });
}

export async function fetchMembers(projectId: string): Promise<ProjectMember[]> {
  const { data, error } = await supabase
    .from('project_members')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as ProjectMember[];
}

export async function fetchMemberRole(projectId: string, userId: string): Promise<ProjectRole | null> {
  const { data, error } = await supabase
    .rpc('get_project_member_role', { p_project_id: projectId, p_user_id: userId });
  if (error) return null;
  return data as ProjectRole | null;
}

export async function inviteMember(
  projectId: string,
  invitedBy: string,
  email: string,
  role: ProjectRole,
): Promise<{ error: string | null }> {
  try {
    const { data: targetUserId, error: rpcErr } = await supabase
      .rpc('get_user_id_by_email', { p_email: email.toLowerCase() });

    if (rpcErr || !targetUserId) {
      return { error: 'inviteError' };
    }

    const { error: insertErr } = await supabase
      .from('project_members')
      .insert({
        project_id: projectId,
        user_id: targetUserId as string,
        role,
        invited_by: invitedBy,
      });

    if (insertErr) {
      if (insertErr.code === '23505') return { error: null };
      return { error: 'inviteError' };
    }

    await supabase.from('project_notifications').insert({
      user_id: targetUserId as string,
      project_id: projectId,
      type: 'invite',
      title: 'تمت دعوتك لمشروع بحثي',
      body: 'تمت دعوتك للانضمام إلى مشروع بحثي',
    });

    await logActivity(projectId, invitedBy, 'member_added', `دعوة عضو: ${email}`);

    return { error: null };
  } catch {
    return { error: 'inviteError' };
  }
}

export async function updateMemberRole(
  projectId: string,
  memberId: string,
  role: ProjectRole,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('project_members')
    .update({ role })
    .eq('id', memberId)
    .eq('project_id', projectId);
  return { error: error?.message || null };
}

export async function removeMember(memberId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('id', memberId);
  return { error: error?.message || null };
}

export async function leaveProject(projectId: string, userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId);
  return { error: error?.message || null };
}

export async function fetchTasks(projectId: string): Promise<ProjectTask[]> {
  const { data, error } = await supabase
    .from('project_tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as ProjectTask[];
}

export async function createTask(
  projectId: string,
  createdBy: string,
  task: { title: string; description?: string; assigned_to?: string; priority?: TaskPriority; due_date?: string },
): Promise<ProjectTask | null> {
  const { data, error } = await supabase
    .from('project_tasks')
    .insert({
      project_id: projectId,
      created_by: createdBy,
      title: task.title,
      description: task.description || null,
      assigned_to: task.assigned_to || null,
      priority: task.priority || 'medium',
      due_date: task.due_date || null,
    })
    .select('*')
    .single();
  if (error) throw error;

  if (task.assigned_to && task.assigned_to !== createdBy) {
    await supabase.from('project_notifications').insert({
      user_id: task.assigned_to,
      project_id: projectId,
      type: 'task_assigned',
      title: 'تم إسناد مهمة إليك',
      body: task.title,
    });
  }

  await logActivity(projectId, createdBy, 'task_created', task.title);
  return data as ProjectTask;
}

export async function updateTask(
  taskId: string,
  updates: Partial<Pick<ProjectTask, 'title' | 'description' | 'status' | 'priority' | 'assigned_to' | 'due_date'>>,
  projectId?: string,
  userId?: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('project_tasks')
    .update(updates)
    .eq('id', taskId);
  if (error) return { error: error.message };

  if (updates.status && projectId && userId) {
    await logActivity(projectId, userId, 'task_status_changed', `الحالة: ${updates.status}`);
  }
  return { error: null };
}

export async function deleteTask(taskId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('project_tasks')
    .delete()
    .eq('id', taskId);
  return { error: error?.message || null };
}

export async function fetchComments(
  projectId: string,
  targetType?: CommentTarget,
  targetId?: string,
): Promise<ProjectComment[]> {
  let query = supabase
    .from('project_comments')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (targetType) query = query.eq('target_type', targetType);
  if (targetId) query = query.eq('target_id', targetId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as ProjectComment[];
}

export async function addComment(
  projectId: string,
  userId: string,
  content: string,
  targetType: CommentTarget = 'project',
  targetId?: string,
): Promise<ProjectComment | null> {
  const { data, error } = await supabase
    .from('project_comments')
    .insert({
      project_id: projectId,
      user_id: userId,
      content,
      target_type: targetType,
      target_id: targetId || null,
    })
    .select('*')
    .single();
  if (error) throw error;
  await logActivity(projectId, userId, 'comment_added', content.substring(0, 80));
  return data as ProjectComment;
}

export async function deleteComment(commentId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('project_comments')
    .delete()
    .eq('id', commentId);
  return { error: error?.message || null };
}

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
];

const MAX_FILE_SIZE = 25 * 1024 * 1024;

export async function uploadFile(
  projectId: string,
  userId: string,
  file: File,
  taskId?: string,
): Promise<ProjectFile | { error: string }> {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return { error: 'supportedFormats' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: 'fileUploadError' };
  }

  const filePath = `${projectId}/${Date.now()}-${file.name}`;

  const { error: uploadErr } = await supabase.storage
    .from('project-files')
    .upload(filePath, file);

  if (uploadErr) return { error: 'fileUploadError' };

  const { data, error: dbErr } = await supabase
    .from('project_files')
    .insert({
      project_id: projectId,
      uploaded_by: userId,
      task_id: taskId || null,
      file_name: file.name,
      file_path: filePath,
      file_type: file.type,
      file_size: file.size,
    })
    .select('*')
    .single();

  if (dbErr) {
    await supabase.storage.from('project-files').remove([filePath]);
    return { error: 'fileUploadError' };
  }

  await logActivity(projectId, userId, 'file_uploaded', file.name);
  return data as ProjectFile;
}

export async function fetchFiles(projectId: string): Promise<ProjectFile[]> {
  const { data, error } = await supabase
    .from('project_files')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as ProjectFile[];
}

export async function downloadFile(filePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('project-files')
    .createSignedUrl(filePath, 3600);
  if (error) return null;
  return data?.signedUrl || null;
}

export async function deleteFile(fileId: string, filePath: string): Promise<{ error: string | null }> {
  await supabase.storage.from('project-files').remove([filePath]);
  const { error } = await supabase
    .from('project_files')
    .delete()
    .eq('id', fileId);
  return { error: error?.message || null };
}

export async function fetchEvents(projectId: string): Promise<ProjectEvent[]> {
  const { data, error } = await supabase
    .from('project_events')
    .select('*')
    .eq('project_id', projectId)
    .order('event_date', { ascending: true });
  if (error) throw error;
  return (data || []) as ProjectEvent[];
}

export async function createEvent(
  projectId: string,
  userId: string,
  event: { title: string; description?: string; event_date: string; event_type?: EventType; task_id?: string },
): Promise<ProjectEvent | null> {
  const { data, error } = await supabase
    .from('project_events')
    .insert({
      project_id: projectId,
      created_by: userId,
      title: event.title,
      description: event.description || null,
      event_date: event.event_date,
      event_type: event.event_type || 'deadline',
      task_id: event.task_id || null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as ProjectEvent;
}

export async function deleteEvent(eventId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('project_events')
    .delete()
    .eq('id', eventId);
  return { error: error?.message || null };
}

export async function fetchActivityLog(projectId: string, limit = 20): Promise<ProjectActivity[]> {
  const { data, error } = await supabase
    .from('project_activity_log')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as ProjectActivity[];
}

export async function fetchNotifications(userId: string): Promise<ProjectNotification[]> {
  const { data, error } = await supabase
    .from('project_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data || []) as ProjectNotification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase.from('project_notifications').update({ read: true }).eq('id', id);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await supabase.from('project_notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
}

export async function computeProjectProgress(projectId: string): Promise<number> {
  const { count: total } = await supabase
    .from('project_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId);
  if (!total || total === 0) return 0;
  const { count: done } = await supabase
    .from('project_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('status', 'done');
  return Math.round(((done || 0) / total) * 100);
}

export async function fetchSharedProjects(userId: string) {
  const { data: memberships } = await supabase
    .from('project_members')
    .select('project_id, role')
    .eq('user_id', userId);

  if (!memberships || memberships.length === 0) return { owned: [], shared: [] };

  const projectIds = memberships.map((m) => m.project_id);
  const { data: projects } = await supabase
    .from('research_projects')
    .select('*')
    .in('id', projectIds)
    .order('updated_at', { ascending: false });

  const ownedIds = memberships.filter((m) => m.role === 'owner').map((m) => m.project_id);
  const sharedIds = memberships.filter((m) => m.role !== 'owner').map((m) => m.project_id);

  return {
    owned: (projects || []).filter((p) => ownedIds.includes(p.id)),
    shared: (projects || []).filter((p) => sharedIds.includes(p.id)),
  };
}

export { ACTIVITY_EVENTS };
