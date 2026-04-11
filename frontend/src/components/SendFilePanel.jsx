import { useState } from 'react';

import { uploadFile } from '../lib/api';
import BevelButton from './ui/BevelButton';
import WindowFrame from './ui/WindowFrame';

export default function SendFilePanel() {
  const [file, setFile] = useState(null);
  const [filename, setFilename] = useState('');
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setResult(null);
    setProgress(0);

    if (!file) {
      setError('Select one file first.');
      return;
    }

    try {
      setBusy(true);
      const data = await uploadFile({
        file,
        filename,
        onProgress: (value) => setProgress(value),
      });
      setResult(data);
    } catch (uploadError) {
      const message =
        uploadError?.response?.data?.error || uploadError?.message || 'Upload failed.';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <WindowFrame title="SEND FILE" badge="HOT!">
      <form onSubmit={handleSubmit} className="form-grid">
        <label className="field">
          FILE
          <input
            type="file"
            onChange={(event) => {
              setFile(event.target.files?.[0] || null);
            }}
            required
          />
        </label>

        <label className="field">
          FILENAME (OPTIONAL)
          <input
            type="text"
            value={filename}
            onChange={(event) => setFilename(event.target.value)}
            placeholder="example.bin"
          />
        </label>

        <BevelButton tone="blue" type="submit" disabled={busy}>
          {busy ? 'Uploading...' : 'Upload'}
        </BevelButton>
      </form>

      <div className="progress-row" aria-live="polite">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="meta">PROGRESS: {progress}%</span>
      </div>

      {result ? <pre className="message-ok">{JSON.stringify(result, null, 2)}</pre> : null}
      {error ? <pre className="message-error">{error}</pre> : null}
    </WindowFrame>
  );
}
