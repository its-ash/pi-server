import { useState } from 'react';

import { fetchApis } from '../lib/api';
import BevelButton from './ui/BevelButton';
import WindowFrame from './ui/WindowFrame';

function methodBadgeClass(method) {
  const m = method?.toUpperCase();
  if (m === 'GET') return 'bg-[#107C10]/10 text-[#107C10]';
  if (m === 'POST') return 'bg-[#0078D4]/10 text-[#0078D4]';
  if (m === 'PUT') return 'bg-orange-100 text-orange-700';
  if (m === 'DELETE') return 'bg-red-100 text-[#C42B1C]';
  return 'bg-gray-100 text-gray-600';
}

export default function ViewApiPanel() {
  const [apis, setApis] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadApis() {
    setError('');
    setBusy(true);

    try {
      const data = await fetchApis();
      setApis(data.apis || []);
    } catch (apiError) {
      const message =
        apiError?.response?.data?.error || apiError?.message || 'Failed to fetch APIs.';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <WindowFrame title="View API">
      <BevelButton tone="blue" type="button" onClick={loadApis} disabled={busy}>
        {busy ? 'Loading...' : 'Fetch API Index'}
      </BevelButton>

      {error ? (
        <pre className="mt-4 text-xs bg-red-50 border border-red-200 rounded-xl p-3 text-[#C42B1C] whitespace-pre-wrap">
          {error}
        </pre>
      ) : null}

      <div className="mt-4 space-y-3">
        {apis.map((api) => (
          <article
            className="bg-white border border-black/8 rounded-xl overflow-hidden"
            key={`${api.method}-${api.path}`}
          >
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50/80 border-b border-black/6">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${methodBadgeClass(api.method)}`}>
                {api.method}
              </span>
              <code className="text-sm font-mono text-gray-800">{api.path}</code>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-sm text-[#605E5C]">{api.description}</p>

              {api.payload ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#605E5C] uppercase tracking-wider">
                    Payload:{' '}
                    <span className="font-mono font-normal normal-case text-gray-700">
                      {api.payload.content_type}
                    </span>
                  </p>
                  <ul className="space-y-1.5">
                    {api.payload.fields.map((field) => (
                      <li key={field.name} className="flex flex-wrap gap-1.5 items-center text-xs">
                        <span className="font-semibold text-gray-900 font-mono bg-gray-100 px-1.5 py-0.5 rounded-md">
                          {field.name}
                        </span>
                        <span className="text-[#605E5C]">({field.field_type})</span>
                        <span
                          className={`px-1.5 py-0.5 rounded-md ${
                            field.required
                              ? 'bg-red-100 text-[#C42B1C]'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {field.required ? 'required' : 'optional'}
                        </span>
                        <span className="text-[#605E5C]">{field.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-[#605E5C]">
                  <span className="font-semibold text-gray-700">Payload:</span> none
                </p>
              )}

              <div>
                <p className="text-xs font-semibold text-[#605E5C] uppercase tracking-wider mb-1.5">
                  Response Example
                </p>
                <pre className="text-xs bg-gray-50 border border-black/8 rounded-xl p-3 overflow-auto text-gray-700 whitespace-pre-wrap">
                  {JSON.stringify(api.response_example, null, 2)}
                </pre>
              </div>
            </div>
          </article>
        ))}
      </div>
    </WindowFrame>
  );
}
