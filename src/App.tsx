import { useEffect, useState } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import '@aws-amplify/ui-react/styles.css';

const client = generateClient<Schema>();

type HardwareItem = {
  [key: string]: unknown;
  name?: string;
  manufacturer?: string;
  model?: string;
  serial?: string;
  part_number?: string;
  capacity_gb?: number;
  size_mb?: number;
  device?: string;
  locator?: string;
  type?: string;
  speed?: string;
  architecture?: string;
  cores?: string | number;
  threads_per_core?: string | number;
  current_speed?: string;
  identifier?: string;
  wwn?: string;
  hardware_id?: string;
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

  PartNumber?: string;
  HWID?: string;
  IMEI?: string;
  CPUInfo?: HardwareItem;

  [key: string]: unknown;
};

type CustomFields = {
  assetTag: string;
  assignedUser: string;
  department: string;
  location: string;
  purchaseDate: string;
  warrantyExpiry: string;
  notes: string;
};

const CUSTOM_FIELDS_KEY = 'computer-audit-custom-fields';

const emptyCustomFields: CustomFields = {
  assetTag: '',
  assignedUser: '',
  department: '',
  location: '',
  purchaseDate: '',
  warrantyExpiry: '',
  notes: '',
};


    cursor: 'pointer',
  },

  tableWrapper: {
    width: '100%',
    minWidth: 0,
    overflowX: 'auto' as const,
    overflowY: 'visible' as const,
    WebkitOverflowScrolling: 'touch' as const,
    border: '1px solid #e5eaf2',
    borderRadius: '10px',
  },

  table: {
    width: '100%',
    borderCollapse: 'separate' as const,
    borderSpacing: 0,
    fontSize: '13px',
  },

  labelCell: {
    width: '205px',
    minWidth: '175px',
    padding: '13px 16px',
    textAlign: 'left' as const,
    verticalAlign: 'middle' as const,
    background: '#f8fafd',
    borderBottom: '1px solid #e8edf4',
    color: '#58677d',
    fontWeight: 600,
    fontSize: '12px',
    overflowWrap: 'anywhere' as const,
  },

  valueCell: {
    padding: '13px 16px',
    textAlign: 'left' as const,
    verticalAlign: 'middle' as const,
    borderBottom: '1px solid #e8edf4',
    color: '#1e293b',
    lineHeight: 1.65,
    whiteSpace: 'pre-wrap' as const,
    overflowWrap: 'anywhere' as const,
    wordBreak: 'break-word' as const,
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
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return '';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
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

  if (
    parsed &&
    typeof parsed === 'object'
  ) {
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

function displayValue(value: unknown): string {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return 'Not available';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

function getComponentValue(
  item: HardwareItem,
  keys: string[]
): string {
  return textValue(
    firstValue(
      item as Record<string, unknown>,
      keys
    )
  );
}

function getCapacity(item: HardwareItem): string {
  if (item.capacity_gb !== undefined && item.capacity_gb !== null) {
    return `${item.capacity_gb} GB`;
  }

  if (item.size_mb !== undefined && item.size_mb !== null) {
    return `${item.size_mb} MB`;
  }

  return '';
}

function getCpuFallback(cpu: string): HardwareItem {
  return {
    name: 'CPU',
    manufacturer: '',
    model: cpu,
    serial: '',
    part_number: '',
  };
}

function HardwareInventory({
  audit,
}: {
  audit: AuditRecord;
}) {
  const ramModules = getRamModules(audit.Ram);
  const disks = getDisks(audit.Storage);

  const cpu =
    audit.CPUInfo &&
    typeof audit.CPUInfo === 'object'
      ? audit.CPUInfo
      : getCpuFallback(audit.CPU);

  const components: Array<{
    title: string;
    item: HardwareItem;
    category: 'cpu' | 'ram' | 'disk';
  }> = [
    {
      title: 'CPU',
      item: cpu,
      category: 'cpu',
    },

    ...ramModules.map((item, index) => ({
      title: `RAM ${index + 1}`,
      item,
      category: 'ram' as const,
    })),

    ...disks.map((item, index) => ({
      title:
        textValue(item.name) ||
        `Disk ${index + 1}`,
      item,
      category: 'disk' as const,
    })),
  ];

  const rows: Array<{
    label: string;
    getValue: (
      item: HardwareItem,
      category: 'cpu' | 'ram' | 'disk'
    ) => string;
  }> = [
    {
      label: 'Manufacturer',
      getValue: (item) =>
        getComponentValue(item, [
          'manufacturer',
          'Manufacturer',
          'make',
          'Make',
          'vendor',
          'Vendor',
        ]),
    },
    {
      label: 'Model',
      getValue: (item) =>
        getComponentValue(item, [
          'model',
          'Model',
          'product_name',
          'product',
        ]),
    },
    {
      label: 'Serial Number',
      getValue: (item) =>
        getComponentValue(item, [
          'serial',
          'serial_number',
          'serialNumber',
          'Serial',
          'SerialNumber',
        ]),
    },
    {
      label: 'Part Number',
      getValue: (item) =>
        getComponentValue(item, [
          'part_number',
          'partNumber',
          'PartNumber',
          'part',
        ]),
    },
    {
      label: 'Size',
      getValue: (item, category) =>
        category === 'ram' || category === 'disk'
          ? getCapacity(item)
          : '',
    },
    {
      label: 'Type',
      getValue: (item) =>
        getComponentValue(item, [
          'type',
          'Type',
          'architecture',
        ]),
    },
    {
      label: 'Speed',
      getValue: (item) =>
        getComponentValue(item, [
          'speed',
          'Speed',
        ]),
    },
    {
      label: 'Slot / Device',
      getValue: (item, category) => {
        if (category === 'ram') {
          return getComponentValue(item, [
            'locator',
            'slot',
            'Slot',
          ]);
        }

        if (category === 'disk') {
          return getComponentValue(item, [
            'device',
            'Device',
          ]);
        }

        return '';
      },
    },
    {
      label: 'CPU Cores',
      getValue: (item, category) =>
        category === 'cpu'
          ? getComponentValue(item, ['cores'])
          : '',
    },
    {
      label: 'Threads Per Core',
      getValue: (item, category) =>
        category === 'cpu'
          ? getComponentValue(item, [
              'threads_per_core',
            ])
          : '',
    },
    {
      label: 'Architecture',
      getValue: (item, category) =>
        category === 'cpu'
          ? getComponentValue(item, [
              'architecture',
            ])
          : '',
    },
    {
      label: 'Hardware ID / WWN',
      getValue: (item, category) =>
        category === 'disk'
          ? getComponentValue(item, [
              'hardware_id',
              'wwn',
            ])
          : '',
    },
  ];

  return (
    <section style={styles.card}>
      <h2 style={styles.sectionTitle}>
        Hardware Inventory
      </h2>

      <p
        style={{
          marginTop: 0,
          marginBottom: 18,
          color: '#64748b',
          lineHeight: 1.6,
          fontSize: 13,
        }}
      >
        Scroll horizontally to see all hardware
        components. Missing values are shown as
        Not available.
      </p>

      <div style={styles.tableWrapper}>
        <table
          style={{
            ...styles.table,
            minWidth: `${Math.max(
              1000,
              190 + components.length * 210
            )}px`,
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  ...styles.labelCell,
                  background: '#eaf0fb',
                }}
              >
                Attribute
              </th>

              {components.map((component, index) => (
                <th
                  key={`${component.title}-${index}`}
                  scope="col"
                  style={{
                    ...styles.valueCell,
                    background: '#eaf0fb',
                    fontWeight: 700,
                    color: '#172554',
                    minWidth: 190,
                  }}
                >
                  {component.title}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th
                  scope="row"
                  style={styles.labelCell}
                >
                  {row.label}
                </th>

                {components.map(
                  (component, index) => {
                    const value = row.getValue(
                      component.item,
                      component.category
                    );

                    return (
                      <td
                        key={`${row.label}-${index}`}
                        style={styles.valueCell}
                      >
                        {value || 'Not available'}
                      </td>
                    );
                  }
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {getRamInfo(audit.Ram) && (
        <p
          style={{
            margin: '16px 0 0',
            color: '#475569',
            fontSize: 13,
            lineHeight: 1.7,
          }}
        >
          Total RAM:{' '}
          {getRamInfo(audit.Ram)?.total_gb ?? 'Unknown'} GB
          {' · '}
          Modules installed:{' '}
          {getRamInfo(audit.Ram)?.modules_installed ??
            ramModules.length}
          {' · '}
          Slots used:{' '}
          {getRamInfo(audit.Ram)?.slots_used ?? 'Unknown'}
          {' · '}
          Slots available:{' '}
          {getRamInfo(audit.Ram)?.slots_available ??
            'Unknown'}
        </p>
      )}
    </section>
  );
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
          {rows.map(([key, value]) => (
            <tr key={key}>
              <th
                scope="row"
                style={styles.labelCell}
              >
                {key}
              </th>

              <td style={styles.valueCell}>
                {displayValue(value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CustomFieldsEditor({
  fields,
  onChange,
}: {
  fields: CustomFields;
  onChange: (fields: CustomFields) => void;
}) {
  function updateField(
    key: keyof CustomFields,
    value: string
  ) {
    onChange({
      ...fields,
      [key]: value,
    });
  }

  const fieldDefinitions: Array<{
    key: keyof CustomFields;
    label: string;
    type?: string;
    multiline?: boolean;
  }> = [
    { key: 'assetTag', label: 'Asset Tag' },
    { key: 'assignedUser', label: 'Assigned User' },
    { key: 'department', label: 'Department' },
    { key: 'location', label: 'Location' },
    {
      key: 'purchaseDate',
      label: 'Purchase Date',
      type: 'date',
    },
    {
      key: 'warrantyExpiry',
      label: 'Warranty Expiry',
      type: 'date',
    },
    {
      key: 'notes',
      label: 'Notes',
      multiline: true,
    },
  ];

  const inputStyle = {
    width: '100%',
    maxWidth: '100%',
    padding: '11px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: 7,
    fontSize: 14,
    fontFamily: 'inherit',
    color: '#0f172a',
    background: '#ffffff',
  };

  return (
    <section style={styles.card}>
      <h2 style={styles.sectionTitle}>
        Custom Asset Fields
      </h2>

      <p
        style={{
          color: '#64748b',
          fontSize: 13,
          lineHeight: 1.7,
          marginTop: 0,
        }}
      >
        Enter additional asset information. These
        values are saved in this browser and can be
        edited later. They are not yet submitted to AWS.
      </p>

      <div className="custom-fields-grid">
        {fieldDefinitions.map((field) => (
          <label
            key={field.key}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
              minWidth: 0,
              fontSize: 13,
              fontWeight: 600,
              color: '#475569',
            }}
          >
            {field.label}

            {field.multiline ? (
              <textarea
                value={fields[field.key]}
                onChange={(event) =>
                  updateField(
                    field.key,
                    event.target.value
                  )
                }
                rows={4}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                }}
              />
            ) : (
              <input
                type={field.type ?? 'text'}
                value={fields[field.key]}
                onChange={(event) =>
                  updateField(
                    field.key,
                    event.target.value
                  )
                }
                style={inputStyle}
              />
            )}
          </label>
        ))}
      </div>
    </section>
  );
}

function AuditPage({
  signOut,
  user,
}: {
  signOut?: () => void;
  user?: { signInDetails?: { loginId?: string } };
}) {
  const [audit, setAudit] = useState<AuditRecord | null>(
    null
  );

  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [customFields, setCustomFields] =
    useState<CustomFields>(emptyCustomFields);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(
        CUSTOM_FIELDS_KEY
      );

      if (saved) {
        const parsed = JSON.parse(saved);

        setCustomFields({
          ...emptyCustomFields,
          ...parsed,
        });
      }
    } catch {
      // Continue with empty custom fields.
    }
  }, []);

  function updateCustomFields(fields: CustomFields) {
    setCustomFields(fields);

    try {
      localStorage.setItem(
        CUSTOM_FIELDS_KEY,
        JSON.stringify(fields)
      );
    } catch {
      setMessage(
        'Custom fields were updated but could not be saved in this browser.'
      );
    }
  }

  async function loadAudit() {
    setBusy(true);
    setMessage('');
    setAudit(null);

    try {
      const response = await fetch(
        'http://127.0.0.1:8765/audit',
        { cache: 'no-store' }
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

      const ram = firstValue(raw, [
        'ram',
        'Ram',
        'RAM',
        'memory',
      ]);

      const storage = firstValue(raw, [
        'disks',
        'Storage',
        'storage',
        'Disks',
      ]);

      const cpuInfo = firstValue(raw, [
        'cpu_info',
        'CPUInfo',
        'cpuInfo',
      ]);

      const record: AuditRecord = {
        ...raw,

        Host: textValue(
          firstValue(raw, [
            'host',
            'Host',
            'hostname',
            'Hostname',
            'computer_name',
          ])
        ),

        Make: textValue(
          firstValue(raw, [
            'manufacturer',
            'Manufacturer',
            'Make',
            'make',
            'vendor',
          ])
        ),

        Model: textValue(
          firstValue(raw, [
            'model',
            'Model',
            'system_product_name',
          ])
        ),

        ProductType: textValue(
          firstValue(raw, [
            'product_type',
            'ProductType',
            'productType',
          ])
        ),

        Serial: textValue(
          firstValue(raw, [
            'serial',
            'Serial',
            'serial_number',
            'SerialNumber',
          ])
        ),

        OsVersion: textValue(
          firstValue(raw, [
            'os_version',
            'OsVersion',
            'OperatingSystem',
          ])
        ),

        Kernel: textValue(
          firstValue(raw, [
            'kernel',
            'Kernel',
          ])
        ),

        CPU: textValue(
          typeof cpuInfo === 'object' &&
            cpuInfo !== null
            ? firstValue(
                cpuInfo as Record<string, unknown>,
                ['model', 'name']
              )
            : firstValue(raw, [
                'cpu',
                'CPU',
                'processor',
              ])
        ),

        CPUInfo:
          cpuInfo &&
          typeof cpuInfo === 'object' &&
          !Array.isArray(cpuInfo)
            ? (cpuInfo as HardwareItem)
            : undefined,

        Ram: (
          ram === '' ? '' : ram
        ) as string | RamInfo,

        Storage: (
          storage === '' ? '' : storage
        ) as string | HardwareItem | HardwareItem[],

        PartNumber: textValue(
          firstValue(raw, [
            'part_number',
            'PartNumber',
            'partNumber',
          ])
        ),

        HWID: textValue(
          firstValue(raw, [
            'hwid',
            'HWID',
            'system_uuid',
            'SystemUUID',
          ])
        ),

        IMEI: textValue(
          firstValue(raw, [
            'imei',
            'IMEI',
          ])
        ),

        AuditTime: textValue(
          firstValue(raw, [
            'collected_at',
            'AuditTime',
          ])
        ),
      };

      if (!record.Host.trim()) {
        throw new Error(
          'The audit data does not contain a hostname.'
        );
      }

      // Remove raw aliases so information isn't repeated.
      const aliases = [
        'host',
        'hostname',
        'Hostname',
        'computer_name',

        'manufacturer',
        'Manufacturer',
        'make',
        'vendor',

        'model',
        'system_product_name',

        'product_type',
        'productType',

        'serial',
        'serial_number',
        'SerialNumber',

        'os_version',
        'OperatingSystem',

        'kernel',
        'cpu',
        'cpu_info',
        'cpuInfo',

        'ram',
        'RAM',
        'memory',

        'disks',
        'storage',
        'Disks',

        'part_number',
        'partNumber',

        'hwid',
        'system_uuid',

        'imei',
        'collected_at',
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
      const result =
        await client.models.DeviceAudit.create({
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

  const systemRows: Array<[string, unknown]> = audit
    ? [
        ['Hostname', audit.Host],
        ['Manufacturer', audit.Make],
        ['Product Type', audit.ProductType],
        ['Model', audit.Model],
        ['Serial Number', audit.Serial],
        ['Part Number', audit.PartNumber],
        ['HWID / System UUID', audit.HWID],
        ['IMEI', audit.IMEI],
        ['Operating System', audit.OsVersion],
        ['Kernel', audit.Kernel],
      ]
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

          .audit-section {
            margin-bottom: 22px;
          }

          .custom-fields-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 18px;
          }

          button:disabled {
            cursor: not-allowed !important;
            opacity: 0.65;
          }

          @media (max-width: 900px) {
            .custom-fields-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 600px) {
            .audit-container {
              width: 96% !important;
            }

            .custom-fields-grid {
              grid-template-columns: minmax(0, 1fr);
            }

            .audit-card {
              padding: 15px !important;
            }

            .audit-label-cell {
              min-width: 130px !important;
              width: 130px !important;
            }
          }
        `}
      </style>

      <div
        className="audit-container"
        style={styles.container}
      >
        <header
          style={{
            marginBottom: 28,
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(26px, 3vw, 36px)',
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
          className="audit-card audit-section"
          style={styles.card}
        >
          <h2 style={styles.sectionTitle}>
            Audit Collection
          </h2>

          <p
            style={{
              color: '#475569',
              lineHeight: 1.7,
              marginTop: 0,
            }}
          >
            Start your Ubuntu audit service, then load
            system and hardware information here.
          </p>

          <button
            type="button"
            style={styles.button}
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
            <section
              className="audit-card audit-section"
              style={styles.card}
            >
              <h2 style={styles.sectionTitle}>
                System Information
              </h2>

              <AuditTable rows={systemRows} />
            </section>

            <div className="audit-section">
              <HardwareInventory audit={audit} />
            </div>

            <div className="audit-section">
              <CustomFieldsEditor
                fields={customFields}
                onChange={updateCustomFields}
              />
            </div>

            <section
              className="audit-card audit-section"
              style={styles.card}
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
                Submit the collected computer
                information to AWS. The existing AWS
                schema stores the standard audit fields;
                custom fields remain in this browser.
              </p>

              <button
                type="button"
                style={styles.button}
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
            padding: '18px 0 0',
            marginTop: 18,
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