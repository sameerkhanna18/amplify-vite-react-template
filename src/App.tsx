import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import '@aws-amplify/ui-react/styles.css';

const client = generateClient<Schema>();

const API_URL = 'http://127.0.0.1:8765/audit';

type HardwareItem = {
  [key: string]: unknown;
  name?: string;
  manufacturer?: string;
  model?: string;
  serial?: string;
  part_number?: string;
  capacity_gb?: number;
  capacity_gib?: number;
  capacity_bytes?: number;
  size_mb?: number;
  locator?: string;
  bank_locator?: string;
  type?: string;
  speed?: string | number;
  configured_speed?: string | number;
  form_factor?: string;
  asset_tag?: string;
  rank?: string;
  voltage?: string;
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
  host: string;
  manufacturer: string;
  model: string;
  serial: string;
  part_number: string;
  system_uuid: string;
  hwid: string;
  product_type: string;
  chassis_type: string;
  os_version: string;
  kernel: string;
  architecture: string;
  cpu: string;
  cpu_info: HardwareItem;
  ram: RamInfo;
  imei: string;
  collected_at: string;
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

/* =========================================================
   Value helpers
========================================================= */

function textValue(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value).trim();
}

function showValue(value: unknown): string {
  return textValue(value) || 'Not available';
}

function firstValue(
  source: Record<string, unknown> | undefined,
  keys: string[],
): unknown {
  if (!source) return '';

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

function parseObject(value: unknown): Record<string, unknown> {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);

      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Ignore invalid JSON.
    }
  }

  return {};
}

function parseArray(value: unknown): HardwareItem[] {
  let parsed = value;

  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter(
    (item): item is HardwareItem =>
      item !== null &&
      typeof item === 'object' &&
      !Array.isArray(item),
  );
}

/* =========================================================
   Hardware helpers
========================================================= */

function getCapacity(item: HardwareItem): string {
  if (
    item.capacity_gb !== undefined &&
    item.capacity_gb !== null
  ) {
    return `${item.capacity_gb} GB`;
  }

  if (
    item.capacity_gib !== undefined &&
    item.capacity_gib !== null
  ) {
    return `${item.capacity_gib} GiB`;
  }

  if (
    item.capacity_bytes !== undefined &&
    item.capacity_bytes !== null
  ) {
    return `${(
      item.capacity_bytes / 1_000_000_000
    ).toFixed(2)} GB`;
  }

  if (
    item.size_mb !== undefined &&
    item.size_mb !== null
  ) {
    return `${(item.size_mb / 1024).toFixed(2)} GB`;
  }

  return '';
}

function getManufacturer(
  item: HardwareItem,
  category: 'ram',
): string {
  const manufacturer = textValue(
    firstValue(item, [
      'manufacturer',
      'Manufacturer',
      'manufacturer_name',
      'vendor',
      'Vendor',
      'vendor_name',
      'brand',
    ]),
  );

  if (manufacturer) {
    return manufacturer;
  }

  const model = textValue(
    firstValue(item, [
      'model',
      'Model',
      'part_number',
      'partnumber',
      'name',
      'product',
    ]),
  );

  const patterns: Record<string, RegExp> = {
    ram: /\b(Samsung|SK hynix|Hynix|Micron|Kingston|Crucial|Corsair|G\.Skill|ADATA|Transcend)\b/i,
  };

  return model.match(patterns[category])?.[1] ?? '';
}

function getSpeed(item: HardwareItem): string {
  const value = firstValue(item, [
    'configured_speed',
    'configured_memory_speed',
    'speed',
    'speed_mhz',
    'clock_speed',
  ]);

  return textValue(value);
}

/* =========================================================
   Normalise Python API response
========================================================= */

