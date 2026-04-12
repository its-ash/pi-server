import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 0
});

export async function uploadFile({ file, filename, onProgress }) {
  const formData = new FormData();
  formData.append('file', file);

  if (filename && filename.trim().length > 0) {
    formData.append('filename', filename.trim());
  }

  const { data } = await api.post('/upload', formData, {
    onUploadProgress: (event) => {
      if (!onProgress) {
        return;
      }

      if (!event.total || event.total === 0) {
        onProgress(0);
        return;
      }

      const percent = Math.min(100, Math.round((event.loaded * 100) / event.total));
      onProgress(percent);
    }
  });

  return data;
}

export async function fetchFiles(path = '') {
  const params = path ? { path } : undefined;
  const { data } = await api.get('/files', { params });
  return data;
}

export async function fetchApis() {
  const { data } = await api.get('/apis');
  return data;
}

export async function fetchSystemStats() {
  const { data } = await api.get('/system');
  return data;
}

export function mediaUrl(path) {
  return `/api/play?path=${encodeURIComponent(path)}`;
}

export function downloadUrl(path) {
  return `/api/download?path=${encodeURIComponent(path)}`;
}

export function downloadFile(path) {
  const fileName = path.split('/').pop() || 'file';
  const link = document.createElement('a');
  link.href = downloadUrl(path);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
