import { useEffect, useState } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import '@aws-amplify/ui-react/styles.css';

const client = generateClient<Schema>();

const AUDIT_API = 'http://127.0.0.1:8765/audit';

type DataObject = Record<string, unknown>;

type HardwareItem = {
  [key: string]: unknown;
  name?: string;
  manufacturer?: string;
  model?: string;
  serial?: string;
  part_number?: string;
  capacity_gb?: number;
  size_mb?: number;
  speed?: string | number;
  type?: string;
  locator?: string;
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
  PartNumber: string;
  HWID: string;
  IMEI: string;
  OsVersion: string;
  Kernel: string;
  CPU: string;
  CPUInfo: HardwareItem;
  Ram: string | RamInfo;
  Storage: string | HardwareItem | HardwareItem[];
  AuditTime: string;
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
    background: '#f4f7fb',
    color: '#172033',
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
    padding: '20px 0 40px',
    overflowX: 'hidden' as const,
  },

  container: {
    width: 'min(98%, 1800px)',
    margin: '0 auto',
    boxSizing: 'border-box' as const,
  },

  card: {
    minWidth: 0,
    boxSizing: 'border-box' as const,
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: 'clamp(14px, 2vw, 24px)',
    boxShadow: '0 3px 12px rgba(15, 23, 42, 0.035)',
    marginBottom: '18px',
  },

  sectionTitle: {
    fontSize: 'clamp(17px, 2vw, 20px)',
    lineHeight: 1.4,
    fontWeight: 700,
    margin: '0 0 6px',
    color: '#172554',
  },

  description: {
    margin: '0 0 18px',
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
    padding: '11px 17px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  secondaryButton: {
    background: '#ffffff',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '10px 15px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  tableWrapper: {
    width: '100%',
    minWidth: 0,
    overflowX: 'auto' as const,
    overflowY: 'visible' as const,
    WebkitOverflowScrolling: 'touch' as const,
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '13px',
  },

  labelCell: {
    width: '220px',
    minWidth: '145px',
    padding: '10px 12px',
    textAlign: 'left' as const,
    verticalAlign: 'top' as const,
    background: '#f8fafc',
    borderBottom: '1px solid #e9eef5',
    color: '#475569',
    fontWeight: 600,
    overflowWrap: 'anywhere' as const,
  },

  valueCell: {
    padding: '10px 12px',
    textAlign: 'left' as const,
    verticalAlign: 'top' as const,
    borderBottom: '1px solid #e9eef5',
    color: '#1e293b',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap' as const,
    overflowWrap: 'anywhere' as const,
    wordBreak: 'break-word' as const,
  },
};

/* ======================================================
   GENERAL DATA HELPERS
====================================================== */

