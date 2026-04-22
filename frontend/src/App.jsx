import { useEffect, useMemo, useState } from 'react';
import Marquee from 'react-fast-marquee';

import SendFilePanel from './components/SendFilePanel';
import BrowseFilesPanel from './components/BrowseFilesPanel';
import ViewApiPanel from './components/ViewApiPanel';
import AppStorePanel from './components/AppStorePanel';
import { fetchSystemStats } from './lib/api';

const OFFLINE_MESSAGE = 'Pi is offline or Electricity issue';

const TABS = [
  { key: 'send', label: '1. Send File' },
  { key: 'browse', label: '2. Browse Files' },
  { key: 'api', label: '3. View API' },
  { key: 'store', label: '4. App Store' },
];

function formatRam(usedKiB, totalKiB) {
  const usedMiB = usedKiB / 1024;
  const totalMiB = totalKiB / 1024;
  return `${usedMiB.toFixed(0)} / ${totalMiB.toFixed(0)} MiB`;
}

function StatBar({ label, value, displayValue, color }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#605E5C]">{label}</span>
        <span className="text-xs font-semibold tabular-nums font-mono" style={{ color }}>{displayValue}</span>
      </div>
      <div className="h-2 bg-black/8 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState('send');
  const [system, setSystem] = useState(null);
  const [systemError, setSystemError] = useState('');
  const [showOfflineDialog, setShowOfflineDialog] = useState(false);

  const panel = useMemo(() => {
    if (active === 'send') {
      return <SendFilePanel />;
    }

    if (active === 'browse') {
      return <BrowseFilesPanel />;
    }

    if (active === 'store') {
      return <AppStorePanel />;
    }

    return <ViewApiPanel />;
  }, [active]);

  useEffect(() => {
    let mounted = true;

    async function loadStats() {
      try {
        const data = await fetchSystemStats();
        if (!mounted) {
          return;
        }

        setSystem(data);
        setSystemError('');
        setShowOfflineDialog(false);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setSystemError(OFFLINE_MESSAGE);
        setShowOfflineDialog(true);
      }
    }

    loadStats();
    const timer = setInterval(loadStats, 5000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 via-blue-50/20 to-slate-100 font-sans">

      {showOfflineDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm p-4" role="presentation">
          <dialog
            open
            aria-labelledby="offline-dialog-title"
            className="static block w-full max-w-sm m-0 p-0 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-black/8"
          >
            <div className="px-5 py-4 border-b border-black/6">
              <h2 id="offline-dialog-title" className="text-base font-semibold text-gray-900">
                System Alert
              </h2>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-[#605E5C]">{OFFLINE_MESSAGE}</p>
            </div>
            <div className="px-5 py-3 border-t border-black/6 flex justify-end">
              <button
                type="button"
                className="px-4 py-2 rounded-xl text-sm font-medium bg-[#C42B1C] hover:bg-[#A42118] active:bg-[#821410] text-white transition-colors duration-150 cursor-pointer"
                onClick={() => setShowOfflineDialog(false)}
              >
                Close
              </button>
            </div>
          </dialog>
        </div>
      ) : null}

      <header className="sticky top-0 z-40 bg-white/75 backdrop-blur-xl border-b border-black/8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Ash Home</h1>
          <span className="text-xs text-[#605E5C] font-mono hidden sm:block" aria-label="Visitor counter">
            VISITORS: 0001234 | SINCE 1997
          </span>
        </div>
      </header>

      <div className="bg-[#0078D4]/6 border-b border-[#0078D4]/15" aria-live="polite">
        <Marquee gradient={false} speed={45} pauseOnHover>
          <div className="flex items-center gap-8 py-2 px-4 text-xs font-medium">
            <span className="text-[#0078D4]">WELCOME TO THE FILE ZONE</span>
            <span className="text-[#C42B1C]">UPLOADS READY</span>
            <span className="text-[#107C10]">FTP BROWSER ACTIVE</span>
            <span className="text-[#7B0099]">API INDEX LIVE</span>
          </div>
        </Marquee>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        <nav className="flex gap-1 bg-black/5 rounded-xl p-1" aria-label="Main options">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              className={`flex-1 text-sm font-medium py-2 px-3 rounded-lg transition-all duration-150 cursor-pointer ${
                active === tab.key
                  ? 'bg-white text-[#0078D4] shadow-sm'
                  : 'text-[#605E5C] hover:text-gray-900 hover:bg-white/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {panel}

        <section className="bg-white/85 backdrop-blur-sm rounded-xl border border-black/8 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-black/6">
            <h2 className="text-xs font-semibold text-[#605E5C] uppercase tracking-wider">System Load</h2>
          </div>
          <div className="p-4">
            {systemError ? (
              <p className="text-sm text-[#C42B1C] font-mono">{systemError}</p>
            ) : null}
            {system ? (
              <div className="space-y-4">
                <StatBar
                  label="CPU Usage"
                  value={system.cpu_usage_percent ?? 0}
                  displayValue={system.cpu_usage_percent != null ? `${system.cpu_usage_percent.toFixed(1)}%` : 'N/A'}
                  color={(system.cpu_usage_percent ?? 0) > 85 ? '#C42B1C' : (system.cpu_usage_percent ?? 0) > 60 ? '#D83B01' : '#0078D4'}
                />
                <StatBar
                  label="RAM Usage"
                  value={system.ram_usage_percent ?? 0}
                  displayValue={system.ram_usage_percent != null ? `${system.ram_usage_percent.toFixed(1)}% — ${formatRam(system.used_memory_kib, system.total_memory_kib)}` : 'N/A'}
                  color={(system.ram_usage_percent ?? 0) > 85 ? '#C42B1C' : (system.ram_usage_percent ?? 0) > 60 ? '#D83B01' : '#107C10'}
                />
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-[#605E5C]">Processes</span>
                  <strong className="text-xs font-semibold tabular-nums text-gray-900">{system.process_count}</strong>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#605E5C]">Loading system stats...</p>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
