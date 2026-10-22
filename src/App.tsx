import { useEffect, useState } from 'react';
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
  size_mb?: number;
  device?: string;
  locator?: string;
  bank_locator?: string;
  type?: string;
  speed?: string;
  configured_speed?: string;
  form_factor?: string;
  asset_tag?: string;
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
  disks: HardwareItem[];
  imei: string;
  collected_at: string;
  motherboard: HardwareItem;
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

function showValue(value: unknown): string {
  const result = textValue(value);
  return result || 'Not available';
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
    item.size_mb !== undefined &&
    item.size_mb !== null
  ) {
    return `${item.size_mb} MB`;
  }

  return 'Not available';
}

function getManufacturer(
  item: HardwareItem,
  category: 'cpu' | 'ram' | 'disk',
): string {
  const manufacturer = textValue(
    firstValue(item, [
      'manufacturer',
      'Manufacturer',
      'vendor',
      'Vendor',
      'vendor_id',
      'manufacturer_name',
    ]),
  );

  if (manufacturer) return manufacturer;

  const model = textValue(
    firstValue(item, [
      'model',
      'Model',
      'name',
      'product',
    ]),
  );

  const patterns: Record<string, RegExp> = {
    cpu: /\b(Intel|AMD|Apple|Qualcomm|ARM)\b/i,
    ram: /\b(Samsung|SK hynix|Hynix|Micron|Kingston|Crucial|Corsair|G\.Skill|ADATA|Transcend)\b/i,
    disk: /\b(Samsung|Kingston|Crucial|Micron|Intel|Seagate|Western Digital|WDC|Toshiba|SanDisk|SK hynix|Kioxia|Solidigm)\b/i,
  };

  const match = model.match(patterns[category]);

  return match?.[1] ?? '';
}

function getSpeed(item: HardwareItem): string {
  const value = firstValue(item, [
    'configured_speed',
    'speed',
    'current_speed',
    'maximum_speed',
    'max_speed',
    'clock_speed',
  ]);

  if (
    value === '' ||
    value === undefined ||
    value === null
  ) {
    return 'Not available';
  }

  const speed = String(value);

  if (/[a-z]/i.test(speed)) {
    return speed;
  }

  const number = Number(speed);

  if (!Number.isFinite(number)) {
    return speed;
  }

  // CPU speeds from lscpu are usually expressed in MHz.
  if (
    item.name === 'CPU' &&
    number >= 1000
  ) {
    return `${(number / 1000).toFixed(2)} GHz`;
  }

  return speed;
}

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

  const cpuRaw = firstValue(raw, [
    'cpu_info',
    'CPUInfo',
    'cpuInfo',
  ]);

  const cpuInfo: HardwareItem =
    cpuRaw &&
    typeof cpuRaw === 'object' &&
    !Array.isArray(cpuRaw)
      ? (cpuRaw as HardwareItem)
      : {
          name: 'CPU',
          model: textValue(
            firstValue(raw, ['cpu', 'CPU']),
          ),
        };

  const ramRaw = firstValue(raw, [
    'ram',
    'Ram',
    'RAM',
    'memory',
  ]);

  let ram: RamInfo = {};

  if (
    ramRaw &&
    typeof ramRaw === 'object' &&
    !Array.isArray(ramRaw)
  ) {
    ram = ramRaw as RamInfo;
  } else if (typeof ramRaw === 'string') {
    try {
      const parsed: unknown = JSON.parse(ramRaw);

      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed)
      ) {
        ram = parsed as RamInfo;
      }
    } catch {
      // Leave RAM details empty if legacy data is invalid.
    }
  }

  const disksRaw = firstValue(raw, [
    'disks',
    'Storage',
    'storage',
    'Disks',
  ]);

  let disks: HardwareItem[] = [];

  if (Array.isArray(disksRaw)) {
    disks = disksRaw.filter(
      (item): item is HardwareItem =>
        item !== null &&
        typeof item === 'object' &&
        !Array.isArray(item),
    );
  } else if (
    disksRaw &&
    typeof disksRaw === 'object'
  ) {
    disks = [disksRaw as HardwareItem];
  } else if (typeof disksRaw === 'string') {
    try {
      const parsed: unknown = JSON.parse(disksRaw);

      if (Array.isArray(parsed)) {
        disks = parsed.filter(
          (item): item is HardwareItem =>
            item !== null &&
            typeof item === 'object' &&
            !Array.isArray(item),
        );
      }
    } catch {
      // Ignore invalid legacy storage values.
    }
  }

  const motherboardRaw = raw.motherboard;

  const motherboard: HardwareItem =
    motherboardRaw &&
    typeof motherboardRaw === 'object' &&
    !Array.isArray(motherboardRaw)
      ? (motherboardRaw as HardwareItem)
      : {};

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
        'PartNumber',
        'partNumber',
      ]),
    ),

    system_uuid: textValue(
      firstValue(raw, [
        'system_uuid',
        'SystemUUID',
        'hwid',
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
      ]),
    ),

    os_version: textValue(
      firstValue(raw, [
        'os_version',
        'OsVersion',
      ]),
    ),

    kernel: textValue(
      firstValue(raw, ['kernel', 'Kernel']),
    ),

    architecture: textValue(
      firstValue(raw, [
        'architecture',
        'Architecture',
      ]),
    ),

    cpu: textValue(
      firstValue(cpuInfo, ['model', 'name']) ||
      firstValue(raw, ['cpu', 'CPU']),
    ),

    cpu_info: cpuInfo,
    ram,
    disks,

    imei: textValue(
      firstValue(raw, ['imei', 'IMEI']),
    ),

    collected_at: textValue(
      firstValue(raw, [
        'collected_at',
        'AuditTime',
      ]),
    ),

    motherboard,
  };
}