function normaliseAudit(data: unknown): AuditRecord {
  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data)
  ) {
    throw new Error(
      'The audit service returned invalid data.',
    );
  }

  const raw = data as Record<string, unknown>;

  const ram = parseObject(
    firstValue(raw, [
      'ram',
      'Ram',
      'RAM',
      'memory',
    ]),
  ) as RamInfo;

  // Read the modules array from the Python API.
  ram.modules = parseArray(
    firstValue(ram, [
      'modules',
      'Modules',
      'memory_modules',
    ]),
  );

  // Keep RAM totals consistent with detected modules.
  if (
    ram.modules.length > 0 &&
    ram.total_gb === undefined
  ) {
    const total = ram.modules.reduce(
      (sum, module) => {
        const capacity = getModuleCapacityGb(module);
        return sum + capacity;
      },
      0,
    );

    ram.total_gb = Number(total.toFixed(2));
  }

  if (ram.modules_installed === undefined) {
    ram.modules_installed = ram.modules.length;
  }

  const cpuInfo = parseObject(
    firstValue(raw, [
      'cpu_info',
      'CPUInfo',
      'cpuInfo',
    ]),
  ) as HardwareItem;

  return {
    host: textValue(
      firstValue(raw, [
        'host',
        'hostname',
        'Hostname',
      ]),
    ),

    manufacturer: textValue(
      firstValue(raw, [
        'manufacturer',
        'Manufacturer',
        'Make',
      ]),
    ),

    model: textValue(
      firstValue(raw, [
        'model',
        'Model',
      ]),
    ),

    serial: textValue(
      firstValue(raw, [
        'serial',
        'Serial',
        'serial_number',
      ]),
    ),

    part_number: textValue(
      firstValue(raw, [
        'part_number',
        'sku',
        'SKU',
        'system_sku',
        'system_sku_number',
        'SystemSKUNumber',
      ]),
    ),

    system_uuid: textValue(
      firstValue(raw, [
        'system_uuid',
        'SystemUUID',
      ]),
    ),

    hwid: textValue(
      firstValue(raw, [
        'hwid',
        'system_uuid',
        'SystemUUID',
      ]),
    ),

    product_type: textValue(
      firstValue(raw, [
        'product_type',
        'ProductType',
      ]),
    ),

    chassis_type: textValue(
      firstValue(raw, [
        'chassis_type',
        'chassisType',
        'chassis',
      ]),
    ),

    os_version: textValue(
      firstValue(raw, [
        'os_version',
        'OsVersion',
      ]),
    ),

    kernel: textValue(
      firstValue(raw, [
        'kernel',
        'Kernel',
      ]),
    ),

    architecture: textValue(
      firstValue(raw, [
        'architecture',
        'Architecture',
      ]),
    ),

    cpu: textValue(
      firstValue(raw, [
        'cpu',
        'CPU',
      ]),
    ),

    cpu_info: cpuInfo,

    ram,

    imei: textValue(
      firstValue(raw, [
        'imei',
        'IMEI',
      ]),
    ),

    collected_at: textValue(
      firstValue(raw, [
        'collected_at',
        'AuditTime',
      ]),
    ),
  };
}

function getModuleCapacityGb(
  module: HardwareItem,
): number {
  if (
    typeof module.capacity_gb === 'number' &&
    Number.isFinite(module.capacity_gb)
  ) {
    return module.capacity_gb;
  }

  if (
    typeof module.capacity_gib === 'number' &&
    Number.isFinite(module.capacity_gib)
  ) {
    return module.capacity_gib;
  }

  if (
    typeof module.capacity_bytes === 'number' &&
    Number.isFinite(module.capacity_bytes)
  ) {
    return module.capacity_bytes / 1_073_741_824;
  }

  if (
    typeof module.size_mb === 'number' &&
    Number.isFinite(module.size_mb)
  ) {
    return module.size_mb / 1024;
  }

  return 0;
}

/* =========================================================
   Styles
========================================================= */

const styles = {
  page: {
    minHeight: '100vh',
    width: '100%',
    padding: 'clamp(12px, 2vw, 28px)',
    background: '#f4f7fb',
    color: '#172033',
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
    boxSizing: 'border-box' as const,
  },

  container: {
    width: '100%',
    maxWidth: '1800px',
    margin: '0 auto',
    boxSizing: 'border-box' as const,
  },

  card: {
    width: '100%',
    minWidth: 0,
    padding: 'clamp(14px, 2vw, 24px)',
    marginBottom: '18px',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    boxShadow: '0 3px 12px rgba(15,23,42,0.035)',
    boxSizing: 'border-box' as const,
  },

  heading: {
    margin: '0 0 6px',
    color: '#172554',
    fontSize: '19px',
    lineHeight: 1.4,
    fontWeight: 700,
  },

  description: {
    margin: '0 0 18px',
    color: '#64748b',
    fontSize: '13px',
    lineHeight: 1.65,
  },

  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '42px',
    padding: '10px 17px',
    border: 'none',
    borderRadius: '8px',
    background: '#2563eb',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  secondaryButton: {
    padding: '9px 14px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#334155',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  tableWrapper: {
    width: '100%',
    maxWidth: '100%',
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
    lineHeight: 1.5,
  },

  labelCell: {
    width: '210px',
    minWidth: '150px',
    padding: '11px 13px',
    textAlign: 'left' as const,
    verticalAlign: 'top' as const,
    background: '#f8fafc',
    color: '#475569',
    fontWeight: 600,
    borderBottom: '1px solid #e9eef5',
    overflowWrap: 'anywhere' as const,
  },

  valueCell: {
    padding: '11px 13px',
    textAlign: 'left' as const,
    verticalAlign: 'top' as const,
    color: '#1e293b',
    borderBottom: '1px solid #e9eef5',
    whiteSpace: 'pre-wrap' as const,
    overflowWrap: 'anywhere' as const,
    wordBreak: 'break-word' as const,
  },
};

/* =========================================================
   Shared components
========================================================= */

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section style={styles.card}>
      <h2 style={styles.heading}>{title}</h2>

      {description && (
        <p style={styles.description}>
          {description}
        </p>
      )}

      {children}
    </section>
  );
}

