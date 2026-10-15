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
  serial?: string;
  serial_number?: string;
  serialNumber?: string;
  SerialNumber?: string;
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
  serial?: string;
  serial_number?: string;
  serialNumber?: string;
  SerialNumber?: string;
};

type AuditRecord = {
  Host: string;
  Make: string;
  Model: string;
  ProductType: string;
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
    width: '100%',
    minHeight: '100vh',
    boxSizing: 'border-box' as const,
    background: '#f1f5f9',
    padding: '32px 20px 48px',
    color: '#1e293b',
    fontFamily: 'Arial, Helvetica, sans-serif',
    overflowWrap: 'anywhere' as const,
  },

  container: {
    width: '100%',
    maxWidth: '900px',
    margin: '0 auto',
    boxSizing: 'border-box' as const,
  },

  card: {
    width: '100%',
    boxSizing: 'border-box' as const,
    background: '#ffffff',
    border: '1px solid #dbe3ed',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 3px 12px rgba(15, 23, 42, 0.04)',
    overflow: 'visible' as const,
  },

  sectionTitle: {
    fontSize: '19px',
    lineHeight: 1.4,
    fontWeight: 700,
    margin: '0 0 20px',
    color: '#172554',
    overflowWrap: 'anywhere' as const,
  },

  tableWrapper: {
    width: '100%',
    maxWidth: '100%',
    overflowX: 'auto' as const,
    overflowY: 'visible' as const,
    WebkitOverflowScrolling: 'touch' as const,
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    tableLayout: 'fixed' as const,
    fontSize: '14px',
  },

  labelCell: {
    width: '35%',
    boxSizing: 'border-box' as const,
    padding: '13px 14px',
    textAlign: 'left' as const,
    verticalAlign: 'top' as const,
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    color: '#334155',
    fontWeight: 600,
    overflowWrap: 'anywhere' as const,
    wordBreak: 'break-word' as const,
  },

  valueCell: {
    width: '65%',
    boxSizing: 'border-box' as const,
    padding: '13px 14px',
    textAlign: 'left' as const,
    verticalAlign: 'top' as const,
    borderBottom: '1px solid #e2e8f0',
    color: '#0f172a',
    lineHeight: 1.65,
    whiteSpace: 'pre-wrap' as const,
    overflowWrap: 'anywhere' as const,
    wordBreak: 'break-word' as const,
  },

  button: {
    background: '#1d4ed8',
    color: '#ffffff',
    border: 'none',
    borderRadius: '7px',
    padding: '12px 18px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    maxWidth: '100%',
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

  subsectionTitle: {
    fontSize: '16px',
    lineHeight: 1.5,
    margin: '0 0 12px',
    color: '#334155',
    fontWeight: 700,
  },
};

