import { useEffect, useMemo, useState } from 'react';

import { downloadFile, fetchFiles, mediaUrl } from '../lib/api';
import BevelButton from './ui/BevelButton';
import WindowFrame from './ui/WindowFrame';

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogg', 'mov', 'mkv', 'm4v']);

function isVideoFile(name) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return VIDEO_EXTENSIONS.has(ext);
}

function captureVideoThumbnail(src) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = src;

    const cleanup = () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    };

    const onError = () => {
      cleanup();
      reject(new Error('thumbnail capture failed'));
    };

    video.addEventListener('error', onError, { once: true });

    video.addEventListener(
      'loadeddata',
      () => {
        const target = video.duration && Number.isFinite(video.duration) && video.duration > 1
          ? Math.min(1, video.duration / 2)
          : 0;

        const drawFrame = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(video.videoWidth, 1);
            canvas.height = Math.max(video.videoHeight, 1);
            const ctx = canvas.getContext('2d');

            if (!ctx) {
              throw new Error('canvas context unavailable');
            }

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            cleanup();
            resolve(dataUrl);
          } catch (error) {
            cleanup();
            reject(error);
          }
        };

        if (target > 0) {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            drawFrame();
          };

          video.addEventListener('seeked', onSeeked);
          try {
            video.currentTime = target;
          } catch {
            drawFrame();
          }
        } else {
          drawFrame();
        }
      },
      { once: true }
    );
  });
}

export default function BrowseFilesPanel() {
  const [entries, setEntries] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [parentPath, setParentPath] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [playingFile, setPlayingFile] = useState('');
  const [thumbnails, setThumbnails] = useState({});

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
      setThumbnails({});
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

  useEffect(() => {
    let cancelled = false;

    async function buildThumbnails() {
      const videoEntries = entries.filter((entry) => !entry.is_dir && isVideoFile(entry.name));

      for (const entry of videoEntries) {
        if (cancelled) {
          return;
        }

        try {
          const thumb = await captureVideoThumbnail(mediaUrl(entry.path));
          if (!cancelled) {
            setThumbnails((prev) => {
              if (prev[entry.path]) {
                return prev;
              }

              return { ...prev, [entry.path]: thumb };
            });
          }
        } catch {
          if (!cancelled) {
            setThumbnails((prev) => {
              if (prev[entry.path] !== undefined) {
                return prev;
              }

              return { ...prev, [entry.path]: null };
            });
          }
        }
      }
    }

    buildThumbnails();

    return () => {
      cancelled = true;
    };
  }, [entries]);

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
          entries.map((entry) => {
            const video = !entry.is_dir && isVideoFile(entry.name);
            const thumb = thumbnails[entry.path];

            return (
              <article className="explorer-card" key={entry.path}>
                {video ? (
                  thumb ? (
                    <img className="explorer-thumb" src={thumb} alt={`${entry.name} thumbnail`} />
                  ) : (
                    <div className="explorer-thumb explorer-thumb-placeholder" aria-hidden="true">
                      VIDEO
                    </div>
                  )
                ) : (
                  <div className="explorer-icon" aria-hidden="true">
                    {entry.is_dir ? 'DIR' : 'FILE'}
                  </div>
                )}

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
                      {video ? (
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
            );
          })
        )}
      </div>

      {playingSrc ? (
        <section className="media-player-wrap" aria-live="polite">
          <p>
            <strong>Now Playing:</strong> {playingFile}
          </p>
          <video className="media-player" controls playsInline autoPlay src={playingSrc} preload="metadata" />
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
