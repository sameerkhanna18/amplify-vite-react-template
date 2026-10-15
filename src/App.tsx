import { useState } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import '@aws-amplify/ui-react/styles.css';

const client = generateClient<Schema>();

type AuditRecord = {
  Host: string;
  Make: string;
  Model: string;
  Serial: string;
  OsVersion: string;
  Kernel: string;
  CPU: string;
  Ram: string;
  Storage: string;
};

function AuditPage({
  signOut,
  user,
}: {
  signOut?: () => void;
  user?: { signInDetails?: { loginId?: string } };
}) {
  const [audit, setAudit] = useState<AuditRecord | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadAudit() {
    setBusy(true);
    setMessage('');
    setAudit(null);

    try {
      const response = await fetch('http://127.0.0.1:8765/audit');

      if (!response.ok) {
        throw new Error('Could not retrieve audit data from Ubuntu.');
      }

      const data = await response.json();

const hostname = data.Host ?? data.Hostname ?? data.host ?? data.hostname;

if (!hostname) {
  throw new Error('The audit data does not contain a hostname.');
}

const record = {
  ...data,
  Host: hostname,
} as AuditRecord;

setAudit(record);

      setMessage('Audit loaded. Review the information before submitting.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load audit information.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitAudit() {
    if (!audit) return;

    setBusy(true);
    setMessage('');

    try {
      const result = await client.models.DeviceAudit.create({
        ...audit,
        AuditTime: new Date().toISOString(),
      });

      if (result.errors?.length || !result.data) {
        throw new Error(
          result.errors?.map((error) => error.message).join('; ') ||
            'Unable to save the audit.'
        );
      }

      setMessage('Success! The computer audit was saved to AWS.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'The audit submission failed.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 800, margin: '40px auto', padding: 24 }}>
      <h1>Computer Audit</h1>

      <p>
        Signed in as: {user?.signInDetails?.loginId ?? 'Authenticated user'}
      </p>

      <p>
        Load the computer information collected by your Ubuntu audit script.
      </p>

      <button onClick={loadAudit} disabled={busy}>
        Load audit from Ubuntu
      </button>

      {audit && (
        <section>
          <h2>Review computer information</h2>

          <table>
            <tbody>
              {Object.entries(audit).map(([key, value]) => (
  <tr key={key}>
    <th style={{ textAlign: 'left', padding: 8 }}>{key}</th>
    <td style={{ padding: 8 }}>
      {value == null || value === '' ? (
        'Not available'
      ) : typeof value === 'object' ? (
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : (
        String(value)
      )}
    </td>
  </tr>
))}
            </tbody>
          </table>

          <button onClick={submitAudit} disabled={busy}>
            Submit to AWS
          </button>
        </section>
      )}

      {busy && <p>Working...</p>}
      {message && <p role="status">{message}</p>}

      <hr style={{ marginTop: 32 }} />

      <button onClick={signOut}>Sign out</button>
    </main>
  );
}

export default function App() {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <AuditPage signOut={signOut ?? undefined} user={user} />
      )}
    </Authenticator>
  );
}
