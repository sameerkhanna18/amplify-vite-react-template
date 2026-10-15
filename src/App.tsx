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

const styles = {
  page: {
    minHeight: '100vh',
    boxSizing: 'border-box' as const,
    background: '#f3f6fa',
    padding: '32px 20px',
    color: '#1f2937',
    fontFamily: 'Arial, Helvetica, sans-serif',
  },
  container: {
    maxWidth: '1000px',
    width: '100%',
    margin: '0 auto',
  },
  card: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
  },
  sectionTitle: {
    fontSize: '19px',
    fontWeight: 700,
    margin: '0 0 18px',
    color: '#172554',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    tableLayout: 'fixed' as const,
  },
  labelCell: {
    width: '30%',
    padding: '12px 14px',
    textAlign: 'left' as const,
    verticalAlign: 'top' as const,
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    fontWeight: 600,
    overflowWrap: 'anywhere' as const,
  },
  valueCell: {
    padding: '12px 14px',
    verticalAlign: 'top' as const,
    borderBottom: '1px solid #e2e8f0',
    overflowWrap: 'anywhere' as const,
    whiteSpace: 'pre-wrap' as const,
    lineHeight: 1.6,
  },
  button: {
    background: '#1d4ed8',
    color: '#ffffff',
    border: 'none',
    borderRadius: '7px',
    padding: '11px 18px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryButton: {
    background: '#ffffff',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '7px',
    padding: '10px 16px',
    fontSize: '14px',
    cursor: 'pointer',
  },
};

function formatHeader(key: string): string {
  const headers: Record<string, string> = {
    Host: 'Hostname',
    Hostname: 'Hostname',
    host: 'Hostname',
    hostname: 'Hostname',
    Make: 'Manufacturer',
    make: 'Manufacturer',
    Model: 'Model',
    model: 'Model',
    Serial: 'Serial Number',
    serial: 'Serial Number',
    OsVersion: 'Operating System',
    os_version: 'Operating System',
    Kernel: 'Kernel',
    kernel: 'Kernel',
    CPU: 'CPU',
    cpu: 'CPU',
    Ram: 'RAM',
    RAM: 'RAM',
    ram: 'RAM',
    Storage: 'Storage',
    storage: 'Storage',
    AuditTime: 'Audit Time',
    audit_time: 'Audit Time',
  };

  if (headers[key]) {
    return headers[key];
  }

  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value == null || value === '') {
    return 'Not available';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function parseStructuredValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function getRamModules(value: unknown): RamModule[] {
  const parsed = parseStructuredValue(value);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return [];
  }

  const ram = parsed as RamInfo;

  return Array.isArray(ram.modules) ? ram.modules : [];
}

function getRamInfo(value: unknown): RamInfo | null {
  const parsed = parseStructuredValue(value);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  return parsed as RamInfo;
}

function getDisks(value: unknown): DiskInfo[] {
  const parsed = parseStructuredValue(value);

  if (Array.isArray(parsed)) {
    return parsed.filter(
      (item): item is DiskInfo =>
        item !== null && typeof item === 'object'
    );
  }

  if (parsed && typeof parsed === 'object') {
    const disk = parsed as DiskInfo;

    if (
      'device' in disk ||
      'capacity_gb' in disk ||
      'model' in disk
    ) {
      return [disk];
    }
  }

  return [];
}