/* =========================================================
   Responsive styles
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
  children: React.ReactNode;
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
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<Array<unknown>>;
}) {
  return (
    <div style={styles.tableWrapper}>
      <table
        style={{
          ...styles.table,
          minWidth: '950px',
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
            <tr
              key={rowIndex}
              style={{
                background:
                  rowIndex % 2 === 0
                    ? '#ffffff'
                    : '#f8fafc',
              }}
            >
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
  const totalStorage = audit.disks.reduce(
    (total, disk) =>
      total + Number(disk.capacity_gb ?? 0),
    0,
  );

  return (
    <Section
      title="System Information"
      description="Computer identification and primary hardware specifications."
    >
      <DataTable
        rows={[
          ['Hostname', audit.host],
          ['Manufacturer', audit.manufacturer],
          ['Model', audit.model],
          ['Product Type', audit.product_type],
          ['Chassis Type', audit.chassis_type],
          ['Part Number / SKU', audit.part_number],
          ['Serial Number', audit.serial],
          ['System UUID / HWID', audit.system_uuid],
          ['Operating System', audit.os_version],
          ['Kernel', audit.kernel],
          ['System Architecture', audit.architecture],
          [
            'Total Installed RAM',
            audit.ram.total_gb !== undefined
              ? `${audit.ram.total_gb} GB`
              : 'Not available',
          ],
          [
            'Total Detected Storage',
            audit.disks.length
              ? `${totalStorage.toFixed(2)} GB`
              : 'Not available',
          ],
        ]}
      />
    </Section>
  );
}

/* =========================================================
   CPU
========================================================= */

function CpuInformation({
  cpu,
}: {
  cpu: HardwareItem;
}) {
  return (
    <Section
      title="CPU Information"
      description="Processor identification, architecture, core count and available speed information."
    >
      <DataTable
        rows={[
          [
            'Manufacturer',
            getManufacturer(cpu, 'cpu'),
          ],
          [
            'Model',
            firstValue(cpu, [
              'model',
              'name',
            ]),
          ],
          [
            'Part Number',
            cpu.part_number,
          ],
          [
            'Serial Number',
            cpu.serial,
          ],
          [
            'Architecture',
            cpu.architecture,
          ],
          [
            'CPU Cores',
            cpu.cores,
          ],
          [
            'Threads Per Core',
            cpu.threads_per_core,
          ],
          [
            'Logical Processors',
            cpu.logical_processors,
          ],
          [
            'Current Speed',
            getSpeed({
              ...cpu,
              name: 'CPU',
              speed: textValue(cpu.current_speed),
            }),
          ],
          [
            'Maximum Speed',
            getSpeed({
              ...cpu,
              name: 'CPU',
              speed: textValue(cpu.maximum_speed),
            }),
          ],
          [
            'Reported CPU Speed',
            getSpeed(cpu),
          ],
          [
            'Vendor Identifier',
            cpu.identifier,
          ],
          [
            'Virtualization',
            cpu.virtualization,
          ],
        ]}
      />
    </Section>
  );
}

/* =========================================================
   RAM
========================================================= */

