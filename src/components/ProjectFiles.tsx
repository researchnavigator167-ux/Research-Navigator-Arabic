import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useApp } from '@/lib/AppContext';
import { fetchFiles, uploadFile, downloadFile, deleteFile } from '@/lib/collaboration';
import { EmptyState, Spinner } from '@/components/ui';
import { Upload, Download, Trash2, FileText, File, FileType } from 'lucide-react';
import type { ProjectFile, ResearchProject } from '@/types';

const FILE_ICONS: Record<string, typeof FileText> = {
  'application/pdf': FileText,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileType,
  'application/vnd.msword': FileType,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': File,
  'application/vnd.ms-powerpoint': File,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': File,
  'application/vnd.ms-excel': File,
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectFiles({ project }: { project: ResearchProject }) {
  const { user } = useAuth();
  const { t } = useApp();
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await fetchFiles(project.id);
      setFiles(data);
      setLoading(false);
    }
    load();
  }, [project.id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    setError(null);
    const result = await uploadFile(project.id, user.id, file);
    if ('error' in result) {
      setError(t(result.error));
    } else {
      setFiles((prev) => [result, ...prev]);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = async (filePath: string) => {
    const url = await downloadFile(filePath);
    if (url) {
      window.open(url, '_blank');
    }
  };

  const handleDelete = async (fileId: string, filePath: string) => {
    await deleteFile(fileId, filePath);
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>;

  return (
    <div className="animate-fade-in">
      <div className="mb-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.pptx,.xlsx,.doc,.ppt,.xls"
          onChange={handleUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="btn-primary w-full text-xs"
        >
          {uploading ? <Spinner size="sm" /> : <><Upload className="w-4 h-4" /> {t('uploadFile')}</>}
        </button>
        {error && <p className="text-xs text-error-500 mt-2 text-center">{error}</p>}
        <p className="text-[10px] text-neutral-400 mt-2 text-center">{t('supportedFormats')}</p>
      </div>

      {files.length === 0 ? (
        <EmptyState
          icon={<Upload className="w-8 h-8 text-primary-700 dark:text-primary-400" />}
          title={t('noFiles')}
          description={t('noFilesDesc')}
        />
      ) : (
        <div className="space-y-3">
          {files.map((file) => {
            const Icon = FILE_ICONS[file.file_type] || File;
            return (
              <div key={file.id} className="card flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-primary-700 dark:text-primary-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{file.file_name}</p>
                  <p className="text-[10px] text-neutral-400">{formatSize(file.file_size)}</p>
                </div>
                <button onClick={() => handleDownload(file.file_path)} className="text-neutral-400 hover:text-primary-500 p-1">
                  <Download className="w-4 h-4" />
                </button>
                {file.uploaded_by === user?.id && (
                  <button onClick={() => handleDelete(file.id, file.file_path)} className="text-neutral-300 hover:text-error-500 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