function firstValue(
  source: Record<string, unknown>,
  keys: string[]
): unknown {
  for (const key of keys) {
    const value = source[key];

    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return '';
}

function asText(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatHeader(key: string): string {
  const headers: Record<string, string> = {
    Host: 'Hostname',
    Hostname: 'Hostname',
    host: 'Hostname',
    hostname: 'Hostname',

    Make: 'Manufacturer',
    make: 'Manufacturer',
    Manufacturer: 'Manufacturer',
    manufacturer: 'Manufacturer',

    Model: 'Model',
    model: 'Model',

    ProductType: 'Product Type',
    productType: 'Product Type',
    product_type: 'Product Type',
    product_type_name: 'Product Type',

    Serial: 'Serial Number',
    serial: 'Serial Number',
    SerialNumber: 'Serial Number',
    serial_number: 'Serial Number',

    OsVersion: 'Operating System',
    osVersion: 'Operating System',
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

function getRamInfo(value: unknown): RamInfo | null {
  const parsed = parseStructuredValue(value);

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed)
  ) {
    return null;
  }

  return parsed as RamInfo;
}

function getRamModules(value: unknown): RamModule[] {
  const ram = getRamInfo(value);

  if (!ram || !Array.isArray(ram.modules)) {
    return [];
  }

  return ram.modules;
}

function getDisks(value: unknown): DiskInfo[] {
  const parsed = parseStructuredValue(value);

  if (Array.isArray(parsed)) {
    return parsed.filter(
      (item): item is DiskInfo =>
        item !== null &&
        typeof item === 'object' &&
        !Array.isArray(item)
    );
  }

  if (parsed && typeof parsed === 'object') {
    const disk = parsed as DiskInfo;

    if (
      'device' in disk ||
      'capacity_gb' in disk ||
      'model' in disk ||
      'serial_number' in disk ||
      'serialNumber' in disk
    ) {
      return [disk];
    }
  }

  return [];
}

function getSerialNumber(
  item: Record<string, unknown>
): string {
  return asText(
    firstValue(item, [
      'SerialNumber',
      'serial_number',
      'serialNumber',
      'serial',
      'Serial',
      'sn',
    ])
  );
}

function getCapacity(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return 'Not available';
  }

  return `${value} GB`;
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return 'Not available';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
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
    <div style={styles.tableWrapper}>
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
      const response = await fetch(
        'http://127.0.0.1:8765/audit'
      );

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
        throw new Error(
          'The audit service returned invalid data.'
        );
      }

      const raw = data as Record<string, unknown>;

      const hostname = asText(
        firstValue(raw, [
          'Host',
          'Hostname',
          'host',
          'hostname',
          'computer_name',
          'ComputerName',
        ])
      );

      if (!hostname.trim()) {
        throw new Error(
          'The audit data does not contain a valid hostname.'
        );
      }

      const manufacturer = asText(
        firstValue(raw, [
          'Make',
          'make',
          'Manufacturer',
          'manufacturer',
          'SystemManufacturer',
          'system_manufacturer',
          'vendor',
          'Vendor',
        ])
      );

      const productType = asText(
        firstValue(raw, [
          'ProductType',
          'productType',
          'product_type',
          'product_type_name',
          'Product Type',
          'product',
          'Product',
          'computer_type',
          'ComputerType',
        ])
      );

      const record: AuditRecord = {
        ...raw,

        Host: hostname,

        Make: manufacturer,

        Model: asText(
          firstValue(raw, [
            'Model',
            'model',
            'SystemProductName',
            'system_product_name',
          ])
        ),

        ProductType: productType,

        Serial: asText(
          firstValue(raw, [
            'Serial',
            'serial',
            'SerialNumber',
            'serial_number',
            'serialNumber',
            'system_serial',
          ])
        ),

        OsVersion: asText(
          firstValue(raw, [
            'OsVersion',
            'os_version',
            'osVersion',
            'OperatingSystem',
            'operating_system',
          ])
        ),

        Kernel: asText(
          firstValue(raw, ['Kernel', 'kernel'])
        ),

        CPU: asText(
          firstValue(raw, ['CPU', 'cpu', 'processor'])
        ),

        Ram: firstValue(raw, [
          'Ram',
          'RAM',
          'ram',
          'memory',
        ]) as string | RamInfo,

        Storage: firstValue(raw, [
          'Storage',
          'storage',
          'disks',
          'Disks',
        ]) as string | DiskInfo | DiskInfo[],
      };

      // Remove alternative names to prevent duplicate rows.
      const aliasesToRemove = [
        'hostname',
        'host',
        'Hostname',
        'computer_name',
        'ComputerName',

        'make',
        'manufacturer',
        'Manufacturer',
        'SystemManufacturer',
        'system_manufacturer',
        'vendor',
        'Vendor',

        'model',
        'SystemProductName',
        'system_product_name',

        'productType',
        'product_type',
        'product_type_name',
        'Product Type',
        'product',
        'Product',
        'computer_type',
        'ComputerType',

        'serial',
        'SerialNumber',
        'serial_number',
        'serialNumber',
        'system_serial',

        'os_version',
        'osVersion',
        'OperatingSystem',
        'operating_system',

        'kernel',
        'cpu',

        'RAM',
        'ram',
        'memory',

        'storage',
        'disks',
        'Disks',
      ];

      for (const key of aliasesToRemove) {
        delete record[key];
      }

      setAudit(record);

      setMessage(
        'Audit loaded. Review the information before submitting.'
      );
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
    if (!audit) {
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const result = await client.models.DeviceAudit.create({
        Host: audit.Host,
        Make: audit.Make,
        Model: audit.Model,
        Serial: audit.Serial,
        OsVersion: audit.OsVersion,
        Kernel: audit.Kernel,
        CPU: audit.CPU,

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
          result.errors
            ?.map((error) => error.message)
            .join('; ') || 'Unable to save the audit.'
        );
      }

      setMessage(
        'Success! The computer audit was saved to AWS.'
      );
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

  const ramModules = audit
    ? getRamModules(audit.Ram)
    : [];

  const ramInfo = audit
    ? getRamInfo(audit.Ram)
    : null;

  const disks = audit
    ? getDisks(audit.Storage)
    : [];

  const systemRows: Array<[string, unknown]> = audit
    ? [
        ['Host', audit.Host],
        ['Make', audit.Make || 'Not available'],
        ['ProductType', audit.ProductType || 'Not available'],
        ['Model', audit.Model || 'Not available'],
        ['Serial', audit.Serial || 'Not available'],
        ['OsVersion', audit.OsVersion || 'Not available'],
        ['Kernel', audit.Kernel || 'Not available'],
        ['CPU', audit.CPU || 'Not available'],
      ]
    : [];

  const knownFields = [
    'Host',
    'Make',
    'Model',
    'ProductType',
    'Serial',
    'OsVersion',
    'Kernel',
    'CPU',
    'Ram',
    'Storage',
    'AuditTime',
  ];

  const otherRows: Array<[string, unknown]> = audit
    ? Object.entries(audit).filter(
        ([key]) => !knownFields.includes(key)
      )
    : [];

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header
          style={{
            marginBottom: 28,
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(25px, 4vw, 32px)',
              lineHeight: 1.3,
              margin: '0 0 12px',
              color: '#172554',
              overflowWrap: 'anywhere',
            }}
          >
            Computer Audit
          </h1>

          <p
            style={{
              margin: 0,
              color: '#64748b',
              fontSize: 14,
            }}
          >
            Signed in as:{' '}
            {user?.signInDetails?.loginId ??
              'Authenticated user'}
          </p>
        </header>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>
            Audit Collection
          </h2>

          <p
            style={{
              lineHeight: 1.7,
              marginTop: 0,
              marginBottom: 20,
              color: '#475569',
            }}
          >
            Collect and review your computer's system
            information, memory configuration, and storage
            devices before submitting the report to AWS.
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
            {busy
              ? 'Working...'
              : 'Load Audit from Ubuntu'}
          </button>

          {message && (
            <p
              role="status"
              aria-live="polite"
              style={{
                marginTop: 18,
                padding: 14,
                borderRadius: 7,
                background: message.startsWith('Success')
                  ? '#dcfce7'
                  : message.startsWith('Audit loaded')
                    ? '#dbeafe'
                    : '#fee2e2',
                color: '#1f2937',
                lineHeight: 1.6,
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
              <h2 style={styles.sectionTitle}>
                System Information
              </h2>

              <AuditTable rows={systemRows} />
            </section>

            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>
                Memory Configuration
              </h2>

              {ramModules.length > 0 ? (
                <>
                  {ramModules.map((module, index) => {
                    const ramSerial = getSerialNumber(
                      module as Record<string, unknown>
                    );

                    return (
                      <div
                        key={`ram-${index}`}
                        style={{
                          marginBottom:
                            index < ramModules.length - 1
                              ? 28
                              : 0,
                        }}
                      >
                        <h3 style={styles.subsectionTitle}>
                          RAM {index + 1}
                        </h3>

                        <AuditTable
                          rows={[
                            [
                              'Capacity',
                              module.capacity_gb != null
                                ? getCapacity(module.capacity_gb)
                                : module.size_mb != null
                                  ? `${module.size_mb} MB`
                                  : 'Not available',
                            ],
                            [
                              'Type',
                              module.type || 'Not available',
                            ],
                            [
                              'Speed',
                              module.speed || 'Not available',
                            ],
                            [
                              'Slot',
                              module.locator || 'Not available',
                            ],
                            [
                              'Serial Number',
                              ramSerial || 'Not available',
                            ],
                          ]}
                        />
                      </div>
                    );
                  })}

                  {ramInfo && (
                    <p
                      style={{
                        color: '#64748b',
                        fontSize: 13,
                        lineHeight: 1.7,
                        marginTop: 20,
                        marginBottom: 0,
                      }}
                    >
                      {ramInfo.slots_used ??
                        ramModules.length}{' '}
                      slot(s) used
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
              <h2 style={styles.sectionTitle}>
                Storage Devices
              </h2>

              {disks.length > 0 ? (
                disks.map((disk, index) => {
                  const diskSerial = getSerialNumber(
                    disk as Record<string, unknown>
                  );

                  return (
                    <div
                      key={`disk-${index}`}
                      style={{
                        marginBottom:
                          index < disks.length - 1
                            ? 28
                            : 0,
                      }}
                    >
                      <h3 style={styles.subsectionTitle}>
                        {disk.name || `Disk ${index + 1}`}
                      </h3>

                      <AuditTable
                        rows={[
                          [
                            'Device',
                            disk.device
                              ? `/dev/${disk.device.replace(
                                  /^\/dev\//,
                                  ''
                                )}`
                              : 'Not available',
                          ],
                          [
                            'Model',
                            disk.model || 'Not available',
                          ],
                          [
                            'Capacity',
                            disk.capacity_gb != null
                              ? getCapacity(disk.capacity_gb)
                              : 'Not available',
                          ],
                          [
                            'Serial Number',
                            diskSerial || 'Not available',
                          ],
                        ]}
                      />
                    </div>
                  );
                })
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
                <h2 style={styles.sectionTitle}>
                  Additional Information
                </h2>

                <AuditTable rows={otherRows} />
              </section>
            )}

            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>
                Submit Audit
              </h2>

              <p
                style={{
                  lineHeight: 1.7,
                  color: '#475569',
                }}
              >
                Submit the collected computer information
                to AWS.
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
                {busy
                  ? 'Submitting...'
                  : 'Submit to AWS'}
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
            padding: '4px 0 20px',
          }}
        >
          <span
            style={{
              fontSize: 13,
              color: '#64748b',
            }}
          >
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
        <AuditPage
          signOut={signOut ?? undefined}
          user={user}
        />
      )}
    </Authenticator>
  );
}
