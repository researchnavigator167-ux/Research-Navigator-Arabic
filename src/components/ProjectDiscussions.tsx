import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useApp } from '@/lib/AppContext';
import { fetchComments, addComment, deleteComment, fetchMembers } from '@/lib/collaboration';
import { EmptyState, Spinner } from '@/components/ui';
import { MessageCircle, Trash2, Send } from 'lucide-react';
import type { ProjectComment, ProjectMember, ResearchProject } from '@/types';

export function ProjectDiscussions({ project }: { project: ResearchProject }) {
  const { user } = useAuth();
  const { t } = useApp();
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [commentData, memberData] = await Promise.all([
        fetchComments(project.id),
        fetchMembers(project.id),
      ]);
      setComments(commentData);
      setMembers(memberData);
      setLoading(false);
    }
    load();
  }, [project.id]);

  const handleSend = async () => {
    if (!input.trim() || !user) return;
    setSending(true);
    try {
      const newComment = await addComment(project.id, user.id, input.trim());
      if (newComment) {
        setComments((prev) => [newComment, ...prev]);
        setInput('');
      }
    } catch { /* ignore */ }
    setSending(false);
  };

  const handleDelete = async (commentId: string) => {
    await deleteComment(commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  const getMemberLabel = (userId: string) => {
    if (userId === user?.id) return t('you');
    const member = members.find((m) => m.user_id === userId);
    return member ? userId.substring(0, 8) + '...' : userId.substring(0, 8) + '...';
  };

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

  return (
    <div className="animate-fade-in">
      <div className="card mb-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="input-field min-h-[60px] resize-none"
          placeholder={t('commentPlaceholder')}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="btn-primary w-full mt-3 text-xs"
        >
          {sending ? <Spinner size="sm" /> : <><Send className="w-4 h-4" /> {t('addComment')}</>}
        </button>
      </div>

      {comments.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="w-8 h-8 text-primary-700 dark:text-primary-400" />}
          title={t('noComments')}
          description={t('noCommentsDesc')}
        />
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => {
            const isMine = comment.user_id === user?.id;
            const isOwner = members.find((m) => m.user_id === user?.id)?.role === 'owner';
            return (
              <div key={comment.id} className="card">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary-700 dark:text-primary-400">
                      {getMemberLabel(comment.user_id)[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-neutral-900 dark:text-white">
                        {getMemberLabel(comment.user_id)}
                      </span>
                      <span className="text-[10px] text-neutral-400">{formatDate(comment.created_at)}</span>
                    </div>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-line">
                      {comment.content}
                    </p>
                  </div>
                  {(isMine || isOwner) && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="text-neutral-300 hover:text-error-500 p-1 flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
