import { useEffect, useMemo, useState } from 'react';
import Marquee from 'react-fast-marquee';

import SendFilePanel from './components/SendFilePanel';
import BrowseFilesPanel from './components/BrowseFilesPanel';
import ViewApiPanel from './components/ViewApiPanel';
import BevelButton from './components/ui/BevelButton';
import WindowFrame from './components/ui/WindowFrame';
import GrooveRule from './components/ui/GrooveRule';
import { fetchSystemStats } from './lib/api';

const OFFLINE_MESSAGE = 'Pi is offline or Electricity issue';

const TABS = [
  { key: 'send', label: '1. Send File' },
  { key: 'browse', label: '2. Browse Files' },
  { key: 'api', label: '3. View API' },
];

function formatRam(usedKiB, totalKiB) {
  const usedMiB = usedKiB / 1024;
  const totalMiB = totalKiB / 1024;
  return `${usedMiB.toFixed(0)} / ${totalMiB.toFixed(0)} MiB`;
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
    <div className="app-shell">
      {showOfflineDialog ? (
        <div className="offline-dialog-overlay" role="presentation">
          <dialog className="offline-dialog" open aria-labelledby="offline-dialog-title">
            <h2 id="offline-dialog-title">System Alert</h2>
            <p>{OFFLINE_MESSAGE}</p>
            <div className="offline-dialog-actions">
              <button
                type="button"
                className="btn-95 red"
                onClick={() => setShowOfflineDialog(false)}
              >
                Close
              </button>
            </div>
          </dialog>
        </div>
      ) : null}

      <WindowFrame title="PI SERVER TERMINAL" badge="NEW!" contentClassName="header-wrap">
        <h1 className="hero-title rainbow-text">Ash Home</h1>
        <div className="hit-counter" aria-label="Visitor counter">
          VISITORS: 0001234 | SINCE 1997
        </div>
      </WindowFrame>

      <div className="marquee-wrap" aria-live="polite">
        <Marquee gradient={false} speed={45} pauseOnHover>
          <div className="marquee-inner">
            <span style={{ color: '#0000ff' }}>WELCOME TO THE FILE ZONE</span>
            <span style={{ color: '#ff0000' }}>UPLOADS READY</span>
            <span style={{ color: '#008000' }}>FTP BROWSER ACTIVE</span>
            <span style={{ color: '#800080' }}>API INDEX LIVE</span>
          </div>
        </Marquee>
      </div>

      <div className="main-grid">
        <nav className="tab-grid" aria-label="Main options">
          {TABS.map((tab, index) => (
            <BevelButton
              key={tab.key}
              type="button"
              tone={index === 0 ? 'blue' : index === 1 ? 'green' : 'red'}
              active={active === tab.key}
              onClick={() => setActive(tab.key)}
            >
              {tab.label}
            </BevelButton>
          ))}
        </nav>

        <GrooveRule />

        {panel}

        <GrooveRule />

        <WindowFrame title="SYSTEM LOAD" contentClassName="system-panel">
          {systemError ? <pre className="message-error">{systemError}</pre> : null}
          {system ? (
            <div className="table-like">
              <div className="table-row">
                <span>CURRENT PROCESSES</span>
                <strong className="meta">{system.process_count}</strong>
              </div>
              <div className="table-row">
                <span>RAM LOAD</span>
                <strong className="meta">{system.ram_usage_percent.toFixed(2)}%</strong>
              </div>
              <div className="table-row">
                <span>RAM USAGE</span>
                <strong className="meta">
                  {formatRam(system.used_memory_kib, system.total_memory_kib)}
                </strong>
              </div>
            </div>
          ) : (
            <p className="meta">Loading system stats...</p>
          )}
        </WindowFrame>
      </div>
    </div>
  );
}
