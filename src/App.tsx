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
  notes: string;
};

const CUSTOM_FIELDS_KEY = 'computer-audit-custom-fields';

const emptyCustomFields: CustomFields = {
  assetTag: '',
  notes: '',
};

const styles = {
  page: {
    minHeight: '100vh',
    width: '100%',
    boxSizing: 'border-box' as const,
    background: '#f5f7fb',
    color: '#172033',
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
    padding: '32px 0 48px',
  },

  container: {
    width: '94%',
    maxWidth: '1600px',
    margin: '0 auto',
    boxSizing: 'border-box' as const,
  },

  card: {
    minWidth: 0,
    boxSizing: 'border-box' as const,
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '26px',
    boxShadow: '0 3px 12px rgba(15, 23, 42, 0.035)',
  },

  sectionTitle: {
    fontSize: '19px',
    lineHeight: 1.4,
    fontWeight: 700,
    margin: '0 0 6px',
    color: '#172554',
  },

  sectionDescription: {
    margin: '0 0 22px',
    color: '#64748b',
    fontSize: '13px',
    lineHeight: 1.7,
  },

  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s ease',
  },

  secondaryButton: {
    background: '#ffffff',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  tableWrapper: {
    width: '100%',
    minWidth: 0,
    overflowX: 'auto' as const,
    WebkitOverflowScrolling: 'touch' as const,
    border: '1px solid #e2e8f0',
    borderRadius: '9px',
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '13px',
  },

  labelCell: {
    width: '220px',
    minWidth: '170px',
    padding: '13px 15px',
    textAlign: 'left' as const,
    verticalAlign: 'top' as const,
    background: '#f8fafc',
    borderBottom: '1px solid #e9eef5',
    color: '#475569',
    fontWeight: 600,
    overflowWrap: 'anywhere' as const,
  },

  valueCell: {
    padding: '13px 15px',
    textAlign: 'left' as const,
    verticalAlign: 'top' as const,
    borderBottom: '1px solid #e9eef5',
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
  if (
    item.capacity_gb !== undefined &&
    item.capacity_gb !== null
  ) {
    return `${item.capacity_gb} GB`;
  }

  if (
    item.size_mb !== undefined &&
    item.size_mb !== null
  ) {
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

/* -------------------------------------------------------
   Reusable vertical table for additional information
------------------------------------------------------- */

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
            <tr key={key}>
              <th
                scope="row"
                style={{
                  ...styles.labelCell,
                  borderBottom:
                    index === rows.length - 1
                      ? 'none'
                      : styles.labelCell.borderBottom,
                }}
              >
                {key}
              </th>

              <td
                style={{
                  ...styles.valueCell,
                  borderBottom:
                    index === rows.length - 1
                      ? 'none'
                      : styles.valueCell.borderBottom,
                }}
              >
                {displayValue(value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------
   System Information table

   Columns:
   Product Type | Make | Model | Part Number |
   Serial Number | CPU | Storage | RAM
------------------------------------------------------- */

function SystemInformationTable({
  audit,
}: {
  audit: AuditRecord;
}) {
  const ramInfo = getRamInfo(audit.Ram);
  const disks = getDisks(audit.Storage);

  const ramSize =
    ramInfo?.total_gb !== undefined
      ? `${ramInfo.total_gb} GB`
      : 'Not available';

  const storageSize =
    disks
      .map((disk) => {
        const name =
          textValue(disk.model) ||
          textValue(disk.name) ||
          textValue(disk.device) ||
          'Storage';

        const capacity = getCapacity(disk);

        return capacity
          ? `${name} (${capacity})`
          : name;
      })
      .join(', ') || 'Not available';

  const cpuModel =
    audit.CPUInfo &&
    typeof audit.CPUInfo === 'object'
      ? firstValue(
          audit.CPUInfo as Record<string, unknown>,
          ['model', 'name']
        )
      : audit.CPU;

  const columns: Array<{
    label: string;
    value: unknown;
  }> = [
    {
      label: 'Product Type',
      value: audit.ProductType,
    },
    {
      label: 'Make',
      value: audit.Make,
    },
    {
      label: 'Model',
      value: audit.Model,
    },
    {
      label: 'Part Number',
      value: audit.PartNumber,
    },
    {
      label: 'Serial Number',
      value: audit.Serial,
    },
    {
      label: 'CPU',
      value: cpuModel,
    },
    {
      label: 'Storage',
      value: storageSize,
    },
    {
      label: 'RAM',
      value: ramSize,
    },
  ];

  return (
    <div style={styles.tableWrapper}>
      <table
        style={{
          ...styles.table,
          minWidth: '1200px',
          tableLayout: 'fixed',
        }}
      >
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.label}
                scope="col"
                style={{
                  ...styles.valueCell,
                  background: '#f1f5f9',
                  color: '#334155',
                  fontWeight: 700,
                  whiteSpace: 'normal',
                  overflowWrap: 'anywhere',
                  borderBottom: '1px solid #dbe3ed',
                }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          <tr>
            {columns.map((column) => (
              <td
                key={column.label}
                style={{
                  ...styles.valueCell,
                  whiteSpace: 'normal',
                  overflowWrap: 'anywhere',
                  wordBreak: 'normal',
                  borderBottom: 'none',
                }}
              >
                {displayValue(column.value)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}



/* -------------------------------------------------------
   Hardware inventory

   Columns represent attributes.
   Rows represent CPU, RAM modules and storage devices.
------------------------------------------------------- */

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

    ...ramModules.map((item) => ({
      title: 'RAM',
      item,
      category: 'ram' as const,
    })),

    ...disks.map((item) => ({
      title: 'Storage',
      item,
      category: 'disk' as const,
    })),
  ];

  const columns: Array<{
    label: string;
    getValue: (
      item: HardwareItem,
      category: 'cpu' | 'ram' | 'disk'
    ) => string;
  }> = [
    {
      label: 'Component',
      getValue: (_item, category) => {
        if (category === 'cpu') {
          return 'CPU';
        }

        if (category === 'ram') {
          return 'RAM';
        }

        return 'Storage';
      },
    },

    {
      label: 'Make',
      getValue: (item, category) => {
        const make = firstValue(
          item as Record<string, unknown>,
          [
            'manufacturer',
            'Manufacturer',
            'make',
            'Make',
            'vendor',
            'Vendor',
            'manufacturer_name',
            'manufacturerName',
            'vendor_name',
            'vendorName',
          ]
        );

        if (make !== '') {
          return textValue(make);
        }

        const model = textValue(
          firstValue(
            item as Record<string, unknown>,
            [
              'model',
              'Model',
              'product_name',
              'product',
              'name',
              'model_name',
              'modelName',
              'description',
            ]
          )
        );

        if (category === 'cpu') {
          const match = model.match(
            /\b(Intel|AMD|Apple|Qualcomm|ARM)\b/i
          );

          if (match) {
            return match[1];
          }
        }

        if (category === 'ram') {
          const match = model.match(
            /\b(Samsung|SK Hynix|Micron|Kingston|Crucial|Corsair|G\.Skill|ADATA|Transcend)\b/i
          );

          if (match) {
            return match[1];
          }
        }

        return '';
      },
    },

    {
      label: 'Model',
      getValue: (item) =>
        getComponentValue(item, [
          'model',
          'Model',
          'product_name',
          'product',
          'name',
          'model_name',
          'modelName',
          'description',
        ]),
    },

    {
      label: 'Serial',
      getValue: (item) =>
        getComponentValue(item, [
          'serial',
          'serial_number',
          'serialNumber',
          'Serial',
          'SerialNumber',
          'serial_no',
          'serialNo',
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
          'memory_type',
          'memoryType',
          'form_factor',
          'formFactor',
          'interface',
        ]),
    },

    {
      label: 'Speed',
      getValue: (item, category) => {
        const speed = firstValue(
          item as Record<string, unknown>,
          [
            'speed',
            'current_speed',
            'currentSpeed',
            'max_speed',
            'maxSpeed',
            'max_clock_speed',
            'maxClockSpeed',
            'clock_speed',
            'clockSpeed',
            'Speed',
          ]
        );

        if (
          speed === '' ||
          speed === undefined ||
          speed === null
        ) {
          return '';
        }

        const speedText = textValue(speed);

        // Keep existing units, such as MHz or GHz.
        if (/[a-z]/i.test(speedText)) {
          return speedText;
        }

        // Assume a plain numeric CPU speed is MHz.
        if (category === 'cpu') {
          const numericSpeed = Number(speed);

          if (Number.isFinite(numericSpeed)) {
            return numericSpeed >= 1000
              ? `${(numericSpeed / 1000).toFixed(2)} GHz`
              : `${numericSpeed} MHz`;
          }
        }

        return speedText;
      },
    },

    {
      label: 'Slot / Device',
      getValue: (item, category) => {
        if (category === 'ram') {
          return getComponentValue(item, [
            'locator',
            'slot',
            'Slot',
            'bank_locator',
            'bankLocator',
            'device_locator',
            'deviceLocator',
          ]);
        }

        if (category === 'disk') {
          return getComponentValue(item, [
            'device',
            'Device',
            'path',
            'mount_point',
            'mountPoint',
          ]);
        }

        return '';
      },
    },

    {
      label: 'CPU Cores',
      getValue: (item, category) =>
        category === 'cpu'
          ? getComponentValue(item, [
              'cores',
              'core_count',
              'coreCount',
              'physical_cores',
              'physicalCores',
              'number_of_cores',
              'NumberOfCores',
            ])
          : '',
    },

    {
      label: 'Threads Per Core',
      getValue: (item, category) =>
        category === 'cpu'
          ? getComponentValue(item, [
              'threads_per_core',
              'threadsPerCore',
            ])
          : '',
    },
  ];

  const ramInfo = getRamInfo(audit.Ram);

  return (
    <section
      className="audit-card audit-section"
      style={styles.card}
    >
      <div className="section-heading">
        <div>
          <h2 style={styles.sectionTitle}>
            Hardware Inventory
          </h2>

          <p style={styles.sectionDescription}>
            Hardware components detected during the
            audit. Each row represents an individual
            component.
          </p>
        </div>

        <span className="component-count">
          {components.length} components
        </span>
      </div>

      <div style={styles.tableWrapper}>
        <table
          style={{
            ...styles.table,
            minWidth: '1600px',
            tableLayout: 'auto',
            whiteSpace: 'nowrap',
          }}
        >
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.label}
                  scope="col"
                  style={{
                    ...styles.valueCell,
                    background: '#f1f5f9',
                    color: '#334155',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    borderBottom: '1px solid #dbe3ed',
                  }}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {components.map((component, index) => (
              <tr
                key={`${component.title}-${index}`}
                style={{
                  background:
                    index % 2 === 0
                      ? '#ffffff'
                      : '#fafcff',
                }}
              >
                {columns.map((column) => {
                  const value = column.getValue(
                    component.item,
                    component.category
                  );

                  return (
                    <td
                      key={column.label}
                      style={{
                        ...styles.valueCell,
                        background:
                          index % 2 === 0
                            ? '#ffffff'
                            : '#fafcff',
                        fontWeight:
                          column.label === 'Component'
                            ? 600
                            : 400,
                        whiteSpace: 'nowrap',
                        overflowWrap: 'normal',
                        wordBreak: 'normal',
                      }}
                    >
                      {value || '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ramInfo && (
        <div className="ram-summary">
          <div className="ram-summary-item">
            <span>Total RAM</span>

            <strong>
              {ramInfo.total_gb !== undefined
                ? `${ramInfo.total_gb} GB`
                : 'Not available'}
            </strong>
          </div>

          <div className="ram-summary-item">
            <span>Modules Installed</span>

            <strong>
              {ramInfo.modules_installed ??
                ramModules.length}
            </strong>
          </div>

          <div className="ram-summary-item">
            <span>Slots Used</span>

            <strong>
              {ramInfo.slots_used ?? 'Not available'}
            </strong>
          </div>

          <div className="ram-summary-item">
            <span>Slots Available</span>

            <strong>
              {ramInfo.slots_available ??
                'Not available'}
            </strong>
          </div>
        </div>
      )}

      {components.length === 0 && (
        <p style={{ color: '#64748b', fontSize: 13 }}>
          No hardware components were returned by the
          audit service.
        </p>
      )}
    </section>
  );
}

/* -------------------------------------------------------
   Custom asset fields

   Only Asset Tag and Notes are retained.
------------------------------------------------------- */

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

  const inputStyle = {
    width: '100%',
    maxWidth: '100%',
    padding: '12px 13px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    color: '#0f172a',
    background: '#ffffff',
    outlineColor: '#2563eb',
  };

  return (
    <section
      className="audit-card audit-section"
      style={styles.card}
    >
      <h2 style={styles.sectionTitle}>
        Additional Asset Fields
      </h2>

      <p style={styles.sectionDescription}>
        Add an internal asset reference and any notes
        associated with this computer.
      </p>

      <div className="custom-fields-grid">
        <label className="field-label">
          Asset Tag

          <input
            type="text"
            value={fields.assetTag}
            onChange={(event) =>
              updateField(
                'assetTag',
                event.target.value
              )
            }
            placeholder="e.g. IT-000123"
            style={inputStyle}
          />
        </label>

        <label className="field-label notes-field">
          Notes

          <textarea
            value={fields.notes}
            onChange={(event) =>
              updateField('notes', event.target.value)
            }
            rows={3}
            placeholder="Enter any additional notes..."
            style={{
              ...inputStyle,
              resize: 'vertical',
            }}
          />
        </label>
      </div>

      <p className="helper-text">
        These fields are saved in this browser only.
        They are not submitted to AWS by the current
        audit submission function.
      </p>
    </section>
  );
}

/* -------------------------------------------------------
   Main audit page
------------------------------------------------------- */

function AuditPage({
  signOut,
  user,
}: {
  signOut?: () => void;
  user?: { signInDetails?: { loginId?: string } };
}) {
  const [audit, setAudit] =
    useState<AuditRecord | null>(null);

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<
    'success' | 'info' | 'error'
  >('info');

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
      setMessageType('error');
      setMessage(
        'The fields were updated but could not be saved in this browser.'
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
        {
          cache: 'no-store',
        }
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

        AuditTime: new Date().toISOString(),
      };

      if (!record.Host.trim()) {
        throw new Error(
          'The audit data does not contain a hostname.'
        );
      }

      // Remove raw aliases to prevent duplicate
      // information in the resulting record.
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

      setMessageType('success');
      setMessage(
        'Audit collected successfully. Review the information below before submitting it to AWS.'
      );
    } catch (error) {
      setMessageType('error');

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

          AuditTime:
            audit.AuditTime ?? new Date().toISOString(),
        });

      if (result.errors?.length || !result.data) {
        throw new Error(
          result.errors
            ?.map((error) => error.message)
            .join('; ') ||
            'Unable to save the audit.'
        );
      }

      setMessageType('success');
      setMessage(
        'Success! The computer audit was saved to AWS.'
      );
    } catch (error) {
      setMessageType('error');

      setMessage(
        error instanceof Error
          ? error.message
          : 'The audit submission failed.'
      );
    } finally {
      setBusy(false);
    }
  }

  const additionalRows: Array<[string, unknown]> =
    audit
      ? [
          ['Hostname', audit.Host],
          ['HWID / System UUID', audit.HWID],
          ['IMEI', audit.IMEI],
          ['Operating System', audit.OsVersion],
          ['Kernel', audit.Kernel],
          [
            'Collected Time',
            audit.AuditTime
              ? new Date(audit.AuditTime).toLocaleString()
              : 'Not available',
          ],
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
            background: #f5f7fb;
          }

          body {
            min-height: 100%;
            height: auto;
            margin: 0;
            overflow-x: hidden;
            overflow-y: auto;
            background: #f5f7fb;
          }

          #root {
            min-height: 100vh;
            height: auto;
            overflow: visible;
          }

          *, *::before, *::after {
            box-sizing: border-box;
          }

          button:disabled {
            cursor: not-allowed !important;
            opacity: 0.6;
          }

          .audit-section {
            margin-bottom: 22px;
          }

          .section-heading {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            flex-wrap: wrap;
            gap: 12px;
          }

          .component-count {
            display: inline-flex;
            align-items: center;
            padding: 7px 11px;
            background: #eff6ff;
            color: #1d4ed8;
            border: 1px solid #dbeafe;
            border-radius: 7px;
            font-size: 12px;
            font-weight: 600;
            white-space: nowrap;
          }

          .ram-summary {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 12px;
            margin-top: 18px;
          }

          .ram-summary-item {
            display: flex;
            flex-direction: column;
            gap: 7px;
            padding: 15px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 9px;
            min-width: 0;
          }

          .ram-summary-item span {
            font-size: 12px;
            color: #64748b;
          }

          .ram-summary-item strong {
            font-size: 17px;
            font-weight: 700;
            color: #172554;
            overflow-wrap: anywhere;
          }

          .custom-fields-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 20px;
          }

          .field-label {
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-width: 0;
            color: #475569;
            font-size: 13px;
            font-weight: 600;
          }

          .helper-text {
            margin: 16px 0 0;
            color: #94a3b8;
            font-size: 12px;
            line-height: 1.7;
          }

          .status-message {
            padding: 14px 16px;
            margin-top: 20px;
            border: 1px solid transparent;
            border-radius: 9px;
            font-size: 13px;
            line-height: 1.7;
            overflow-wrap: anywhere;
          }

          .status-success {
            background: #f0fdf4;
            border-color: #bbf7d0;
            color: #166534;
          }

          .status-info {
            background: #eff6ff;
            border-color: #bfdbfe;
            color: #1e40af;
          }

          .status-error {
            background: #fef2f2;
            border-color: #fecaca;
            color: #991b1b;
          }

          .audit-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 18px;
            padding-bottom: 25px;
            margin-bottom: 28px;
            border-bottom: 1px solid #e2e8f0;
          }

          .audit-logo {
            display: flex;
            align-items: center;
            gap: 13px;
          }

          .audit-logo-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 46px;
            height: 46px;
            flex-shrink: 0;
            background: #2563eb;
            color: #ffffff;
            border-radius: 12px;
            font-size: 23px;
            font-weight: 700;
          }

          .audit-subtitle {
            margin: 5px 0 0;
            color: #64748b;
            font-size: 13px;
            line-height: 1.6;
          }

          .audit-user {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 14px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 9px;
            color: #475569;
            font-size: 12px;
            overflow-wrap: anywhere;
          }

          .audit-user-dot {
            width: 8px;
            height: 8px;
            background: #22c55e;
            border-radius: 50%;
            flex-shrink: 0;
          }

          .audit-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 14px;
            padding-top: 20px;
            margin-top: 30px;
            border-top: 1px solid #e2e8f0;
            color: #94a3b8;
            font-size: 12px;
          }

          @media (max-width: 900px) {
            .ram-summary {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 600px) {
            .audit-container {
              width: 94% !important;
            }

            .audit-card {
              padding: 17px !important;
            }

            .custom-fields-grid {
              grid-template-columns: minmax(0, 1fr);
            }

            .ram-summary {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .audit-header {
              align-items: flex-start;
            }

            .audit-user {
              max-width: 100%;
            }
          }
        `}
      </style>

      <div
        className="audit-container"
        style={styles.container}
      >
        {/* Header */}

        <header className="audit-header">
          <div className="audit-logo">
            <div
              className="audit-logo-icon"
              aria-hidden="true"
            >
              ◈
            </div>

            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 'clamp(24px, 3vw, 30px)',
                  lineHeight: 1.3,
                  fontWeight: 750,
                  letterSpacing: '-0.7px',
                  color: '#172554',
                }}
              >
                Computer Audit
              </h1>

              <p className="audit-subtitle">
                Hardware inventory and asset management
              </p>
            </div>
          </div>

          <div className="audit-user">
            <span className="audit-user-dot" />

            <span>
              Signed in as{' '}
              <strong>
                {user?.signInDetails?.loginId ??
                  'Authenticated user'}
              </strong>
            </span>
          </div>
        </header>

        {/* Audit Collection */}

        <section
          className="audit-card audit-section"
          style={styles.card}
        >
          <h2 style={styles.sectionTitle}>
            Audit Collection
          </h2>

          <p style={styles.sectionDescription}>
            Connect to the Ubuntu audit service to retrieve
            the computer's system and hardware information.
          </p>

          <button
            type="button"
            style={styles.button}
            onClick={loadAudit}
            disabled={busy}
          >
            {busy
              ? 'Please wait...'
              : audit
                ? 'Refresh Audit'
                : 'Audit this device'}
          </button>

          {message && (
            <div
              role="status"
              aria-live="polite"
              className={`status-message status-${messageType}`}
            >
              {message}
            </div>
          )}
        </section>

        {/* Results */}

        {audit && (
          <>
            {/* System Information */}

            <section
              className="audit-card audit-section"
              style={styles.card}
            >
              <h2 style={styles.sectionTitle}>
                System Information
              </h2>

              <p style={styles.sectionDescription}>
                Primary identification details for this
                computer.
              </p>

              {/* Four columns and one data row */}
              <SystemInformationTable audit={audit} />
            </section>

            {/* Hardware Inventory */}

            <HardwareInventory audit={audit} />

            {/* Additional Details */}

            <section
              className="audit-card audit-section"
              style={styles.card}
            >
              <h2 style={styles.sectionTitle}>
                Additional Details
              </h2>

              <p style={styles.sectionDescription}>
                System identifiers, operating system
                information, and the date and time this
                audit was collected.
              </p>

              <AuditTable rows={additionalRows} />
            </section>

            {/* Custom Asset Fields */}

            <CustomFieldsEditor
              fields={customFields}
              onChange={updateCustomFields}
            />

            {/* Submit */}

            <section
              className="audit-card audit-section"
              style={styles.card}
            >
              <h2 style={styles.sectionTitle}>
                Submit Audit
              </h2>

              <p style={styles.sectionDescription}>
                Save the collected computer information to
                your AWS audit database.
              </p>

              <button
                type="button"
                style={styles.button}
                onClick={submitAudit}
                disabled={busy}
              >
                {busy
                  ? 'Processing...'
                  : 'Submit Audit to AWS'}
              </button>
            </section>
          </>
        )}

        {/* Footer */}

        <footer className="audit-footer">
          <span>
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