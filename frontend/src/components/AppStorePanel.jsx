import { useEffect, useState } from 'react';
import { appDownloadUrl, fetchApks } from '../lib/api';
import BevelButton from './ui/BevelButton';
import WindowFrame from './ui/WindowFrame';

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export default function AppStorePanel() {
  const [apps, setApps] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setBusy(true);
    setError('');
    try {
      const data = await fetchApks();
      setApps(data.apps ?? []);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load apps.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <WindowFrame title="App Store">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-[#605E5C]">APKs available for download</p>
        <BevelButton tone="default" onClick={load} disabled={busy} className="text-xs px-3 py-1.5">
          {busy ? 'Loading…' : 'Refresh'}
        </BevelButton>
      </div>

      {error ? (
        <p className="text-sm text-[#C42B1C] font-mono">{error}</p>
      ) : null}

      {!busy && apps.length === 0 && !error ? (
        <p className="text-sm text-[#605E5C] text-center py-6">No APKs found in the apps folder.</p>
      ) : null}

      <div className="space-y-3">
        {apps.map((app) => (
          <div
            key={app.filename}
            className="flex items-center gap-3 p-3 rounded-xl border border-black/8 bg-white/70 hover:bg-white/90 transition-colors duration-150"
          >
            {app.app_icon_b64 ? (
              <img
                src={`data:${app.app_icon_mime ?? 'image/png'};base64,${app.app_icon_b64}`}
                alt="icon"
                className="w-12 h-12 rounded-xl object-contain flex-shrink-0 bg-gray-50"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-[#EFF6FC] flex items-center justify-center flex-shrink-0 text-xl">
                📦
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#201F1E] truncate">
                {app.app_name ?? app.filename}
              </p>
              <p className="text-xs text-[#605E5C] truncate font-mono">{app.filename}</p>
              <p className="text-xs text-[#605E5C]">{formatSize(app.size)}</p>
            </div>

            <a
              href={appDownloadUrl(app.filename)}
              download={app.filename}
              className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl text-xs font-medium border border-transparent bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white transition-colors duration-150 flex-shrink-0"
            >
              Install
            </a>
          </div>
        ))}
      </div>
    </WindowFrame>
  );
}
