import { useEffect, useMemo, useState } from 'react';

import { downloadFile, fetchFiles, mediaUrl } from '../lib/api';
import BevelButton from './ui/BevelButton';
import WindowFrame from './ui/WindowFrame';

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogg', 'mov', 'mkv', 'm4v']);

function isVideoFile(name) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return VIDEO_EXTENSIONS.has(ext);
}

export default function BrowseFilesPanel() {
  const [entries, setEntries] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [parentPath, setParentPath] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [playingFile, setPlayingFile] = useState('');

  const playingSrc = useMemo(() => {
    if (!playingFile) {
      return '';
    }

    return mediaUrl(playingFile);
  }, [playingFile]);

  async function loadFiles(path = currentPath) {
    setError('');
    setBusy(true);

    try {
      const data = await fetchFiles(path);
      setEntries(data.files || []);
      setCurrentPath(data.current_path || '');
      setParentPath(data.parent_path ?? null);
    } catch (listError) {
      const message =
        listError?.response?.data?.error || listError?.message || 'Failed to fetch files.';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadFiles('');
  }, []);

  const breadcrumbParts = currentPath ? currentPath.split('/') : [];

  function onOpenDirectory(path) {
    setPlayingFile('');
    loadFiles(path);
  }

  return (
    <WindowFrame title="BROWSE FILES">
      <div className="explorer-toolbar">
        <BevelButton tone="green" type="button" onClick={() => loadFiles(currentPath)} disabled={busy}>
          {busy ? 'Loading...' : 'Refresh'}
        </BevelButton>
        <BevelButton
          type="button"
          onClick={() => onOpenDirectory(parentPath ?? '')}
          disabled={busy || parentPath === null}
        >
          Up Folder
        </BevelButton>
      </div>

      <div className="breadcrumb" aria-label="Current ftp path">
        <button type="button" className="crumb-btn" onClick={() => onOpenDirectory('')}>
          ftp
        </button>
        {breadcrumbParts.map((part, index) => {
          const path = breadcrumbParts.slice(0, index + 1).join('/');
          return (
            <span key={path}>
              {' / '}
              <button type="button" className="crumb-btn" onClick={() => onOpenDirectory(path)}>
                {part}
              </button>
            </span>
          );
        })}
      </div>

      {error ? <pre className="message-error">{error}</pre> : null}

      <div className="explorer-grid">
        {entries.length === 0 ? (
          <div className="explorer-card explorer-empty">No files or folders.</div>
        ) : (
          entries.map((entry) => (
            <article className="explorer-card" key={entry.path}>
              <div className="explorer-icon" aria-hidden="true">
                {entry.is_dir ? 'DIR' : 'FILE'}
              </div>

              <h3 className="explorer-name" title={entry.name}>
                {entry.name}
              </h3>

              <p className="meta explorer-meta">
                {entry.is_dir ? 'Folder' : `${entry.size} bytes`}
              </p>

              <div className="explorer-actions">
                {entry.is_dir ? (
                  <BevelButton tone="green" type="button" onClick={() => onOpenDirectory(entry.path)}>
                    Open
                  </BevelButton>
                ) : (
                  <>
                    {isVideoFile(entry.name) ? (
                      <BevelButton tone="red" type="button" onClick={() => setPlayingFile(entry.path)}>
                        Play
                      </BevelButton>
                    ) : null}
                    <BevelButton tone="blue" type="button" onClick={() => downloadFile(entry.path)}>
                      Download
                    </BevelButton>
                  </>
                )}
              </div>
            </article>
          ))
        )}
      </div>

      {playingSrc ? (
        <section className="media-player-wrap" aria-live="polite">
          <p>
            <strong>Now Playing:</strong> {playingFile}
          </p>
          <video className="media-player" controls src={playingSrc} preload="metadata" />
          <div>
            <BevelButton type="button" onClick={() => setPlayingFile('')}>
              Close Player
            </BevelButton>
          </div>
        </section>
      ) : null}
    </WindowFrame>
  );
}
