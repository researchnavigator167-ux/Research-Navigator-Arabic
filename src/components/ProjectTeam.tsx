import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useApp } from '@/lib/AppContext';
import {
  fetchMembers, inviteMember, updateMemberRole, removeMember, leaveProject,
} from '@/lib/collaboration';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, Spinner } from '@/components/ui';
import { UserPlus, Crown, Pencil, Eye, Trash2, LogOut, Mail } from 'lucide-react';
import type { ProjectMember, ProjectRole, ResearchProject } from '@/types';

export function ProjectTeam({ project }: { project: ResearchProject }) {
  const { user } = useAuth();
  const { t } = useApp();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<ProjectRole>('editor');
  const [inviting, setInviting] = useState(false);
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<ProjectRole | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await fetchMembers(project.id);
      setMembers(data);
      const me = data.find((m) => m.user_id === user?.id);
      setMyRole(me?.role || null);
      setLoading(false);
    }
    load();
  }, [project.id, user?.id]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !user) return;
    setInviting(true);
    setInviteErr(null);
    const { error } = await inviteMember(project.id, user.id, inviteEmail.trim(), inviteRole);
    if (error) {
      setInviteErr(t(error));
    } else {
      const data = await fetchMembers(project.id);
      setMembers(data);
      setShowInvite(false);
      setInviteEmail('');
    }
    setInviting(false);
  };

  const handleRemove = async (memberId: string) => {
    const { error } = await removeMember(memberId);
    if (!error) {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    }
  };

  const handleLeave = async () => {
    if (!user) return;
    const { error } = await leaveProject(project.id, user.id);
    if (!error) {
      setMembers((prev) => prev.filter((m) => m.user_id !== user.id));
    }
  };

  const handleRoleChange = async (memberId: string, role: ProjectRole) => {
    const { error } = await updateMemberRole(project.id, memberId, role);
    if (!error) {
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role } : m)));
    }
  };

  const canManage = myRole === 'owner';

  const roleIcons: Record<ProjectRole, typeof Crown> = {
    owner: Crown,
    editor: Pencil,
    viewer: Eye,
  };

  const roleColors: Record<ProjectRole, string> = {
    owner: 'bg-warning-50 text-warning-700 dark:bg-warning-900/20 dark:text-warning-400',
    editor: 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
    viewer: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
  };

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-neutral-900 dark:text-white">{t('teamMembers')}</h2>
        {canManage && (
          <button onClick={() => setShowInvite(true)} className="btn-primary text-xs py-2 px-3">
            <UserPlus className="w-4 h-4" /> {t('inviteMember')}
          </button>
        )}
      </div>

      {members.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="w-8 h-8 text-primary-700 dark:text-primary-400" />}
          title={t('noMembers')}
          description={t('noMembersDesc')}
        />
      ) : (
        <div className="space-y-3">
          {members.map((member) => {
            const Icon = roleIcons[member.role];
            const isMe = member.user_id === user?.id;
            return (
              <div key={member.id} className="card flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary-700 dark:text-primary-400">
                    {(member.user_id === user?.id ? (user.email?.[0] || '?') : '?').toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                    {isMe ? t('you') : member.user_id.substring(0, 8) + '...'}
                  </p>
                  <span className={`badge ${roleColors[member.role]} text-[10px]`}>
                    <Icon className="w-3 h-3" /> {t(`role${member.role.charAt(0).toUpperCase()}${member.role.slice(1)}` as string)}
                  </span>
                </div>
                {canManage && !isMe && member.role !== 'owner' && (
                  <div className="flex items-center gap-1">
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value as ProjectRole)}
                      className="text-xs bg-transparent text-neutral-500 border-0 outline-none cursor-pointer"
                    >
                      <option value="editor">{t('roleEditor')}</option>
                      <option value="viewer">{t('roleViewer')}</option>
                    </select>
                    <button onClick={() => handleRemove(member.id)} className="text-neutral-300 hover:text-error-500 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {isMe && !canManage && (
                  <button onClick={handleLeave} className="text-neutral-300 hover:text-error-500 p-1">
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showInvite} onClose={() => setShowInvite(false)} title={t('inviteMember')} size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              {t('memberEmail')}
            </label>
            <div className="relative">
              <Mail className="absolute top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 ltr:left-3 rtl:right-3" />
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="input-field ltr:pl-10 ltr:pr-4 rtl:pr-10 rtl:pl-4"
                placeholder="researcher@university.edu"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              {t('memberRole')}
            </label>
            <div className="flex gap-2">
              {(['editor', 'viewer'] as ProjectRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setInviteRole(r)}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                    inviteRole === r
                      ? 'bg-primary-700 text-white'
                      : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  {t(`role${r.charAt(0).toUpperCase()}${r.slice(1)}` as string)}
                </button>
              ))}
            </div>
          </div>
          {inviteErr && <p className="text-sm text-error-500">{inviteErr}</p>}
          <button onClick={handleInvite} disabled={!inviteEmail.trim() || inviting} className="btn-primary w-full">
            {inviting ? <Spinner size="sm" /> : t('inviteMember')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
