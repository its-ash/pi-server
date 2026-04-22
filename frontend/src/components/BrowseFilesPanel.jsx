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
    <WindowFrame title="Browse Files">
      <div className="flex flex-wrap gap-2 mb-3">
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

      <nav className="flex items-center flex-wrap gap-1 text-sm bg-black/4 rounded-xl px-3 py-2 mb-4 font-mono" aria-label="Current ftp path">
        <button type="button" className="text-[#0078D4] hover:text-[#106EBE] font-medium transition-colors cursor-pointer" onClick={() => onOpenDirectory('')}>
          ftp
        </button>
        {breadcrumbParts.map((part, index) => {
          const path = breadcrumbParts.slice(0, index + 1).join('/');
          return (
            <span key={path} className="flex items-center gap-1">
              <span className="text-[#605E5C]">/</span>
              <button type="button" className="text-[#0078D4] hover:text-[#106EBE] transition-colors cursor-pointer" onClick={() => onOpenDirectory(path)}>
                {part}
              </button>
            </span>
          );
        })}
      </nav>

      {error ? (
        <pre className="mb-4 text-xs bg-red-50 border border-red-200 rounded-xl p-3 text-[#C42B1C] whitespace-pre-wrap">
          {error}
        </pre>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {entries.length === 0 ? (
          <div className="col-span-full text-sm text-[#605E5C] py-8 text-center">
            No files or folders.
          </div>
        ) : (
          entries.map((entry) => {
            const video = !entry.is_dir && isVideoFile(entry.name);
            const thumb = thumbnails[entry.path];

            return (
              <article
                className="bg-white border border-black/8 rounded-xl p-3 flex flex-col gap-2 hover:shadow-md hover:border-black/15 transition-all duration-200"
                key={entry.path}
              >
                {video ? (
                  thumb ? (
                    <img
                      className="w-full h-18 object-cover rounded-lg"
                      src={thumb}
                      alt={`${entry.name} thumbnail`}
                    />
                  ) : (
                    <div
                      className="w-full h-18 rounded-lg bg-gray-900 flex items-center justify-center text-xs font-mono text-green-400"
                      aria-hidden="true"
                    >
                      VIDEO
                    </div>
                  )
                ) : (
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${
                      entry.is_dir ? 'bg-[#EFF6FC] text-[#0078D4]' : 'bg-gray-100 text-[#605E5C]'
                    }`}
                    aria-hidden="true"
                  >
                    {entry.is_dir ? 'DIR' : 'FILE'}
                  </div>
                )}

                <h3 className="text-sm font-medium text-gray-900 leading-tight wrap-anywhere" title={entry.name}>
                  {entry.name}
                </h3>

                <p className="text-xs text-[#605E5C]">
                  {entry.is_dir ? 'Folder' : `${entry.size} bytes`}
                </p>

                <div className="flex flex-wrap gap-1.5 mt-auto">
                  {entry.is_dir ? (
                    <BevelButton
                      tone="green"
                      type="button"
                      className="text-xs px-3 py-1"
                      onClick={() => onOpenDirectory(entry.path)}
                    >
                      Open
                    </BevelButton>
                  ) : (
                    <>
                      {video ? (
                        <BevelButton
                          tone="red"
                          type="button"
                          className="text-xs px-3 py-1"
                          onClick={() => setPlayingFile(entry.path)}
                        >
                          Play
                        </BevelButton>
                      ) : null}
                      <BevelButton
                        tone="blue"
                        type="button"
                        className="text-xs px-3 py-1"
                        onClick={() => downloadFile(entry.path)}
                      >
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
        <section className="mt-4 bg-gray-950 rounded-xl overflow-hidden" aria-live="polite">
          <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between gap-3">
            <p className="text-xs text-white/70 font-mono truncate">
              <strong className="text-white/90">Now Playing:</strong> {playingFile}
            </p>
            <BevelButton
              type="button"
              className="text-xs px-3 py-1 shrink-0 bg-white/10! text-white! border-white/20! hover:bg-white/20!"
              onClick={() => setPlayingFile('')}
            >
              Close Player
            </BevelButton>
          </div>
          <video
            className="w-full"
            controls
            playsInline
            autoPlay
            src={playingSrc}
            preload="metadata"
          />
        </section>
      ) : null}
    </WindowFrame>
  );
}
