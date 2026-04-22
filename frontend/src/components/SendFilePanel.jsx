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
    <WindowFrame title="Send File" badge="HOT!">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-[#605E5C] uppercase tracking-wider">File</span>
          <input
            type="file"
            onChange={(event) => {
              setFile(event.target.files?.[0] || null);
            }}
            required
            className="block w-full text-sm text-gray-700 border border-black/15 rounded-xl px-3 py-2 bg-white/70 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0078D4] focus:border-transparent transition-all duration-150 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-[#EFF6FC] file:text-[#0078D4] hover:file:bg-[#DEECF9] file:cursor-pointer file:transition-colors file:duration-150"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-[#605E5C] uppercase tracking-wider">
            Filename (Optional)
          </span>
          <input
            type="text"
            value={filename}
            onChange={(event) => setFilename(event.target.value)}
            placeholder="example.bin"
            className="w-full border border-black/15 rounded-xl px-3 py-2 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-[#0078D4] focus:border-transparent transition-all duration-150 placeholder:text-gray-400"
          />
        </label>

        <BevelButton tone="blue" type="submit" disabled={busy} className="w-full">
          {busy ? 'Uploading...' : 'Upload'}
        </BevelButton>
      </form>

      <div className="mt-4 space-y-1.5" aria-live="polite">
        <div className="flex justify-between text-xs text-[#605E5C]">
          <span>Progress</span>
          <span className="font-mono">{progress}%</span>
        </div>
        <div className="h-1.5 bg-black/8 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#0078D4] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {result ? (
        <>
          {result.apk_meta ? (
            <div className="mt-4 flex items-center gap-3 p-3 bg-[#EFF6FC] border border-[#0078D4]/20 rounded-xl">
              {result.apk_meta.app_icon_b64 ? (
                <img
                  src={`data:${result.apk_meta.app_icon_mime ?? 'image/png'};base64,${result.apk_meta.app_icon_b64}`}
                  alt="app icon"
                  className="w-12 h-12 rounded-xl object-contain flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-[#DEECF9] flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">📦</span>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#201F1E] truncate">
                  {result.apk_meta.app_name ?? result.filename}
                </p>
                <p className="text-xs text-[#605E5C] truncate">{result.filename}</p>
              </div>
            </div>
          ) : null}
          <pre className="mt-4 text-xs bg-green-50 border border-green-200 rounded-xl p-3 overflow-auto text-green-800 whitespace-pre-wrap">
            {JSON.stringify(
              { ...result, apk_meta: result.apk_meta ? { ...result.apk_meta, app_icon_b64: result.apk_meta.app_icon_b64 ? '[base64]' : undefined } : undefined },
              null,
              2,
            )}
          </pre>
        </>
      ) : null}
      {error ? (
        <pre className="mt-4 text-xs bg-red-50 border border-red-200 rounded-xl p-3 text-[#C42B1C] whitespace-pre-wrap">
          {error}
        </pre>
      ) : null}
    </WindowFrame>
  );
}