function isObject(value: unknown): value is DataObject {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

function firstValue(
  source: DataObject,
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

function displayValue(value: unknown): string {
  const result = textValue(value);

  return result || 'Not available';
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

  if (!isObject(parsed)) {
    return null;
  }

  return parsed as RamInfo;
}

function getRamModules(value: unknown): HardwareItem[] {
  const ram = getRamInfo(value);

  if (!ram || !Array.isArray(ram.modules)) {
    return [];
  }

  return ram.modules.filter(
    (item): item is HardwareItem => isObject(item)
  );
}

function getDisks(value: unknown): HardwareItem[] {
  const parsed = parseStructuredValue(value);

  if (Array.isArray(parsed)) {
    return parsed.filter(
      (item): item is HardwareItem => isObject(item)
    );
  }

  if (isObject(parsed)) {
    if (
      'device' in parsed ||
      'capacity_gb' in parsed ||
      'model' in parsed
    ) {
      return [parsed as HardwareItem];
    }
  }

  return [];
}

function getComponentValue(
  item: HardwareItem,
  keys: string[]
): string {
  return textValue(
    firstValue(item as DataObject, keys)
  );
}

function getCapacity(item: HardwareItem): string {
  const capacity = firstValue(item as DataObject, [
    'capacity_gb',
    'capacityGb',
    'size_gb',
    'sizeGb',
  ]);

  if (capacity !== '') {
    const number = Number(capacity);

    return Number.isFinite(number)
      ? `${number} GB`
      : textValue(capacity);
  }

  const sizeMb = firstValue(item as DataObject, [
    'size_mb',
    'sizeMb',
  ]);

  if (sizeMb !== '') {
    const number = Number(sizeMb);

    return Number.isFinite(number)
      ? `${(number / 1024).toFixed(2)} GB`
      : textValue(sizeMb);
  }

  const size = firstValue(item as DataObject, [
    'size',
    'capacity',
    'Size',
  ]);

  return textValue(size);
}

function getManufacturer(
  item: HardwareItem,
  category: 'cpu' | 'ram' | 'disk' | 'system'
): string {
  const manufacturer = firstValue(
    item as DataObject,
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

  if (manufacturer !== '') {
    return textValue(manufacturer);
  }

  const model = getComponentValue(item, [
    'model',
    'Model',
    'product_name',
    'product',
    'name',
    'model_name',
    'modelName',
    'description',
  ]);

  if (category === 'cpu') {
    const match = model.match(
      /\b(Intel|AMD|Apple|Qualcomm|ARM)\b/i
    );

    return match ? match[1] : '';
  }

  if (category === 'ram') {
    const match = model.match(
      /\b(Samsung|SK Hynix|Micron|Kingston|Crucial|Corsair|G\.Skill|ADATA|Transcend)\b/i
    );

    return match ? match[1] : '';
  }

  if (category === 'disk') {
    const match = model.match(
      /\b(Samsung|Western Digital|WDC|Seagate|Toshiba|Micron|Kingston|Crucial|Intel|SanDisk|SK Hynix|KIOXIA|ADATA)\b/i
    );

    return match ? match[1] : '';
  }

  return '';
}

function getModel(item: HardwareItem): string {
  return getComponentValue(item, [
    'model',
    'Model',
    'product_name',
    'product',
    'model_name',
    'modelName',
    'name',
    'description',
  ]);
}

function getPartNumber(item: HardwareItem): string {
  return getComponentValue(item, [
    'part_number',
    'partNumber',
    'PartNumber',
    'part number',
    'sku',
    'SKU',
    'system_sku',
    'system_sku_number',
    'product_number',
    'productNumber',
  ]);
}

function getSerial(item: HardwareItem): string {
  return getComponentValue(item, [
    'serial',
    'Serial',
    'serial_number',
    'serialNumber',
    'SerialNumber',
    'serial_no',
    'serialNo',
  ]);
}

function getSpeed(item: HardwareItem): string {
  const value = firstValue(item as DataObject, [
    'speed',
    'current_speed',
    'currentSpeed',
    'configured_speed',
    'configuredSpeed',
    'configured_memory_speed',
    'configuredMemorySpeed',
    'max_speed',
    'maxSpeed',
    'max_mhz',
    'cpu_mhz',
    'clock_speed',
    'clockSpeed',
  ]);

  if (value === '') {
    return '';
  }

  const speed = Number(value);

  if (
    typeof value === 'number' ||
    (typeof value === 'string' && value.trim() !== '' &&
      Number.isFinite(speed))
  ) {
    if (speed >= 1000) {
      return `${(speed / 1000).toFixed(2)} GHz`;
    }

    return `${speed} MHz`;
  }

  return textValue(value);
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

/* ======================================================
   REUSABLE TABLE
====================================================== */

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
                      : '1px solid #e9eef5',
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
                      : '1px solid #e9eef5',
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

/* ======================================================
   SYSTEM INFORMATION
====================================================== */

function SystemInformation({
  audit,
}: {
  audit: AuditRecord;
}) {
  const ram = getRamInfo(audit.Ram);
  const disks = getDisks(audit.Storage);

  const cpuModel = getComponentValue(
    audit.CPUInfo,
    ['model', 'name']
  ) || audit.CPU;

  const storageSummary = disks
    .map((disk) => {
      const name =
        getModel(disk) ||
        textValue(disk.name) ||
        textValue(disk.device) ||
        'Storage device';

      const capacity = getCapacity(disk);

      return capacity
        ? `${name} (${capacity})`
        : name;
    })
    .join(', ');

  const rows: Array<[string, unknown]> = [
    ['Hostname', audit.Host],
    ['Product Type', audit.ProductType],
    ['Manufacturer', audit.Make],
    ['Model', audit.Model],
    ['Part Number', audit.PartNumber],
    ['Serial Number', audit.Serial],
    ['CPU', cpuModel],
    [
      'RAM',
      ram?.total_gb !== undefined
        ? `${ram.total_gb} GB`
        : '',
    ],
    ['Storage', storageSummary],
    ['Operating System', audit.OsVersion],
  ];

  return (
    <section style={styles.card}>
      <h2 style={styles.sectionTitle}>
        System Information
      </h2>

      <p style={styles.description}>
        Computer identification, processor, memory,
        storage, and operating system.
      </p>

      <AuditTable rows={rows} />
    </section>
  );
}

/* ======================================================
   HARDWARE INVENTORY
====================================================== */

function HardwareInventory({
  audit,
}: {
  audit: AuditRecord;
}) {
  const ramInfo = getRamInfo(audit.Ram);
  const ramModules = getRamModules(audit.Ram);
  const disks = getDisks(audit.Storage);

  const cpu = audit.CPUInfo &&
    Object.keys(audit.CPUInfo).length > 0
      ? audit.CPUInfo
      : getCpuFallback(audit.CPU);

  const components: Array<{
    category: 'CPU' | 'RAM' | 'Storage';
    item: HardwareItem;
    id: string;
  }> = [
    {
      category: 'CPU',
      item: cpu,
      id: 'cpu',
    },

    ...ramModules.map((item, index) => ({
      category: 'RAM' as const,
      item,
      id: `ram-${index}`,
    })),

    ...disks.map((item, index) => ({
      category: 'Storage' as const,
      item,
      id: `disk-${index}`,
    })),
  ];

  const columns = [
    'Component',
    'Manufacturer',
    'Model',
    'Part Number',
    'Serial Number',
    'Capacity',
    'Type',
    'Speed',
    'Form Factor',
    'Slot / Device',
    'Cores',
    'Threads',
    'Hardware ID',
  ];

  function valueFor(
    item: HardwareItem,
    category: 'CPU' | 'RAM' | 'Storage',
    column: string
  ): string {
    switch (column) {
      case 'Component':
        return category;

      case 'Manufacturer':
        return getManufacturer(
          item,
          category === 'CPU'
            ? 'cpu'
            : category === 'RAM'
              ? 'ram'
              : 'disk'
        );

      case 'Model':
        return getModel(item);

      case 'Part Number':
        return getPartNumber(item);

      case 'Serial Number':
        return getSerial(item);

      case 'Capacity':
        return category === 'RAM' ||
          category === 'Storage'
          ? getCapacity(item)
          : '';

      case 'Type':
        return getComponentValue(item, [
          'type',
          'Type',
          'architecture',
          'form_factor',
          'formFactor',
          'interface',
          'memory_type',
          'memoryType',
        ]);

      case 'Speed':
        return getSpeed(item);

      case 'Form Factor':
        return category === 'RAM'
          ? getComponentValue(item, [
              'form_factor',
              'formFactor',
              'FormFactor',
            ])
          : '';

      case 'Slot / Device':
        return category === 'RAM'
          ? getComponentValue(item, [
              'locator',
              'device_locator',
              'deviceLocator',
              'bank_locator',
              'bankLocator',
              'slot',
            ])
          : category === 'Storage'
            ? getComponentValue(item, [
                'device',
                'path',
                'name',
              ])
            : '';

      case 'Cores':
        return category === 'CPU'
          ? getComponentValue(item, [
              'cores',
              'core_count',
              'coreCount',
              'physical_cores',
              'physicalCores',
              'number_of_cores',
              'NumberOfCores',
            ])
          : '';

      case 'Threads':
        return category === 'CPU'
          ? getComponentValue(item, [
              'threads_per_core',
              'threadsPerCore',
              'logical_processors',
              'logicalProcessors',
            ])
          : '';

      case 'Hardware ID':
        return getComponentValue(item, [
          'hardware_id',
          'hardwareId',
          'wwn',
          'WWN',
          'identifier',
          'device_id',
          'deviceId',
        ]);

      default:
        return '';
    }
  }

  return (
    <section style={styles.card}>
      <div className="section-heading">
        <div>
          <h2 style={styles.sectionTitle}>
            Hardware Inventory
          </h2>

          <p style={styles.description}>
            Individual processor, memory module, and
            internal storage information.
          </p>
        </div>

        <span className="component-count">
          {components.length} components
        </span>
      </div>

      <div style={styles.tableWrapper}>
        <table
          className="hardware-table"
          style={{
            ...styles.table,
            minWidth: '1250px',
          }}
        >
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  style={{
                    ...styles.valueCell,
                    background: '#f1f5f9',
                    color: '#334155',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    borderBottom:
                      '1px solid #dbe3ed',
                  }}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {components.map((component, index) => (
              <tr
                key={component.id}
                style={{
                  background:
                    index % 2 === 0
                      ? '#ffffff'
                      : '#f8fafc',
                }}
              >
                {columns.map((column) => (
                  <td
                    key={column}
                    style={{
                      ...styles.valueCell,
                      background:
                        index % 2 === 0
                          ? '#ffffff'
                          : '#f8fafc',
                      whiteSpace: 'normal',
                      minWidth: '100px',
                    }}
                  >
                    {valueFor(
                      component.item,
                      component.category,
                      column
                    ) || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ramInfo && (
        <div className="ram-summary">
          <SummaryItem
            label="Total RAM"
            value={
              ramInfo.total_gb !== undefined
                ? `${ramInfo.total_gb} GB`
                : 'Not available'
            }
          />

          <SummaryItem
            label="Modules Installed"
            value={
              ramInfo.modules_installed ??
              ramModules.length
            }
          />

          <SummaryItem
            label="Slots Used"
            value={ramInfo.slots_used ?? 'Not available'}
          />

          <SummaryItem
            label="Slots Available"
            value={
              ramInfo.slots_available ??
              'Not available'
            }
          />

          <SummaryItem
            label="Total Slots"
            value={ramInfo.slots_total ?? 'Not available'}
          />
        </div>
      )}

      {components.length === 0 && (
        <p>
          No hardware components were returned by the
          audit service.
        </p>
      )}
    </section>
  );
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <div className="summary-item">
      <span>{label}</span>
      <strong>{displayValue(value)}</strong>
    </div>
  );
}

/* ======================================================
   ADDITIONAL DETAILS
====================================================== */

function AdditionalDetails({
  audit,
}: {
  audit: AuditRecord;
}) {
  const rows: Array<[string, unknown]> = [
    ['HWID / System UUID', audit.HWID],
    ['IMEI', audit.IMEI],
    ['Operating System', audit.OsVersion],
    ['Kernel', audit.Kernel],
    [
      'Audit Collected',
      audit.AuditTime
        ? new Date(audit.AuditTime).toLocaleString()
        : '',
    ],
  ];

  return (
    <section style={styles.card}>
      <h2 style={styles.sectionTitle}>
        Additional Details
      </h2>

      <p style={styles.description}>
        System identifiers and collection timestamp.
      </p>

      <AuditTable rows={rows} />
    </section>
  );
}

/* ======================================================
   CUSTOM ASSET FIELDS
====================================================== */

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
    boxSizing: 'border-box' as const,
    padding: '11px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    color: '#0f172a',
    background: '#ffffff',
  };

  return (
    <section style={styles.card}>
      <h2 style={styles.sectionTitle}>
        Additional Asset Fields
      </h2>

      <p style={styles.description}>
        Record your internal asset reference and notes.
      </p>

      <div className="custom-fields-grid">
        <label className="field-label">
          Asset Tag

          <input
            type="text"
            value={fields.assetTag}
            onChange={(event) =>
              updateField('assetTag', event.target.value)
            }
            placeholder="e.g. IT-000123"
            style={inputStyle}
          />
        </label>

        <label className="field-label">
          Notes

          <textarea
            value={fields.notes}
            onChange={(event) =>
              updateField('notes', event.target.value)
            }
            rows={3}
            placeholder="Enter additional notes..."
            style={{
              ...inputStyle,
              resize: 'vertical',
            }}
          />
        </label>
      </div>

      <p className="helper-text">
        Asset tags and notes are stored in this browser
        only. They are not submitted to AWS by this version.
      </p>
    </section>
  );
}

/* ======================================================
   MAIN AUDIT PAGE
====================================================== */

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
        const parsed: unknown = JSON.parse(saved);

        if (isObject(parsed)) {
          setCustomFields({
            assetTag: textValue(parsed.assetTag),
            notes: textValue(parsed.notes),
          });
        }
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
      const response = await fetch(AUDIT_API, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(
          `The local audit service returned HTTP ${response.status}.`
        );
      }

      const data: unknown = await response.json();

      if (!isObject(data)) {
        throw new Error(
          'The audit service returned invalid JSON data.'
        );
      }

      const raw = data;

      const rawCpu = firstValue(raw, [
        'cpu_info',
        'CPUInfo',
        'cpuInfo',
      ]);

      const cpuInfo: HardwareItem = isObject(rawCpu)
        ? (rawCpu as HardwareItem)
        : getCpuFallback(
            textValue(
              firstValue(raw, [
                'cpu',
                'CPU',
                'processor',
              ])
            )
          );

      const rawRam = firstValue(raw, [
        'ram',
        'Ram',
        'RAM',
        'memory',
      ]);

      const rawStorage = firstValue(raw, [
        'disks',
        'Storage',
        'storage',
        'Disks',
      ]);

      const ram = parseStructuredValue(rawRam);
      const storage = parseStructuredValue(rawStorage);

      const record: AuditRecord = {
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

        PartNumber: textValue(
          firstValue(raw, [
            'part_number',
            'PartNumber',
            'partNumber',
            'system_sku_number',
            'sku',
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
          firstValue(cpuInfo as DataObject, [
            'model',
            'name',
          ]) ||
            firstValue(raw, [
              'cpu',
              'CPU',
              'processor',
            ])
        ),

        CPUInfo: cpuInfo,

        Ram: (
          ram === '' ? '' : ram
        ) as string | RamInfo,

        Storage: (
          storage === '' ? '' : storage
        ) as string | HardwareItem | HardwareItem[],

        AuditTime: textValue(
          firstValue(raw, [
            'collected_at',
            'AuditTime',
            'audit_time',
          ])
        ) || new Date().toISOString(),
      };

      if (!record.Host.trim()) {
        throw new Error(
          'No hostname was returned. Check the JSON from agent.py.'
        );
      }

      setAudit(record);
      setMessageType('success');

      setMessage(
        'Audit collected successfully. Review the hardware details before submitting to AWS.'
      );
    } catch (error) {
      setMessageType('error');

      if (
        error instanceof TypeError &&
        /fetch/i.test(error.message)
      ) {
        setMessage(
          'Cannot connect to the local audit service. Check that agent.py is running on this computer and that http://127.0.0.1:8765/audit is accessible.'
        );
      } else {
        setMessage(
          error instanceof Error
            ? error.message
            : 'Unable to load audit information.'
        );
      }
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

          AuditTime: audit.AuditTime,
        });

      if (result.errors?.length || !result.data) {
        throw new Error(
          result.errors
            ?.map((error) => error.message)
            .join('; ') ||
            'AWS did not return a saved audit record.'
        );
      }

      setMessageType('success');

      setMessage(
        'Success! The computer audit was saved to AWS Amplify.'
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

  return (
    <main style={styles.page}>
      <style>
        {`
          html {
            min-height: 100%;
            height: auto;
            overflow-y: auto !important;
            overflow-x: hidden;
            background: #f4f7fb;
          }

          body {
            min-height: 100%;
            height: auto;
            margin: 0;
            overflow-y: auto !important;
            overflow-x: hidden;
            background: #f4f7fb;
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

          .section-heading {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            flex-wrap: wrap;
            gap: 10px;
          }

          .component-count {
            display: inline-flex;
            align-items: center;
            padding: 6px 10px;
            background: #eff6ff;
            color: #1d4ed8;
            border: 1px solid #dbeafe;
            border-radius: 7px;
            font-size: 12px;
            font-weight: 600;
            white-space: nowrap;
          }

          .hardware-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }

          .hardware-table th {
            text-align: left;
          }

          .ram-summary {
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 10px;
            margin-top: 15px;
          }

          .summary-item {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 12px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 9px;
            min-width: 0;
          }

          .summary-item span {
            font-size: 12px;
            color: #64748b;
          }

          .summary-item strong {
            font-size: 15px;
            font-weight: 700;
            color: #172554;
            overflow-wrap: anywhere;
          }

          .custom-fields-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 18px;
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
            margin: 14px 0 0;
            color: #94a3b8;
            font-size: 12px;
            line-height: 1.7;
          }

          .status-message {
            padding: 12px 15px;
            margin-top: 18px;
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
            gap: 16px;
            padding-bottom: 20px;
            margin-bottom: 22px;
            border-bottom: 1px solid #e2e8f0;
          }

          .audit-logo {
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 0;
          }

          .audit-logo-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 44px;
            height: 44px;
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
            padding: 9px 12px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 9px;
            color: #475569;
            font-size: 12px;
            overflow-wrap: anywhere;
            max-width: 100%;
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
            padding-top: 18px;
            margin-top: 25px;
            border-top: 1px solid #e2e8f0;
            color: #94a3b8;
            font-size: 12px;
          }

          @media (max-width: 1100px) {
            .ram-summary {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }
          }

          @media (max-width: 700px) {
            .ram-summary {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .custom-fields-grid {
              grid-template-columns: minmax(0, 1fr);
            }

            .audit-header {
              align-items: flex-start;
            }
          }

          @media (max-width: 420px) {
            .ram-summary {
              grid-template-columns: minmax(0, 1fr);
            }
          }
        `}
      </style>

      <div style={styles.container}>
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
                  fontSize: 'clamp(23px, 3vw, 30px)',
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

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>
            Audit Collection
          </h2>

          <p style={styles.description}>
            Connect to the local Ubuntu audit service to
            retrieve the computer's hardware information.
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
                : 'Audit This Device'}
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

        {audit && (
          <>
            <SystemInformation audit={audit} />

            <HardwareInventory audit={audit} />

            <AdditionalDetails audit={audit} />

            <CustomFieldsEditor
              fields={customFields}
              onChange={updateCustomFields}
            />

            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>
                Submit Audit
              </h2>

              <p style={styles.description}>
                Save the collected computer information
                to your AWS Amplify database.
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

        <footer className="audit-footer">
          <span>Computer Audit System</span>

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

/* ======================================================
   APPLICATION ENTRY POINT
====================================================== */

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