function AuditTable({
  rows,
}: {
  rows: Array<[string, unknown]>;
}) {
  if (rows.length === 0) {
    return <p>No information available.</p>;
  }

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <table style={styles.table}>
        <tbody>
          {rows.map(([key, value], index) => (
            <tr key={`${key}-${index}`}>
              <th scope="row" style={styles.labelCell}>
                {formatHeader(key)}
              </th>

              <td style={styles.valueCell}>
                {formatValue(value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
        !data ||
        typeof data !== 'object' ||
        Array.isArray(data)
      ) {
        throw new Error('The audit service returned invalid data.');
      }

      const raw = data as Record<string, unknown>;

      const hostname =
        raw.Host ??
        raw.Hostname ??
        raw.host ??
        raw.hostname;

      if (typeof hostname !== 'string' || !hostname.trim()) {
        throw new Error(
          'The audit data does not contain a valid hostname.'
        );
      }

      const record: AuditRecord = {
        ...raw,
        Host: hostname.trim(),
        Make: String(raw.Make ?? raw.make ?? ''),
        Model: String(raw.Model ?? raw.model ?? ''),
        Serial: String(raw.Serial ?? raw.serial ?? ''),
        OsVersion: String(
          raw.OsVersion ?? raw.os_version ?? raw.osVersion ?? ''
        ),
        Kernel: String(raw.Kernel ?? raw.kernel ?? ''),
        CPU: String(raw.CPU ?? raw.cpu ?? ''),
        Ram: (
          raw.Ram ?? raw.RAM ?? raw.ram ?? ''
        ) as string | RamInfo,
        Storage: (
          raw.Storage ?? raw.storage ?? raw.disks ?? ''
        ) as string | DiskInfo | DiskInfo[],
      };

      // Remove duplicate fields and alternative spellings.
      delete record.hostname;
      delete record.host;
      delete record.Hostname;
      delete record.RAM;
      delete record.ram;
      delete record.make;
      delete record.model;
      delete record.serial;
      delete record.os_version;
      delete record.osVersion;
      delete record.kernel;
      delete record.cpu;
      delete record.storage;
      delete record.disks;

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

  const ramModules = audit ? getRamModules(audit.Ram) : [];
  const ramInfo = audit ? getRamInfo(audit.Ram) : null;
  const disks = audit ? getDisks(audit.Storage) : [];

  const systemRows: Array<[string, unknown]> = audit
    ? [
        ['Host', audit.Host],
        ['Make', audit.Make],
        ['Model', audit.Model],
        ['Serial', audit.Serial],
        ['OsVersion', audit.OsVersion],
        ['Kernel', audit.Kernel],
        ['CPU', audit.CPU],
      ]
    : [];

  const otherRows: Array<[string, unknown]> = audit
    ? Object.entries(audit).filter(
        ([key]) =>
          ![
            'Host',
            'Make',
            'Model',
            'Serial',
            'OsVersion',
            'Kernel',
            'CPU',
            'Ram',
            'Storage',
          ].includes(key)
      )
    : [];

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontSize: 30,
              margin: '0 0 10px',
              color: '#172554',
            }}
          >
            Computer Audit
          </h1>

          <p style={{ margin: 0, color: '#64748b' }}>
            Signed in as:{' '}
            {user?.signInDetails?.loginId ?? 'Authenticated user'}
          </p>
        </header>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Audit Collection</h2>

          <p style={{ lineHeight: 1.6, marginTop: 0 }}>
            Collect and review your computer's system information,
            memory configuration, and storage devices.
          </p>

          <button
            type="button"
            style={{
              ...styles.button,
              opacity: busy ? 0.65 : 1,
            }}
            onClick={loadAudit}
            disabled={busy}
          >
            {busy ? 'Working...' : 'Load Audit from Ubuntu'}
          </button>

          {message && (
            <p
              role="status"
              aria-live="polite"
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 6,
                background: message.startsWith('Success')
                  ? '#dcfce7'
                  : message.startsWith('Audit loaded')
                    ? '#dbeafe'
                    : '#fee2e2',
                color: '#1f2937',
                overflowWrap: 'anywhere',
              }}
            >
              {message}
            </p>
          )}
        </section>

        {audit && (
          <>
            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>System Information</h2>
              <AuditTable rows={systemRows} />
            </section>

            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Memory Configuration</h2>

              {ramModules.length > 0 ? (
                <>
                  {ramModules.map((module, index) => (
                    <div
                      key={`${module.locator ?? module.name ?? 'ram'}-${index}`}
                      style={{
                        marginBottom:
                          index < ramModules.length - 1 ? 24 : 0,
                      }}
                    >
                      <h3
                        style={{
                          fontSize: 16,
                          margin: '0 0 10px',
                          color: '#334155',
                        }}
                      >
                        {`RAM ${index + 1}`}
                      </h3>

                      <AuditTable
                        rows={[
                          [
                            'Capacity',
                            module.capacity_gb != null
                              ? `${module.capacity_gb} GB`
                              : module.size_mb != null
                                ? `${module.size_mb} MB`
                                : 'Not available',
                          ],
                          ['Type', module.type ?? 'Not available'],
                          ['Speed', module.speed ?? 'Not available'],
                          ['Slot', module.locator ?? 'Not available'],
                        ]}
                      />
                    </div>
                  ))}

                  {ramInfo && (
                    <p
                      style={{
                        color: '#64748b',
                        fontSize: 13,
                        marginBottom: 0,
                      }}
                    >
                      {ramInfo.slots_used ?? ramModules.length} slot(s) used
                      {ramInfo.slots_total != null
                        ? ` out of ${ramInfo.slots_total}`
                        : ''}
                      {ramInfo.slots_available != null
                        ? ` · ${ramInfo.slots_available} available`
                        : ''}
                    </p>
                  )}
                </>
              ) : (
                <AuditTable
                  rows={[
                    [
                      'RAM',
                      typeof audit.Ram === 'string'
                        ? audit.Ram
                        : 'Memory module details not available',
                    ],
                  ]}
                />
              )}
            </section>

            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Storage Devices</h2>

              {disks.length > 0 ? (
                disks.map((disk, index) => (
                  <div
                    key={`${disk.device ?? disk.name ?? 'disk'}-${index}`}
                    style={{
                      marginBottom: index < disks.length - 1 ? 24 : 0,
                    }}
                  >
                    <h3
                      style={{
                        fontSize: 16,
                        margin: '0 0 10px',
                        color: '#334155',
                      }}
                    >
                      {disk.name ?? `Disk ${index + 1}`}
                    </h3>

                    <AuditTable
                      rows={[
                        [
                          'Device',
                          disk.device
                            ? `/dev/${disk.device.replace(/^\/dev\//, '')}`
                            : 'Not available',
                        ],
                        ['Model', disk.model ?? 'Not available'],
                        [
                          'Capacity',
                          disk.capacity_gb != null
                            ? `${disk.capacity_gb} GB`
                            : 'Not available',
                        ],
                      ]}
                    />
                  </div>
                ))
              ) : (
                <AuditTable
                  rows={[
                    [
                      'Storage',
                      typeof audit.Storage === 'string'
                        ? audit.Storage
                        : 'Storage details not available',
                    ],
                  ]}
                />
              )}
            </section>

            {otherRows.length > 0 && (
              <section style={styles.card}>
                <h2 style={styles.sectionTitle}>Additional Information</h2>
                <AuditTable rows={otherRows} />
              </section>
            )}

            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Submit Audit</h2>

              <p style={{ lineHeight: 1.6 }}>
                Submit the collected computer information to AWS.
              </p>

              <button
                type="button"
                style={{
                  ...styles.button,
                  opacity: busy ? 0.65 : 1,
                }}
                onClick={submitAudit}
                disabled={busy}
              >
                {busy ? 'Submitting...' : 'Submit to AWS'}
              </button>
            </section>
          </>
        )}

        <footer
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            padding: '8px 0 24px',
          }}
        >
          <span style={{ fontSize: 13, color: '#64748b' }}>
            Computer Audit System
          </span>

          <button
            type="button"
            style={styles.secondaryButton}
            onClick={signOut}
          >
            Sign Out
          </button>
        </footer>
      </div>
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

