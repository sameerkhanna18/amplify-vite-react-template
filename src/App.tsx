    import { useEffect, useState } from 'react';
    import { Authenticator } from '@aws-amplify/ui-react';
    import { generateClient } from 'aws-amplify/data';
    import type { Schema } from '../amplify/data/resource';
    import '@aws-amplify/ui-react/styles.css';

    const client = generateClient<Schema>();

    // ============================================================
    // Types
    // ============================================================

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

    // ============================================================
    // Constants
    // ============================================================

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

    // ============================================================
    // Styling
    // ============================================================

    const styles = {
      page: {
        width: '100%',
        minHeight: '100vh',
        boxSizing: 'border-box' as const,
        background: '#f4f7fb',
        color: '#172033',
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
        padding: '30px 0 45px',
      },

      container: {
        width: '94%',
        maxWidth: '1800px',
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
        margin: '0 0 8px',
        color: '#172554',
        overflowWrap: 'anywhere' as const,
      },

      sectionDescription: {
        margin: '0 0 22px',
        fontSize: '13px',
        lineHeight: 1.7,
        color: '#64748b',
      },

      button: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        background: '#1d4ed8',
        color: '#ffffff',
        border: '1px solid #1d4ed8',
        borderRadius: '8px',
        padding: '12px 20px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'background 0.2s ease',
      },

      secondaryButton: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
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
        overflowY: 'visible' as const,
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
        width: '230px',
        minWidth: '170px',
        padding: '13px 15px',
        textAlign: 'left' as const,
        verticalAlign: 'top' as const,
        background: '#f8fafc',
        borderBottom: '1px solid #e8edf4',
        color: '#475569',
        fontWeight: 600,
        overflowWrap: 'anywhere' as const,
      },

      valueCell: {
        padding: '13px 15px',
        textAlign: 'left' as const,
        verticalAlign: 'top' as const,
        borderBottom: '1px solid #e8edf4',
        color: '#0f172a',
        lineHeight: 1.65,
        whiteSpace: 'pre-wrap' as const,
        overflowWrap: 'anywhere' as const,
        wordBreak: 'break-word' as const,
      },
    };

    // ============================================================
    // Utility functions
    // ============================================================

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

    // ============================================================
    // Reusable section heading
    // ============================================================

    function SectionHeading({
      title,
      description,
    }: {
      title: string;
      description?: string;
    }) {
      return (
        <div style={{ marginBottom: 22 }}>
          <h2 style={styles.sectionTitle}>{title}</h2>

          {description && (
            <p
              style={{
                ...styles.sectionDescription,
                marginBottom: 0,
                marginTop: 7,
              }}
            >
              {description}
            </p>
          )}
        </div>
      );
    }

    // ============================================================
    // System information
    // ============================================================

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
                <tr
                  key={key}
                  style={{
                    background:
                      index % 2 === 0
                        ? '#ffffff'
                        : '#fcfdff',
                  }}
                >
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

    // ============================================================
    // Hardware inventory
    // ============================================================

    function HardwareInventory({
      audit,
    }: {
      audit: AuditRecord;
    }) {
      const ramInfo = getRamInfo(audit.Ram);
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
          label: 'Size / Capacity',
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
              'current_speed',
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
          <SectionHeading
            title="Hardware Inventory"
            description="Hardware components are shown across the columns. Attributes are listed down the rows."
          />

          {components.length > 0 ? (
            <div style={styles.tableWrapper}>
              <table
                style={{
                  ...styles.table,
                  minWidth: `${Math.max(
                    900,
                    190 + components.length * 190
                  )}px`,
                }}
              >
                <thead>
                  <tr>
                    <th
                      scope="col"
                      style={{
                        ...styles.labelCell,
                        background: '#edf3ff',
                        color: '#1e3a8a',
                        borderBottom: '1px solid #dbe5f5',
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
                          minWidth: '190px',
                          background: '#edf3ff',
                          color: '#1e3a8a',
                          fontWeight: 700,
                          borderBottom: '1px solid #dbe5f5',
                        }}
                      >
                        {component.title}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr
                      key={row.label}
                      style={{
                        background:
                          rowIndex % 2 === 0
                            ? '#ffffff'
                            : '#fafcff',
                      }}
                    >
                      <th
                        scope="row"
                        style={styles.labelCell}
                      >
                        {row.label}
                      </th>

                      {components.map(
                        (component, componentIndex) => {
                          const value = row.getValue(
                            component.item,
                            component.category
                          );

                          return (
                            <td
                              key={`${row.label}-${componentIndex}`}
                              style={styles.valueCell}
                            >
                              {value || '—'}
                            </td>
                          );
                        }
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              style={{
                padding: '24px',
                border: '1px dashed #cbd5e1',
                borderRadius: '9px',
                textAlign: 'center',
                color: '#64748b',
                fontSize: '14px',
              }}
            >
              No individual CPU, RAM module, or disk details
              were returned by the audit service.
            </div>
          )}

          {ramInfo && (
            <div className="ram-summary-grid">
              <div className="ram-summary-item">
                <span>Total RAM</span>
                <strong>
                  {ramInfo.total_gb !== undefined
                    ? `${ramInfo.total_gb} GB`
                    : 'Unknown'}
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
                  {ramInfo.slots_used ?? 'Unknown'}
                </strong>
              </div>

              <div className="ram-summary-item">
                <span>Slots Available</span>
                <strong>
                  {ramInfo.slots_available ?? 'Unknown'}
                </strong>
              </div>
            </div>
          )}
        </section>
      );
    }

    // ============================================================
    // Custom asset fields
    // ============================================================

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
        {
          key: 'assetTag',
          label: 'Asset Tag',
        },
        {
          key: 'assignedUser',
          label: 'Assigned User',
        },
        {
          key: 'department',
          label: 'Department',
        },
        {
          key: 'location',
          label: 'Location',
        },
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
        minWidth: 0,
        padding: '11px 12px',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        fontSize: '14px',
        fontFamily: 'inherit',
        color: '#0f172a',
        background: '#ffffff',
        outlineColor: '#2563eb',
      };

      return (
        <section style={styles.card}>
          <SectionHeading
            title="Custom Asset Fields"
            description="Add organisational information such as ownership, location, and warranty details. These fields are currently saved in this browser only."
          />

          <div className="custom-fields-grid">
            {fieldDefinitions.map((field) => (
              <label
                key={field.key}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  minWidth: 0,
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#475569',
                  gridColumn: field.multiline
                    ? '1 / -1'
                    : undefined,
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
                    placeholder="Add any additional notes..."
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
                    placeholder={
                      field.type === 'date'
                        ? undefined
                        : `Enter ${field.label.toLowerCase()}`
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

    // ============================================================
    // Main audit page
    // ============================================================

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
      const [busy, setBusy] = useState(false);

      const [messageType, setMessageType] = useState<
        'success' | 'info' | 'error' | ''
      >('');

      const [customFields, setCustomFields] =
        useState<CustomFields>(emptyCustomFields);

      // ----------------------------------------------------------
      // Load custom fields from local storage
      // ----------------------------------------------------------

      useEffect(() => {
        try {
          const saved = localStorage.getItem(
            CUSTOM_FIELDS_KEY
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
            'Custom fields were updated but could not be saved in this browser.'
          );
        }
      }

      // ----------------------------------------------------------
      // Load audit from Ubuntu service
      // ----------------------------------------------------------

      async function loadAudit() {
        setBusy(true);
        setMessage('');
        setMessageType('');
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

            Ram: ram as string | RamInfo,

            Storage:
              storage as
                | string
                | HardwareItem
                | HardwareItem[],

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

          // Remove raw aliases to avoid duplicate properties.
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
            'Audit loaded successfully. Review the information before submitting.'
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

      // ----------------------------------------------------------
      // Submit audit to AWS
      // ----------------------------------------------------------

      async function submitAudit() {
        if (!audit || busy) {
          return;
        }

        setBusy(true);
        setMessage('');
        setMessageType('');

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

      // ----------------------------------------------------------
      // System information rows
      // ----------------------------------------------------------

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

      // ----------------------------------------------------------
      // Render
      // ----------------------------------------------------------

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

              button {
                font-family: inherit;
              }

              button:disabled {
                cursor: not-allowed !important;
                opacity: 0.6;
              }

              button:not(:disabled):hover {
                filter: brightness(0.96);
              }

              .audit-section {
                margin-bottom: 22px;
              }

              .custom-fields-grid {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 20px;
              }

              .ram-summary-grid {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 14px;
                margin-top: 20px;
              }

              .ram-summary-item {
                display: flex;
                flex-direction: column;
                gap: 9px;
                min-width: 0;
                padding: 16px;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
              }

              .ram-summary-item span {
                font-size: 12px;
                color: #64748b;
                font-weight: 500;
              }

              .ram-summary-item strong {
                font-size: 19px;
                color: #172554;
                overflow-wrap: anywhere;
              }

              .audit-status {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                margin-top: 20px;
                padding: 14px 16px;
                border: 1px solid transparent;
                border-radius: 9px;
                font-size: 13px;
                line-height: 1.65;
                overflow-wrap: anywhere;
              }

              .audit-status.success {
                color: #166534;
                background: #f0fdf4;
                border-color: #bbf7d0;
              }

              .audit-status.info {
                color: #1e40af;
                background: #eff6ff;
                border-color: #bfdbfe;
              }

              .audit-status.error {
                color: #991b1b;
                background: #fef2f2;
                border-color: #fecaca;
              }

              .audit-hero {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 20px;
                padding: 30px;
                margin-bottom: 24px;
                background: linear-gradient(120deg, #172554, #1d4ed8);
                color: #ffffff;
                border-radius: 16px;
                box-shadow: 0 8px 24px rgba(30, 64, 175, 0.12);
              }

              .audit-hero h1 {
                margin: 0 0 9px;
                font-size: clamp(26px, 3vw, 36px);
                line-height: 1.2;
                font-weight: 750;
                letter-spacing: -0.7px;
              }

              .audit-hero p {
                margin: 0;
                font-size: 14px;
                line-height: 1.7;
                color: #dbeafe;
              }

              .audit-user {
                max-width: 100%;
                padding: 12px 15px;
                border: 1px solid rgba(255,255,255,0.22);
                border-radius: 9px;
                background: rgba(255,255,255,0.08);
                color: #ffffff;
                font-size: 13px;
                overflow-wrap: anywhere;
              }

              .audit-user span {
                display: block;
                margin-bottom: 4px;
                color: #bfdbfe;
                font-size: 11px;
              }

              .audit-collection-layout {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 20px;
              }

              .audit-collection-copy {
                flex: 1;
                min-width: 220px;
              }

              .audit-collection-copy p {
                margin: 8px 0 0;
                color: #64748b;
                font-size: 13px;
                line-height: 1.7;
              }

              .audit-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 14px;
                padding: 22px 0 0;
                margin-top: 28px;
                border-top: 1px solid #e2e8f0;
              }

              @media (max-width: 1000px) {
                .custom-fields-grid {
                  grid-template-columns: repeat(2, minmax(0, 1fr));
                }

                .ram-summary-grid {
                  grid-template-columns: repeat(2, minmax(0, 1fr));
                }
              }

              @media (max-width: 600px) {
                .audit-container {
                  width: 96% !important;
                }

                .audit-hero {
                  padding: 22px 18px;
                  border-radius: 12px;
                }

                .audit-card {
                  padding: 17px !important;
                }

                .custom-fields-grid {
                  grid-template-columns: minmax(0, 1fr);
                  gap: 17px;
                }

                .ram-summary-grid {
                  grid-template-columns: repeat(2, minmax(0, 1fr));
                  gap: 9px;
                }

                .ram-summary-item {
                  padding: 12px;
                }

                .ram-summary-item strong {
                  font-size: 17px;
                }

                .audit-collection-layout {
                  align-items: stretch;
                }

                .audit-load-button {
                  width: 100%;
                }

                .audit-footer {
                  align-items: flex-start;
                }
              }
            `}
          </style>

          <div
            className="audit-container"
            style={styles.container}
          >
            {/* Header */}

            <header className="audit-hero">
              <div>
                <h1>Computer Audit</h1>

                <p>
                  Hardware inventory and computer asset
                  management
                </p>
              </div>

              <div className="audit-user">
                <span>AUTHENTICATED USER</span>

                {user?.signInDetails?.loginId ??
                  'Authenticated user'}
              </div>
            </header>

            {/* Audit collection */}

            <section
              className="audit-card audit-section"
              style={styles.card}
            >
              <div className="audit-collection-layout">
                <div className="audit-collection-copy">
                  <h2 style={styles.sectionTitle}>
                    Audit Collection
                  </h2>

                  <p>
                    Retrieve system and hardware details
                    from your Ubuntu audit service.
                  </p>
                </div>

                <button
                  type="button"
                  className="audit-load-button"
                  style={styles.button}
                  onClick={loadAudit}
                  disabled={busy}
                >
                  {busy
                    ? 'Please wait...'
                    : 'Load Audit from Ubuntu'}
                </button>
              </div>

              {message && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`audit-status ${messageType}`}
                >
                  <span aria-hidden="true">
                    {messageType === 'success'
                      ? '✓'
                      : messageType === 'error'
                        ? '!'
                        : 'i'}
                  </span>

                  <span>{message}</span>
                </div>
              )}
            </section>

            {/* Audit results */}

            {audit && (
              <>
                {/* System information */}

                <section
                  className="audit-card audit-section"
                  style={styles.card}
                >
                  <SectionHeading
                    title="System Information"
                    description="General identification and operating system details for this computer."
                  />

                  <AuditTable rows={systemRows} />
                </section>

                {/* Hardware inventory */}

                <div className="audit-section">
                  <HardwareInventory audit={audit} />
                </div>

                {/* Custom fields */}

                <div className="audit-section">
                  <CustomFieldsEditor
                    fields={customFields}
                    onChange={updateCustomFields}
                  />
                </div>

                {/* Submit */}

                <section
                  className="audit-card audit-section"
                  style={styles.card}
                >
                  <SectionHeading
                    title="Submit Audit"
                    description="Save the collected computer information to your AWS database."
                  />

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 18,
                    }}
                  >
                    <p
                      style={{
                        flex: 1,
                        minWidth: 220,
                        margin: 0,
                        fontSize: 13,
                        color: '#64748b',
                        lineHeight: 1.7,
                      }}
                    >
                      Review the collected information before
                      submitting. Custom asset fields are
                      currently saved in this browser and
                      are not included in the AWS submission.
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
                  </div>
                </section>
              </>
            )}

            {/* Footer */}

            <footer className="audit-footer">
              <div
                style={{
                  fontSize: 12,
                  lineHeight: 1.7,
                  color: '#64748b',
                }}
              >
                <strong
                  style={{
                    display: 'block',
                    color: '#334155',
                    fontSize: 13,
                    marginBottom: 3,
                  }}
                >
                  Computer Audit System
                </strong>

                Hardware inventory and asset management
              </div>

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

    // ============================================================
    // Application entry point
    // ============================================================

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