import { useState } from 'react';

import { fetchApis } from '../lib/api';
import BevelButton from './ui/BevelButton';
import WindowFrame from './ui/WindowFrame';

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
    <WindowFrame title="VIEW API">
      <BevelButton tone="red" type="button" onClick={loadApis} disabled={busy}>
        {busy ? 'Loading...' : 'Fetch API Index'}
      </BevelButton>

      {error ? <pre className="message-error">{error}</pre> : null}

      {apis.map((api) => (
        <article className="api-card" key={`${api.method}-${api.path}`}>
          <div className="api-head">
            <span className="api-method">{api.method}</span>
            <code className="api-path">{api.path}</code>
          </div>

          <div className="api-body">
            <p>{api.description}</p>

            {api.payload ? (
              <>
                <p>
                  <strong>Payload:</strong> {api.payload.content_type}
                </p>
                <ul className="payload-list">
                  {api.payload.fields.map((field) => (
                    <li key={field.name}>
                      <strong>{field.name}</strong> ({field.field_type})
                      {' - '}
                      {field.required ? 'required' : 'optional'}
                      {' - '}
                      {field.description}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>
                <strong>Payload:</strong> none
              </p>
            )}

            <p>
              <strong>Response Example:</strong>
            </p>
            <pre className="message-ok">{JSON.stringify(api.response_example, null, 2)}</pre>
          </div>
        </article>
      ))}
    </WindowFrame>
  );
}
