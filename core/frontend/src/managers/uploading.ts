import { useTasks } from '@/stores/tasks.tsx';
import { Upload, useMessaging } from '@/stores/messaging.tsx';
import { backendUrl } from '@/utils/api';
import { zUploadOutput } from '@tiny-chat/core-backend/src/types.ts';

export async function uploadFiles(files: File[]) {
  if (!files.length) return;

  const { setUploading, addUploads } = useMessaging.getState();
  const { addTask, updateTask, removeTask } = useTasks.getState();

  setUploading(true);
  addTask('upload', 'Uploading', `${files.length} file${files.length !== 1 ? 's' : ''}`);

  try {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file, file.name);
    }

    const token = localStorage.getItem('token');

    const result = await new Promise<Upload[]>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${backendUrl}/@/upload`, true);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          void updateTask('upload', percentComplete);
        }
      };

      xhr.onload = () => {
        try {
          resolve(zUploadOutput.parse(JSON.parse(xhr.responseText.slice(6))));
        } catch {
          reject(new Error(xhr.responseText));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Failed to upload'));
      };

      xhr.send(formData);
    });

    addUploads(...result);
  } catch (err: unknown) {
    console.error('Upload failed:', err);
    const msg = err instanceof Error ? err.message : 'Upload failed';
    void updateTask('upload', 100, msg);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  } finally {
    void removeTask('upload');
    setUploading(false);
  }
}
