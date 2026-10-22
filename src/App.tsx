import { useState } from 'react';

import { Authenticator } from '@aws-amplify/ui-react';
import { generateClient } from 'aws-amplify/data';

import type { Schema } from '../amplify/data/resource';

import '@aws-amplify/ui-react/styles.css';


const client = generateClient<Schema>();

const AUDIT_URL = 'http://127.0.0.1:8765/audit';

const CUSTOM_FIELDS_KEY = 'computer-audit-custom-fields';


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

  form_factor?: string;
  asset_tag?: string;
  configured_speed?: string;
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


type AuditData = {
  host: string;

  manufacturer: string;
  model: string;
  serial: string;
  product_type: string;

  part_number: string;
  system_uuid: string;
  hwid: string;
  imei: string;

  os_version: string;
  kernel: string;

  cpu: string;
  cpu_info: HardwareItem;

  ram: RamInfo;
  disks: HardwareItem[];

  collected_at: string;
};


type CustomFields = {
  assetTag: string;
  notes: string;
};


const emptyCustomFields: CustomFields = {
  assetTag: '',
  notes: '',
};


const styles = {
  page: {
    minHeight: '100vh',
    padding: '24px 0 40px',
    background: '#f5f7fb',
    color: '#172033',
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  },

  container: {
    width: '96%',
    maxWidth: '1600px',
    margin: '0 auto',
  },

  card: {
    padding: '22px',
    marginBottom: '18px',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    boxShadow: '0 3px 12px rgba(15, 23, 42, 0.035)',
  },

  heading: {
    margin: '0 0 6px',
    fontSize: '20px',
    fontWeight: 700,
    color: '#172554',
  },

  description: {
    margin: '0 0 18px',
    color: '#64748b',
    fontSize: '13px',
    lineHeight: 1.7,
  },

  button: {
    padding: '11px 18px',
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  secondaryButton: {
    padding: '10px 16px',
    background: '#ffffff',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  tableWrapper: {
    width: '100%',
    overflowX: 'auto' as const,
    border: '1px solid #e2e8f0',
    borderRadius: '9px',
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '13px',
  },

  labelCell: {
    padding: '11px 13px',
    textAlign: 'left' as const,
    verticalAlign: 'top' as const,
    background: '#f8fafc',
    borderBottom: '1px solid #e9eef5',
    color: '#475569',
    fontWeight: 600,
    minWidth: '170px',
  },

  valueCell: {
    padding: '11px 13px',
    textAlign: 'left' as const,
    verticalAlign: 'top' as const,
    borderBottom: '1px solid #e9eef5',
    color: '#1e293b',
    overflowWrap: 'anywhere' as const,
    whiteSpace: 'pre-wrap' as const,
  },
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


function displayValue(value: unknown): string {
  return textValue(value) || 'Not available';
}


function getCapacity(item: HardwareItem): string {
  if (item.capacity_gb != null) {
    return `${item.capacity_gb} GB`;
  }

  if (item.size_mb != null) {
    return `${item.size_mb} MB`;
  }

  return '';
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
          {rows.map(([label, value], index) => (
            <tr key={label}>
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
                {displayValue(value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


/* =========================================================
   Hardware inventory
========================================================= */

function HardwareInventory({
  audit,
}: {
  audit: AuditData;
}) {
  const components: Array<{
    category: string;
    item: HardwareItem;
  }> = [
    {
      category: 'CPU',
      item: audit.cpu_info,
    },

    ...(audit.ram.modules ?? []).map((item) => ({
      category: 'RAM',
      item,
    })),

    ...audit.disks.map((item) => ({
      category: 'Storage',
      item,
    })),
  ];


  const columns = [
    {
      label: 'Component',
      getValue: (
        category: string,
        _item: HardwareItem
      ) => category,
    },

    {
      label: 'Manufacturer',
      getValue: (
        _category: string,
        item: HardwareItem
      ) => item.manufacturer,
    },

    {
      label: 'Model',
      getValue: (
        _category: string,
        item: HardwareItem
      ) => item.model || item.name,
    },

    {
      label: 'Serial Number',
      getValue: (
        _category: string,
        item: HardwareItem
      ) => item.serial,
    },

    {
      label: 'Part Number',
      getValue: (
        _category: string,
        item: HardwareItem
      ) => item.part_number,
    },

    {
      label: 'Capacity',
      getValue: (
        category: string,
        item: HardwareItem
      ) => {
        if (category === 'RAM' || category === 'Storage') {
          return getCapacity(item);
        }

        return '';
      },
    },

    {
      label: 'Type',
      getValue: (
        _category: string,
        item: HardwareItem
      ) => item.type || item.architecture,
    },

    {
      label: 'Speed',
      getValue: (
        _category: string,
        item: HardwareItem
      ) => item.speed || item.current_speed,
    },

    {
      label: 'Form Factor',
      getValue: (
        _category: string,
        item: HardwareItem
      ) => item.form_factor,
    },

    {
      label: 'Asset Tag',
      getValue: (
        _category: string,
        item: HardwareItem
      ) => item.asset_tag,
    },

    {
      label: 'Slot / Device',
      getValue: (
        category: string,
        item: HardwareItem
      ) => {
        if (category === 'RAM') {
          return item.locator;
        }

        if (category === 'Storage') {
          return item.device;
        }

        return '';
      },
    },

    {
      label: 'CPU Cores',
      getValue: (
        category: string,
        item: HardwareItem
      ) => category === 'CPU'
        ? item.cores
        : '',
    },

    {
      label: 'Threads Per Core',
      getValue: (
        category: string,
        item: HardwareItem
      ) => category === 'CPU'
        ? item.threads_per_core
        : '',
    },
  ];


  return (
    <section style={styles.card}>
      <h2 style={styles.heading}>
        Hardware Inventory
      </h2>

      <p style={styles.description}>
        Individual CPU, RAM and storage components
        detected on this computer.
      </p>

      <div style={styles.tableWrapper}>
        <table
          style={{
            ...styles.table,
            minWidth: '1400px',
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
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
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
                key={`${component.category}-${index}`}
              >
                {columns.map((column) => (
                  <td
                    key={column.label}
                    style={{
                      ...styles.valueCell,
                      background:
                        index % 2 === 0
                          ? '#ffffff'
                          : '#fafcff',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {displayValue(
                      column.getValue(
                        component.category,
                        component.item
                      )
                    ) === 'Not available'
                      ? '—'
                      : textValue(
                          column.getValue(
                            component.category,
                            component.item
                          )
                        )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '12px',
          marginTop: '16px',
        }}
      >
        {[
          ['Total RAM', `${audit.ram.total_gb ?? 0} GB`],
          [
            'Modules Installed',
            audit.ram.modules_installed ??
              audit.ram.modules?.length ??
              0,
          ],
          ['Slots Used', audit.ram.slots_used ?? 0],
          [
            'Slots Available',
            audit.ram.slots_available ?? 0,
          ],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            style={{
              padding: '14px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '9px',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                color: '#64748b',
              }}
            >
              {label}
            </div>

            <strong
              style={{
                display: 'block',
                marginTop: '6px',
                fontSize: '17px',
                color: '#172554',
              }}
            >
              {value}
            </strong>
          </div>
        ))}
      </div>
    </section>
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
  const inputStyle = {
    width: '100%',
    padding: '11px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
  };

  return (
    <section style={styles.card}>
      <h2 style={styles.heading}>
        Additional Asset Fields
      </h2>

      <p style={styles.description}>
        Add an internal asset tag and any notes
        associated with this computer.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '18px',
        }}
      >
        <label>
          Asset Tag

          <input
            value={fields.assetTag}
            onChange={(event) =>
              onChange({
                ...fields,
                assetTag: event.target.value,
              })
            }
            placeholder="e.g. IT-000123"
            style={{
              ...inputStyle,
              marginTop: '8px',
            }}
          />
        </label>

        <label>
          Notes

          <textarea
            value={fields.notes}
            onChange={(event) =>
              onChange({
                ...fields,
                notes: event.target.value,
              })
            }
            rows={3}
            placeholder="Additional notes..."
            style={{
              ...inputStyle,
              marginTop: '8px',
              resize: 'vertical',
            }}
          />
        </label>
      </div>

      <p
        style={{
          marginTop: '14px',
          color: '#94a3b8',
          fontSize: '12px',
        }}
      >
        Asset tags and notes are saved in this browser.
        They are not yet submitted to AWS.
      </p>
    </section>
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
  const [audit, setAudit] = useState<AuditData | null>(
    null
  );

  const [busy, setBusy] = useState(false);

  const [message, setMessage] = useState('');

  const [messageType, setMessageType] = useState<
    'success' | 'info' | 'error'
  >('info');


  const [customFields, setCustomFields] =
    useState<CustomFields>(() => {
      try {
        const saved = localStorage.getItem(
          CUSTOM_FIELDS_KEY
        );

        return saved
          ? {
              ...emptyCustomFields,
              ...JSON.parse(saved),
            }
          : emptyCustomFields;
      } catch {
        return emptyCustomFields;
      }
    });


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
        'Unable to save the custom fields in this browser.'
      );
    }
  }


  async function loadAudit() {
    setBusy(true);
    setMessage('');
    setAudit(null);

    try {
      const response = await fetch(AUDIT_URL, {
        method: 'GET',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(
          `Audit request failed: HTTP ${response.status}.`
        );
      }

      const raw: unknown = await response.json();

      if (
        !raw ||
        typeof raw !== 'object' ||
        Array.isArray(raw)
      ) {
        throw new Error(
          'The audit agent returned invalid data.'
        );
      }

      const data = raw as Record<string, unknown>;

      if (
        typeof data.host !== 'string' ||
        !data.host.trim()
      ) {
        throw new Error(
          'The audit response does not contain a hostname.'
        );
      }

      const cpuInfo =
        data.cpu_info &&
        typeof data.cpu_info === 'object' &&
        !Array.isArray(data.cpu_info)
          ? data.cpu_info as HardwareItem
          : {
              name: 'CPU',
              model: textValue(data.cpu),
            };

      const ram =
        data.ram &&
        typeof data.ram === 'object' &&
        !Array.isArray(data.ram)
          ? data.ram as RamInfo
          : {};

      const disks = Array.isArray(data.disks)
        ? data.disks.filter(
            (item): item is HardwareItem =>
              item !== null &&
              typeof item === 'object' &&
              !Array.isArray(item)
          )
        : [];

      const record: AuditData = {
        host: textValue(data.host),

        manufacturer: textValue(data.manufacturer),
        model: textValue(data.model),
        serial: textValue(data.serial),
        product_type: textValue(data.product_type),

        part_number: textValue(data.part_number),
        system_uuid: textValue(data.system_uuid),
        hwid: textValue(data.hwid),
        imei: textValue(data.imei),

        os_version: textValue(data.os_version),
        kernel: textValue(data.kernel),

        cpu: textValue(data.cpu),
        cpu_info: cpuInfo,

        ram,
        disks,

        collected_at: textValue(data.collected_at),
      };

      setAudit(record);

      setMessageType('success');

      setMessage(
        'Audit collected successfully. Review the information before submitting it to AWS.'
      );

    } catch (error) {
      setMessageType('error');

      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to collect audit information.'
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
      /*
       * These fields match the existing DeviceAudit
       * submission in your Amplify application.
       *
       * Extend the Amplify schema before submitting
       * additional fields such as asset tags, notes,
       * HWID, IMEI or detailed hardware objects.
       */

      const result =
        await client.models.DeviceAudit.create({
          Host: audit.host,
          Make: audit.manufacturer,
          Model: audit.model,
          Serial: audit.serial,

          OsVersion: audit.os_version,
          Kernel: audit.kernel,
          CPU: audit.cpu,

          Ram: JSON.stringify(audit.ram),

          Storage: JSON.stringify(audit.disks),

          AuditTime:
            audit.collected_at ||
            new Date().toISOString(),
        });

      if (result.errors?.length || !result.data) {
        throw new Error(
          result.errors
            ?.map((error) => error.message)
            .join('; ') ||
            'Unable to save the audit to AWS.'
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


  const additionalRows: Array<[string, unknown]> = audit
    ? [
        ['Hostname', audit.host],
        ['Manufacturer', audit.manufacturer],
        ['Product Type', audit.product_type],
        ['Part Number', audit.part_number],
        ['System UUID / HWID', audit.system_uuid],
        ['IMEI', audit.imei],
        ['Operating System', audit.os_version],
        ['Kernel', audit.kernel],
        [
          'Collected Time',
          audit.collected_at
            ? new Date(
                audit.collected_at
              ).toLocaleString()
            : '',
        ],
      ]
    : [];


  return (
    <main style={styles.page}>
      <style>
        {`
          * {
            box-sizing: border-box;
          }

          html, body, #root {
            min-height: 100%;
            margin: 0;
          }

          body {
            overflow-x: hidden;
          }

          button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          input, textarea {
            max-width: 100%;
          }

          .audit-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 16px;
            padding-bottom: 20px;
            margin-bottom: 22px;
            border-bottom: 1px solid #e2e8f0;
          }

          .status {
            padding: 12px 15px;
            margin-top: 18px;
            border-radius: 9px;
            font-size: 13px;
            line-height: 1.7;
            overflow-wrap: anywhere;
          }

          .status-success {
            color: #166534;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
          }

          .status-error {
            color: #991b1b;
            background: #fef2f2;
            border: 1px solid #fecaca;
          }

          .status-info {
            color: #1e40af;
            background: #eff6ff;
            border: 1px solid #bfdbfe;
          }

          .audit-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 14px;
            margin-top: 24px;
            padding-top: 18px;
            border-top: 1px solid #e2e8f0;
            color: #94a3b8;
            font-size: 12px;
          }
        `}
      </style>

      <div style={styles.container}>
        <header className="audit-header">
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '30px',
                fontWeight: 750,
                letterSpacing: '-0.7px',
                color: '#172554',
              }}
            >
              Computer Audit
            </h1>

            <p
              style={{
                margin: '5px 0 0',
                color: '#64748b',
                fontSize: '13px',
              }}
            >
              Hardware inventory and asset management
            </p>
          </div>

          <div
            style={{
              padding: '10px 13px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '9px',
              fontSize: '12px',
              color: '#475569',
              overflowWrap: 'anywhere',
            }}
          >
            Signed in as{' '}
            <strong>
              {user?.signInDetails?.loginId ??
                'Authenticated user'}
            </strong>
          </div>
        </header>


        <section style={styles.card}>
          <h2 style={styles.heading}>
            Audit Collection
          </h2>

          <p style={styles.description}>
            Connect to the local Ubuntu audit agent
            to retrieve the computer's hardware information.
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
              className={`status status-${messageType}`}
            >
              {message}
            </div>
          )}
        </section>


        {audit && (
          <>
            <section style={styles.card}>
              <h2 style={styles.heading}>
                System Information
              </h2>

              <p style={styles.description}>
                Primary identification details for
                this computer.
              </p>

              <AuditTable
                rows={[
                  ['Hostname', audit.host],
                  ['Product Type', audit.product_type],
                  ['Manufacturer', audit.manufacturer],
                  ['Model', audit.model],
                  ['Part Number', audit.part_number],
                  ['Serial Number', audit.serial],
                  ['CPU', audit.cpu],
                  [
                    'Total RAM',
                    audit.ram.total_gb !== undefined
                      ? `${audit.ram.total_gb} GB`
                      : '',
                  ],
                  [
                    'Storage Devices',
                    audit.disks.length,
                  ],
                ]}
              />
            </section>


            <HardwareInventory audit={audit} />


            <section style={styles.card}>
              <h2 style={styles.heading}>
                Additional Details
              </h2>

              <p style={styles.description}>
                System identifiers, operating system
                information and collection time.
              </p>

              <AuditTable rows={additionalRows} />
            </section>


            <CustomFieldsEditor
              fields={customFields}
              onChange={updateCustomFields}
            />


            <section style={styles.card}>
              <h2 style={styles.heading}>
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
            onClick={() => signOut?.()}
          >
            Sign Out
          </button>
        </footer>
      </div>
    </main>
  );
}


/* =========================================================
   Application entry point
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