function RamInformation({
  ram,
}: {
  ram: RamInfo;
}) {
  const modules = Array.isArray(ram.modules)
    ? ram.modules
    : [];

  const rows = modules.map((module) => [
    module.name || 'RAM',
    getManufacturer(module, 'ram'),
    module.model,
    module.part_number,
    module.serial,
    getCapacity(module),
    module.type,
    module.speed,
    module.configured_speed,
    module.form_factor,
    module.locator,
    module.bank_locator,
    module.asset_tag,
  ]);

  return (
    <Section
      title="RAM Inventory"
      description="Details for each detected physical memory module."
    >
      <div className="summary-grid">
        <div className="summary-item">
          <span>Total RAM</span>
          <strong>
            {ram.total_gb !== undefined
              ? `${ram.total_gb} GB`
              : 'Not available'}
          </strong>
        </div>

        <div className="summary-item">
          <span>Installed Modules</span>
          <strong>
            {ram.modules_installed ?? modules.length}
          </strong>
        </div>

        <div className="summary-item">
          <span>Slots Used</span>
          <strong>
            {ram.slots_used ?? 'Not available'}
          </strong>
        </div>

        <div className="summary-item">
          <span>Slots Available</span>
          <strong>
            {ram.slots_available ?? 'Not available'}
          </strong>
        </div>
      </div>

      {rows.length > 0 ? (
        <InventoryTable
          columns={[
            'Module',
            'Manufacturer',
            'Model',
            'Part Number',
            'Serial Number',
            'Capacity',
            'Memory Type',
            'Rated Speed',
            'Configured Speed',
            'Form Factor',
            'Slot',
            'Bank',
            'Asset Tag',
          ]}
          rows={rows}
        />
      ) : (
        <p className="empty-message">
          No physical RAM modules were returned by the
          audit service. Check that dmidecode is available
          and can read the memory information.
        </p>
      )}
    </Section>
  );
}

/* =========================================================
   Storage
========================================================= */

function StorageInformation({
  disks,
}: {
  disks: HardwareItem[];
}) {
  const rows = disks.map((disk) => [
    disk.name,
    getManufacturer(disk, 'disk'),
    disk.model,
    disk.part_number,
    disk.serial,
    getCapacity(disk),
    disk.interface || disk.type,
    disk.device,
    disk.wwn,
    disk.hardware_id,
    disk.revision,
    disk.rotational === undefined
      ? ''
      : String(disk.rotational) === '1'
        ? 'HDD / Rotational'
        : 'SSD / Non-rotational',
  ]);

  return (
    <Section
      title="Storage Inventory"
      description="Internal storage devices, identifiers, capacity and interface information."
    >
      {rows.length > 0 ? (
        <InventoryTable
          columns={[
            'Device',
            'Manufacturer',
            'Model',
            'Part Number',
            'Serial Number',
            'Capacity',
            'Interface',
            'Device Path',
            'WWN',
            'Hardware ID',
            'Revision',
            'Media Type',
          ]}
          rows={rows}
        />
      ) : (
        <p className="empty-message">
          No internal storage devices were returned.
        </p>
      )}
    </Section>
  );
}

/* =========================================================
   Motherboard and additional details
========================================================= */

function AdditionalInformation({
  audit,
}: {
  audit: AuditRecord;
}) {
  return (
    <Section
      title="Additional Details"
      description="Motherboard identification and audit metadata."
    >
      <DataTable
        rows={[
          [
            'Motherboard Manufacturer',
            audit.motherboard.manufacturer,
          ],
          [
            'Motherboard Model',
            audit.motherboard.model,
          ],
          [
            'Motherboard Serial Number',
            audit.motherboard.serial,
          ],
          [
            'IMEI',
            audit.imei,
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
   Main page
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
      const record = normaliseAudit(data);

      if (!record.host.trim()) {
        throw new Error(
          'The audit service did not return a hostname.',
        );
      }

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
          Storage: JSON.stringify(audit.disks),
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
        'The audit and its CPU, RAM and storage details were saved to AWS.',
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

          .summary-grid {
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

          .helper-text,
          .empty-message {
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
            .summary-grid {
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

            .summary-grid {
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
          description="Connect to the local Ubuntu agent to collect computer and hardware information."
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

            <CpuInformation cpu={audit.cpu_info} />

            <RamInformation ram={audit.ram} />

            <StorageInformation disks={audit.disks} />

            <AdditionalInformation audit={audit} />

            <CustomFieldsEditor
              fields={customFields}
              onChange={updateCustomFields}
            />

            <Section
              title="Submit Audit"
              description="Save the computer audit and structured CPU, RAM and storage details to your existing Amplify data model."
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
