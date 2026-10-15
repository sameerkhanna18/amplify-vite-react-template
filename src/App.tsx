import { useState } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import '@aws-amplify/ui-react/styles.css';

const client = generateClient<Schema>();

type RamModule = {
  name?: string;
  size_mb?: number;
  capacity_gb?: number;
  locator?: string;
  type?: string;
  speed?: string;
};

type RamInfo = {
  total_gb?: number;
  modules_installed?: number;
  slots_used?: number;
  slots_available?: number;
  slots_total?: number;
  modules?: RamModule[];
};

type DiskInfo = {
  name?: string;
  device?: string;
  capacity_gb?: number;
  model?: string;
};

type AuditRecord = {
  Host: string;
  Make: string;
  Model: string;
  Serial: string;
  OsVersion: string;
  Kernel: string;
  CPU: string;
  Ram: string | RamInfo;
  Storage: string | DiskInfo | DiskInfo[];
  AuditTime?: string;
  [key: string]: unknown;
};

function formatAuditValue(key: string, value: unknown) {
  if (value == null || value === '') {
    return 'Not available';
  }

  if (key.toLowerCase() === 'ram' && typeof value === 'object') {
    const ram = value as RamInfo;

    return (
      <div>
        <div>
          <strong>Total RAM:</strong>{' '}
          {ram.total_gb != null ? `${ram.total_gb} GB` : 'Unknown'}
        </div>

        <div>
          <strong>Modules installed:</strong>{' '}
          {ram.modules_installed ?? 'Unknown'}
        </div>

        <div>
          <strong>Memory slots:</strong>{' '}
          {ram.slots_used ?? '?'} used, {ram.slots_available ?? '?'} available
          {ram.slots_total != null ? ` (${ram.slots_total} total)` : ''}
        </div>

        {ram.modules?.map((module, index) => (
          <div
            key={`${module.locator ?? module.name ?? 'ram'}-${index}`}
            style={{
              marginTop: 10,
              padding: 10,
              background: '#f3f4f6',
              borderRadius: 6,
            }}
          >
            <strong>{module.name ?? `Memory module ${index + 1}`}</strong>

            <div>
              Capacity:{' '}
              {module.capacity_gb != null
                ? `${module.capacity_gb} GB`
                : module.size_mb != null
                  ? `${module.size_mb} MB`
                  : 'Unknown'}
            </div>

            <div>Type: {module.type ?? 'Unknown'}</div>
            <div>Speed: {module.speed ?? 'Unknown'}</div>
            <div>Slot: {module.locator ?? 'Unknown'}</div>
          </div>
        ))}
      </div>
    );
  }

  if (
    key.toLowerCase() === 'storage' &&
    typeof value === 'object'
  ) {
    const disks: DiskInfo[] = Array.isArray(value) ? value : [value as DiskInfo];

    return (
      <div>
        {disks.map((disk, index) => (
          <div
            key={`${disk.device ?? disk.name ?? 'disk'}-${index}`}
            style={{
              marginBottom: 10,
              padding: 10,
              background: '#f3f4f6',
              borderRadius: 6,
            }}
          >
            <strong>{disk.name ?? `Disk ${index + 1}`}</strong>

            <div>
              Device: {disk.device ? `/dev/${disk.device.replace(/^\/dev\//, '')}` : 'Unknown'}
            </div>

            <div>Model: {disk.model ?? 'Unknown'}</div>

            <div>
              Capacity:{' '}
              {disk.capacity_gb != null
                ? `${disk.capacity_gb} GB`
                : 'Unknown'}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => (
      <div key={index}>{String(item)}</div>
    ));
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

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
        throw new Error(
          `Could not retrieve audit data. HTTP ${response.status}.`
        );
      }

      const data: unknown = await response.json();

      if (
        data == null ||
        typeof data !== 'object' ||
        Array.isArray(data)
      ) {
        throw new Error('The audit service returned an invalid data format.');
      }

      const raw = data as Record<string, unknown>;

      const hostname =
        raw.Host ?? raw.Hostname ?? raw.host ?? raw.hostname;

      if (typeof hostname !== 'string' || !hostname.trim()) {
        throw new Error('The audit data does not contain a hostname.');
      }

      const record = {
        ...raw,
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
        Host: audit.Host,
        Make: String(audit.Make ?? ''),
        Model: String(audit.Model ?? ''),
        Serial: String(audit.Serial ?? ''),
        OsVersion: String(audit.OsVersion ?? ''),
        Kernel: String(audit.Kernel ?? ''),
        CPU: String(audit.CPU ?? ''),
        Ram:
          typeof audit.Ram === 'string'
            ? audit.Ram
            : JSON.stringify(audit.Ram),
        Storage:
          typeof audit.Storage === 'string'
            ? audit.Storage
            : JSON.stringify(audit.Storage),
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
    <main
      style={{
        maxWidth: 800,
        margin: '40px auto',
        padding: 24,
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <h1>Computer Audit</h1>

      <p>
        Signed in as: {user?.signInDetails?.loginId ?? 'Authenticated user'}
      </p>

      <p>
        Load the computer information collected by your Ubuntu audit script.
      </p>

      <button onClick={loadAudit} disabled={busy}>
        {busy ? 'Working...' : 'Load audit from Ubuntu'}
      </button>

      {audit && (
        <section>
          <h2>Review computer information</h2>

          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginBottom: 20,
            }}
          >
            <tbody>
              {Object.entries(audit).map(([key, value]) => (
                <tr
                  key={key}
                  style={{ borderBottom: '1px solid #ddd' }}
                >
                  <th
                    style={{
                      textAlign: 'left',
                      verticalAlign: 'top',
                      padding: 10,
                      width: '30%',
                    }}
                  >
                    {key}
                  </th>

                  <td style={{ padding: 10 }}>
                    {formatAuditValue(key, value)}
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

      {message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}

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