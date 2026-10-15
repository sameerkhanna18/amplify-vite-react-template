import { useState } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import '@aws-amplify/ui-react/styles.css';

const client = generateClient<Schema>();

type HardwareItem = {
  [key: string]: unknown;
  name?: string;
  manufacturer?: string;
  make?: string;
  model?: string;
  serial?: string;
  serial_number?: string;
  part_number?: string;
  capacity_gb?: number;
  device?: string;
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
  modules?: HardwareItem[];
  [key: string]: unknown;
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
  Storage: string | HardwareItem | HardwareItem[];
  AuditTime?: string;
  [key: string]: unknown;
};

const styles = {
  page: {
    width: '100%',
    minHeight: '100vh',
    boxSizing: 'border-box' as const,
    background: '#f1f5f9',
    color: '#1e293b',
    fontFamily: 'Arial, Helvetica, sans-serif',
    padding: '28px 20px 40px',
    overflowWrap: 'anywhere' as const,
  },

  container: {
    width: '100%',
    maxWidth: '1440px',
    margin: '0 auto',
    boxSizing: 'border-box' as const,
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '20px',
    alignItems: 'start',
  },

  card: {
    minWidth: 0,
    boxSizing: 'border-box' as const,
    background: '#ffffff',
    border: '1px solid #dbe3ed',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
    overflow: 'visible' as const,
  },

  sectionTitle: {
    fontSize: '18px',
    lineHeight: 1.4,
    fontWeight: 700,
    margin: '0 0 18px',
    color: '#172554',
    overflowWrap: 'anywhere' as const,
  },

  subsectionTitle: {
    fontSize: '15px',
    lineHeight: 1.5,
    margin: '0 0 12px',
    color: '#1d4ed8',
    fontWeight: 700,
  },

  tableWrapper: {
    width: '100%',
    minWidth: 0,
    overflowX: 'auto' as const,
    overflowY: 'visible' as const,
    WebkitOverflowScrolling: 'touch' as const,
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    tableLayout: 'fixed' as const,
    fontSize: '13px',
  },

  labelCell: {
    width: '42%',
    boxSizing: 'border-box' as const,
    padding: '10px 8px',
    textAlign: 'left' as const,
    verticalAlign: 'top' as const,
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    color: '#475569',
    fontWeight: 600,
    overflowWrap: 'anywhere' as const,
    wordBreak: 'break-word' as const,
  },

  valueCell: {
    width: '58%',
    boxSizing: 'border-box' as const,
    padding: '10px 8px',
    textAlign: 'left' as const,
    verticalAlign: 'top' as const,
    borderBottom: '1px solid #e2e8f0',
    color: '#0f172a',
    lineHeight: 1.6,
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
};

function firstValue(
  source: Record<string, unknown>,
  keys: string[]
): unknown {
  for (const key of keys) {
    const value = source[key];

    if (
      value !== undefined &&
      value !== null &&
      value !== ''
    ) {
      return value;
    }
  }

  return '';
}

function textValue(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '';
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

  if (
    !trimmed.startsWith('{') &&
    !trimmed.startsWith('[')
  ) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
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

    hwid: 'HWID',
    HWID: 'HWID',
    imei: 'IMEI',
    IMEI: 'IMEI',

    part_number: 'Part Number',
    PartNumber: 'Part Number',
    partNumber: 'Part Number',

    capacity_gb: 'Capacity',
    locator: 'Slot',
  };

  if (headers[key]) {
    return headers[key];
  }

  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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

function getRamModules(value: unknown): HardwareItem[] {
  const ram = getRamInfo(value);

  return ram && Array.isArray(ram.modules)
    ? ram.modules
    : [];
}

function getDisks(value: unknown): HardwareItem[] {
  const parsed = parseStructuredValue(value);

  if (Array.isArray(parsed)) {
    return parsed.filter(
      (item): item is HardwareItem =>
        item !== null &&
        typeof item === 'object' &&
        !Array.isArray(item)
    );
  }

  if (parsed && typeof parsed === 'object') {
    const item = parsed as HardwareItem;

    if (
      'device' in item ||
      'capacity_gb' in item ||
      'model' in item
    ) {
      return [item];
    }
  }

  return [];
}

function getHardwareDetails(
  item: HardwareItem,
  category: 'ram' | 'disk'
): Array<[string, unknown]> {
  const manufacturer = firstValue(item, [
    'Manufacturer',
    'manufacturer',
    'make',
    'Make',
    'vendor',
    'Vendor',
  ]);

  const model = firstValue(item, [
    'Model',
    'model',
    'product_name',
    'product',
    'Product',
  ]);

  const serial = firstValue(item, [
    'SerialNumber',
    'serial_number',
    'serialNumber',
    'serial',
    'Serial',
    'sn',
  ]);

  const partNumber = firstValue(item, [
    'PartNumber',
    'part_number',
    'partNumber',
    'part',
    'Part',
    'pn',
  ]);

  const hwid = firstValue(item, [
    'HWID',
    'hwid',
    'hardware_id',
    'hardwareId',
    'HardwareId',
    'hardware_uuid',
    'uuid',
  ]);

  const imei = firstValue(item, [
    'IMEI',
    'imei',
    'imei_number',
    'imeiNumber',
  ]);

  const rows: Array<[string, unknown]> = [
    ['Manufacturer', manufacturer],
    ['Model', model],
    ['Serial Number', serial],
    ['Part Number', partNumber],
  ];

  if (category === 'ram') {
    rows.push(
      [
        'Capacity',
        item.capacity_gb != null
          ? `${item.capacity_gb} GB`
          : item.size_mb != null
            ? `${item.size_mb} MB`
            : '',
      ],
      ['Type', item.type ?? item.Type ?? ''],
      ['Speed', item.speed ?? item.Speed ?? ''],
      [
        'Slot',
        item.locator ??
          item.slot ??
          item.Slot ??
          '',
      ]
    );
  } else {
    const device = firstValue(item, [
      'device',
      'Device',
      'name',
      'Name',
    ]);

    rows.push(
      [
        'Capacity',
        item.capacity_gb != null
          ? `${item.capacity_gb} GB`
          : item.size_mb != null
            ? `${item.size_mb} MB`
            : '',
      ],
      [
        'Device',
        textValue(device).startsWith('/dev/')
          ? device
          : device
            ? `/dev/${textValue(device)}`
            : '',
      ],
      ['HWID', hwid],
      ['IMEI', imei]
    );
  }

  return rows;
}

function AuditTable({
  rows,
}: {
  rows: Array<[string, unknown]>;
}) {
  return (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <tbody>
          {rows.map(([key, value], index) => (
            <tr key={`${key}-${index}`}>
              <th scope="row" style={styles.labelCell}>
                {key}
              </th>

              <td style={styles.valueCell}>
                {value === undefined ||
                value === null ||
                value === ''
                  ? 'Not available'
                  : typeof value === 'object'
                    ? JSON.stringify(value, null, 2)
                    : String(value)}
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

      const record: AuditRecord = {
        ...raw,

        Host: textValue(
          firstValue(raw, [
            'Host',
            'Hostname',
            'host',
            'hostname',
            'computer_name',
            'ComputerName',
          ])
        ),

        Make: textValue(
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
        ),

        Model: textValue(
          firstValue(raw, [
            'Model',
            'model',
            'SystemProductName',
            'system_product_name',
          ])
        ),

        ProductType: textValue(
          firstValue(raw, [
            'ProductType',
            'productType',
            'product_type',
            'product_type_name',
            'Product Type',
            'computer_type',
            'ComputerType',
          ])
        ),

        Serial: textValue(
          firstValue(raw, [
            'Serial',
            'serial',
            'SerialNumber',
            'serial_number',
            'serialNumber',
            'system_serial',
          ])
        ),

        OsVersion: textValue(
          firstValue(raw, [
            'OsVersion',
            'os_version',
            'osVersion',
            'OperatingSystem',
            'operating_system',
          ])
        ),

        Kernel: textValue(
          firstValue(raw, ['Kernel', 'kernel'])
        ),

        CPU: textValue(
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
        ]) as string | HardwareItem | HardwareItem[],
      };

      if (!record.Host.trim()) {
        throw new Error(
          'The audit data does not contain a hostname.'
        );
      }

      // Remove duplicate aliases from the additional fields.
      const aliases = [
        'host',
        'hostname',
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

      for (const key of aliases) {
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
    if (!audit) return;

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
            .join('; ') ||
            'Unable to save the audit.'
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
        ['Hostname', audit.Host],
        ['Manufacturer', audit.Make],
        ['Product Type', audit.ProductType],
        ['Model', audit.Model],
        ['Serial Number', audit.Serial],
        ['Operating System', audit.OsVersion],
        ['Kernel', audit.Kernel],
        ['CPU', audit.CPU],
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
      <style>
        {`
          html {
            min-height: 100%;
            height: auto;
            overflow-y: auto;
          }

          body {
            min-height: 100%;
            height: auto;
            margin: 0;
            overflow-x: hidden;
            overflow-y: auto;
            background: #f1f5f9;
          }

          #root {
            min-height: 100vh;
            height: auto;
            overflow: visible;
          }

          *, *::before, *::after {
            box-sizing: border-box;
          }

          .audit-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 20px;
            align-items: start;
          }

          .audit-span-all {
            grid-column: 1 / -1;
          }

          .audit-hardware-card {
            min-width: 0;
          }

          .audit-hardware-card + .audit-hardware-card {
            margin-top: 20px;
          }

          @media (max-width: 1000px) {
            .audit-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 640px) {
            .audit-grid {
              grid-template-columns: minmax(0, 1fr);
            }

            .audit-span-all {
              grid-column: auto;
            }

            .audit-card {
              padding: 16px !important;
            }

            .audit-label-cell,
            .audit-value-cell {
              padding: 9px 7px !important;
              font-size: 12px !important;
            }
          }

          button:disabled {
            cursor: not-allowed !important;
          }
        `}
      </style>

      <div style={styles.container}>
        <header
          style={{
            marginBottom: 28,
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(25px, 4vw, 34px)',
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

        <section
          className="audit-card"
          style={{
            ...styles.card,
            marginBottom: 24,
          }}
        >
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
            information, memory modules, storage devices,
            and hardware identifiers.
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
            <div className="audit-grid">
              <section
                className="audit-card audit-span-all"
                style={styles.card}
              >
                <h2 style={styles.sectionTitle}>
                  System Information
                </h2>

                <AuditTable rows={systemRows} />
              </section>

              {ramModules.length > 0 ? (
                ramModules.map((module, index) => (
                  <section
                    key={`ram-${index}`}
                    className="audit-card audit-hardware-card"
                    style={styles.card}
                  >
                    <h2 style={styles.sectionTitle}>
                      RAM {index + 1}
                    </h2>

                    <AuditTable
                      rows={getHardwareDetails(module, 'ram')}
                    />
                  </section>
                ))
              ) : (
                <section
                  className="audit-card"
                  style={styles.card}
                >
                  <h2 style={styles.sectionTitle}>
                    Memory Configuration
                  </h2>

                  <AuditTable
                    rows={[
                      [
                        'Total Capacity',
                        ramInfo?.total_gb != null
                          ? `${ramInfo.total_gb} GB`
                          : typeof audit.Ram === 'string'
                            ? audit.Ram
                            : 'Not available',
                      ],
                      [
                        'Modules Installed',
                        ramInfo?.modules_installed ?? '',
                      ],
                      ['RAM Serial Number', ''],
                    ]}
                  />
                </section>
              )}

              {disks.length > 0 ? (
                disks.map((disk, index) => (
                  <section
                    key={`disk-${index}`}
                    className="audit-card audit-hardware-card"
                    style={styles.card}
                  >
                    <h2 style={styles.sectionTitle}>
                      {textValue(disk.name) ||
                        `Disk ${index + 1}`}
                    </h2>

                    <AuditTable
                      rows={getHardwareDetails(disk, 'disk')}
                    />
                  </section>
                ))
              ) : (
                <section
                  className="audit-card"
                  style={styles.card}
                >
                  <h2 style={styles.sectionTitle}>
                    Storage Devices
                  </h2>

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
                </section>
              ))}

              {ramInfo && (
                <section
                  className="audit-card"
                  style={styles.card}
                >
                  <h2 style={styles.sectionTitle}>
                    Memory Summary
                  </h2>

                  <AuditTable
                    rows={[
                      ['Total RAM', ramInfo.total_gb != null
                        ? `${ramInfo.total_gb} GB`
                        : ''],
                      [
                        'Modules Installed',
                        ramInfo.modules_installed ?? ramModules.length,
                      ],
                      ['Slots Used', ramInfo.slots_used],
                      ['Available Slots', ramInfo.slots_available],
                      ['Total Slots', ramInfo.slots_total],
                    ]}
                  />
                </section>
              )}

              {otherRows.length > 0 && (
                <section
                  className="audit-card"
                  style={styles.card}
                >
                  <h2 style={styles.sectionTitle}>
                    Additional Information
                  </h2>

                  <AuditTable rows={otherRows} />
                </section>
              )}
            </div>

            <section
              className="audit-card"
              style={{
                ...styles.card,
                marginTop: 24,
                marginBottom: 24,
              }}
            >
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

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            padding: '12px 0 0',
            marginTop: 12,
            borderTop: '1px solid #dbe3ed',
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
        </div>
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