function DataTable({
  rows,
}: {
  rows: Array<[string, unknown]>;
}) {
  return (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <tbody>
          {rows.map(([label, value], index) => (
            <tr key={label}>
              <th scope="row" style={styles.labelCell}>
                {label}
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
                {showValue(value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InventoryTable({
  rows,
}: {
  rows: Array<Array<unknown>>;
}) {
  const columns = [
    'Component',
    'Manufacturer',
    'Model / Part Number',
    'Serial Number',
    'Type',
    'Speed',
    'Size',
  ];

  return (
    <div style={styles.tableWrapper}>
      <table
        style={{
          ...styles.table,
          minWidth: '900px',
          tableLayout: 'auto',
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
                  background: '#eff4fa',
                  color: '#334155',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  borderBottom: '1px solid #dbe3ed',
                }}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${String(row[0])}-${rowIndex}`}>
              {row.map((value, columnIndex) => (
                <td
                  key={columnIndex}
                  style={{
                    ...styles.valueCell,
                    background:
                      rowIndex % 2 === 0
                        ? '#ffffff'
                        : '#f8fafc',
                    whiteSpace: 'normal',
                    minWidth: '90px',
                  }}
                >
                  {showValue(value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* =========================================================
   System information
========================================================= */

function SystemInformation({
  audit,
}: {
  audit: AuditRecord;
}) {
  return (
    <Section
      title="System Information"
      description="Computer identification and primary hardware specifications."
    >
      <DataTable
        rows={[
          [
            'Hostname',
            audit.host,
          ],
          [
            'Product Type',
            audit.product_type &&
            audit.product_type !== 'Unknown'
              ? audit.product_type
              : audit.chassis_type,
          ],
          [
            'CPU',
            firstValue(audit.cpu_info, [
              'model',
              'name',
            ]),
          ],
          [
            'Manufacturer',
            audit.manufacturer,
          ],
          [
            'Model',
            audit.model,
          ],
          [
            'Serial Number',
            audit.serial,
          ],
          [
            'Part Number',
            audit.part_number,
          ],
        ]}
      />
    </Section>
  );
}

/* =========================================================
   RAM information
========================================================= */

function HardwareComponents({
  audit,
}: {
  audit: AuditRecord;
}) {
  const ramModules = Array.isArray(audit.ram?.modules)
    ? audit.ram.modules
    : [];

  const rows: Array<Array<unknown>> = [];

  if (ramModules.length > 0) {
    for (const module of ramModules) {
      const manufacturer = getManufacturer(
        module,
        'ram',
      );

      const model = textValue(
        firstValue(module, [
          'model',
          'part_number',
          'part_number_raw',
          'partnumber',
          'product',
          'product_name',
        ]),
      );

      const serial = textValue(
        firstValue(module, [
          'serial',
          'serial_number',
          'serial_number_raw',
          'serialnumber',
          'serial_no',
        ]),
      );

      const memoryType = textValue(
        firstValue(module, [
          'type',
          'memory_type',
          'form_factor',
        ]),
      );

      const speed = getSpeed(module);

      rows.push([
        'RAM',
        manufacturer,
        model,
        serial,
        memoryType,
        speed,
        getCapacity(module),
      ]);
    }
  } else {
    rows.push([
      'RAM',
      '',
      '',
      '',
      '',
      '',
      audit.ram.total_gb !== undefined
        ? `${audit.ram.total_gb} GB total`
        : '',
    ]);
  }

  return (
    <Section
      title="RAM Information"
      description="Installed physical memory modules and their firmware-reported specifications."
    >
      <div className="hardware-summary">
        <div className="summary-item">
          <span>Total RAM</span>
          <strong>
            {audit.ram.total_gb !== undefined
              ? `${audit.ram.total_gb} GB`
              : 'Not available'}
          </strong>
        </div>

        <div className="summary-item">
          <span>Installed RAM Modules</span>
          <strong>
            {audit.ram.modules_installed ??
              ramModules.length}
          </strong>
        </div>

        <div className="summary-item">
          <span>RAM Slots Used</span>
          <strong>
            {audit.ram.slots_used ??
              ramModules.length}
          </strong>
        </div>

        <div className="summary-item">
          <span>RAM Slots Available</span>
          <strong>
            {audit.ram.slots_available ??
              'Not available'}
          </strong>
        </div>
      </div>

      <InventoryTable rows={rows} />

      <p className="helper-text">
        Manufacturer, serial number, model, and speed are
        displayed when provided by the operating system's
        firmware information. Some computers do not report
        every field.
      </p>
    </Section>
  );
}

/* =========================================================
   Additional information
========================================================= */

function AdditionalInformation({
  audit,
}: {
  audit: AuditRecord;
}) {
  return (
    <Section
      title="Additional Information"
      description="Operating system, kernel, architecture, and audit metadata."
    >
      <DataTable
        rows={[
          [
            'Operating System',
            audit.os_version,
          ],
          [
            'Kernel',
            audit.kernel,
          ],
          [
            'System Architecture',
            audit.architecture,
          ],
          [
            'IMEI',
            audit.imei,
          ],
          [
            'System UUID',
            audit.system_uuid,
          ],
          [
            'Collected At',
            audit.collected_at
              ? new Date(
                  audit.collected_at,
                ).toLocaleString()
              : '',
          ],
        ]}
      />
    </Section>
  );
}

/* =========================================================
   Custom asset fields
========================================================= */

function CustomFieldsEditor({
  fields,
  onChange,
}: {
  fields: CustomFields;
  onChange: (fields: CustomFields) => void;
}) {
  function updateField(
    key: keyof CustomFields,
    value: string,
  ) {
    onChange({
      ...fields,
      [key]: value,
    });
  }

  return (
    <Section
      title="Additional Asset Fields"
      description="Add an internal asset reference and notes."
    >
      <div className="custom-fields-grid">
        <label className="field-label">
          Asset Tag

          <input
            type="text"
            value={fields.assetTag}
            onChange={(event) =>
              updateField(
                'assetTag',
                event.target.value,
              )
            }
            placeholder="e.g. IT-000123"
          />
        </label>

        <label className="field-label">
          Notes

          <textarea
            value={fields.notes}
            onChange={(event) =>
              updateField(
                'notes',
                event.target.value,
              )
            }
            rows={3}
            placeholder="Enter additional notes..."
          />
        </label>
      </div>

      <p className="helper-text">
        Asset Tag and Notes are saved in this browser.
        They are not included in the current AWS submission.
      </p>
    </Section>
  );
}

/* =========================================================
   Main audit page
========================================================= */

function AuditPage({
  signOut,
  user,
}: {
  signOut?: () => void;
  user?: {
    signInDetails?: {
      loginId?: string;
    };
  };
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
        CUSTOM_FIELDS_KEY,
      );

      if (saved) {
        const parsed: unknown = JSON.parse(saved);

        if (
          parsed &&
          typeof parsed === 'object' &&
          !Array.isArray(parsed)
        ) {
          setCustomFields({
            ...emptyCustomFields,
            ...(parsed as Partial<CustomFields>),
          });
        }
      }
    } catch {
      // Continue with empty custom fields.
    }
  }, []);

  function updateCustomFields(
    fields: CustomFields,
  ) {
    setCustomFields(fields);

    try {
      localStorage.setItem(
        CUSTOM_FIELDS_KEY,
        JSON.stringify(fields),
      );
    } catch {
      setMessageType('error');

      setMessage(
        'The fields changed but could not be saved in this browser.',
      );
    }
  }

  async function loadAudit() {
    setBusy(true);
    setMessage('');
    setAudit(null);

    try {
      const response = await fetch(API_URL, {
        method: 'GET',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(
          `Unable to retrieve audit information (HTTP ${response.status}).`,
        );
      }

      const data: unknown = await response.json();

      // Useful while checking RAM manufacturer and serial.
      console.log(
        'Raw RAM information:',
        parseObject(
          parseObject(data).ram,
        ),
      );

      const record = normaliseAudit(data);

      if (!record.host.trim()) {
        throw new Error(
          'The audit service did not return a hostname.',
        );
      }

      console.log(
        'Normalised RAM modules:',
        record.ram.modules,
      );

      setAudit(record);
      setMessageType('success');

      setMessage(
        'Audit collected successfully. Review the hardware information before submitting it to AWS.',
      );
    } catch (error) {
      setMessageType('error');

      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load audit information.',
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
          Host: audit.host,
          Make: audit.manufacturer,
          Model: audit.model,
          Serial: audit.serial,
          OsVersion: audit.os_version,
          Kernel: audit.kernel,

          CPU: JSON.stringify(audit.cpu_info),

          Ram: JSON.stringify(audit.ram),

          // Motherboard and Storage are intentionally
          // excluded from this version of the interface.
          AuditTime:
            audit.collected_at ||
            new Date().toISOString(),
        });

      if (result.errors?.length || !result.data) {
        throw new Error(
          result.errors
            ?.map((item) => item.message)
            .join('; ') ||
            'Unable to save the audit to AWS.',
        );
      }

      setMessageType('success');

      setMessage(
        'The computer audit and RAM details were saved to AWS.',
      );
    } catch (error) {
      setMessageType('error');

      setMessage(
        error instanceof Error
          ? error.message
          : 'The audit submission failed.',
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
            overflow-x: hidden;
            overflow-y: auto;
          }

          body {
            min-height: 100%;
            height: auto;
            margin: 0;
            overflow-x: hidden;
            overflow-y: auto;
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
            opacity: 0.6;
            cursor: not-allowed;
          }

          .audit-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 16px;
            margin-bottom: 22px;
            padding-bottom: 18px;
            border-bottom: 1px solid #e2e8f0;
          }

          .audit-brand {
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 0;
          }

          .audit-logo {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 44px;
            height: 44px;
            flex-shrink: 0;
            background: #2563eb;
            color: #ffffff;
            border-radius: 11px;
            font-size: 24px;
            font-weight: 700;
          }

          .audit-title {
            margin: 0;
            color: #172554;
            font-size: clamp(23px, 3vw, 30px);
            line-height: 1.3;
            letter-spacing: -0.6px;
          }

          .audit-subtitle {
            margin: 5px 0 0;
            color: #64748b;
            font-size: 13px;
            line-height: 1.5;
          }

          .audit-user {
            max-width: 100%;
            padding: 9px 12px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            color: #475569;
            font-size: 12px;
            overflow-wrap: anywhere;
          }

          .status-message {
            margin-top: 16px;
            padding: 12px 14px;
            border: 1px solid transparent;
            border-radius: 8px;
            font-size: 13px;
            line-height: 1.65;
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

          .hardware-summary {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 16px;
          }

          .summary-item {
            display: flex;
            flex-direction: column;
            gap: 7px;
            min-width: 0;
            padding: 12px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
          }

          .summary-item span {
            color: #64748b;
            font-size: 12px;
          }

          .summary-item strong {
            color: #172554;
            font-size: 16px;
            overflow-wrap: anywhere;
          }

          .custom-fields-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
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

          .field-label input,
          .field-label textarea {
            width: 100%;
            max-width: 100%;
            min-width: 0;
            padding: 11px 12px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            background: #ffffff;
            color: #0f172a;
            font: inherit;
            font-weight: 400;
          }

          .field-label textarea {
            resize: vertical;
          }

          .helper-text {
            margin: 14px 0 0;
            color: #64748b;
            font-size: 12px;
            line-height: 1.7;
          }

          .audit-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 24px;
            padding-top: 18px;
            border-top: 1px solid #e2e8f0;
            color: #64748b;
            font-size: 12px;
          }

          @media (max-width: 800px) {
            .hardware-summary {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 520px) {
            .custom-fields-grid {
              grid-template-columns: minmax(0, 1fr);
            }

            .audit-header {
              align-items: flex-start;
            }

            .hardware-summary {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
        `}
      </style>

      <div style={styles.container}>
        <header className="audit-header">
          <div className="audit-brand">
            <div
              className="audit-logo"
              aria-hidden="true"
            >
              ◈
            </div>

            <div>
              <h1 className="audit-title">
                Computer Audit
              </h1>

              <p className="audit-subtitle">
                Hardware inventory and asset management
              </p>
            </div>
          </div>

          <div className="audit-user">
            Signed in as{' '}
            <strong>
              {user?.signInDetails?.loginId ||
                'Authenticated user'}
            </strong>
          </div>
        </header>

        <Section
          title="Audit Collection"
          description="Connect to the local Ubuntu agent to collect computer and RAM information."
        >
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
        </Section>

        {audit && (
          <>
            <SystemInformation audit={audit} />

            <HardwareComponents audit={audit} />

            <AdditionalInformation audit={audit} />

            <CustomFieldsEditor
              fields={customFields}
              onChange={updateCustomFields}
            />

            <Section
              title="Submit Audit"
              description="Save the computer audit and RAM information to your existing Amplify data model."
            >
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
            </Section>
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

/* =========================================================
   App entry point
========================================================= */

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
