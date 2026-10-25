import {
  getCpuInventoryRow,
} from './cpu';

import type { CpuInfo } from './cpu';
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
  cpu_info: CpuInfo;
  ram: RamInfo;
  motherboard: HardwareItem;
  storage: HardwareItem[];
  display: HardwareItem[];
  wifi: HardwareItem[];
  imei: string;
  collected_at: string;
  additional_info: Record<string, unknown>;
};
function motherboardValue(
  motherboard: HardwareItem,
  ...keys: string[]
): string {
  for (const key of keys) {
    const item = motherboard[key];

    if (
      item !== undefined &&
      item !== null &&
      item !== ''
    ) {
      return String(item).trim();
    }
  }

  return '';
}
/* =========================================================
   Hardware components
   CPU and motherboard only
========================================================= */

function HardwareComponents({
  audit,
}: {
  audit: AuditRecord;
}) {
  const motherboard = audit.motherboard ?? {};

  const motherboardRow: unknown[] = [
    'Motherboard',

    motherboardValue(
      motherboard,
      'manufacturer',
      'vendor',
    ),

    motherboardValue(
      motherboard,
      'model',
      'product',
      'part_number',
    ),

    motherboardValue(
      motherboard,
      'serial',
      'serial_number',
    ),

    motherboardValue(
      motherboard,
      'type',
      'architecture',
    ) || audit.architecture,

    // CPU speed was previously shown in the motherboard row.
    String(
      audit.cpu_info.maximum_speed ||
      audit.cpu_info.speed ||
      audit.cpu_info.current_speed ||
      '',
    ),

    // CPU core count was previously shown in the motherboard row.
    audit.cpu_info.cores
      ? `${audit.cpu_info.cores} cores`
      : '',
  ];

  const cpuRow = getCpuInventoryRow(audit.cpu_info);

  const rows: Array<Array<unknown>> = [
    motherboardRow,
    cpuRow,
  ];

  return (
    <Section
      title="Hardware Components"
      description="Motherboard and processor specifications. Additional hardware components can be added later."
    >
      <InventoryTable rows={rows} />
    </Section>
  );
}
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
            'Product Type',
            audit.product_type &&
            audit.product_type !== 'Unknown'
              ? audit.product_type
              : audit.chassis_type,
          ],
          [
            'CPU',
            audit.cpu_info.model || audit.cpu,
          ],
          ['Manufacturer', audit.manufacturer],
          ['Model', audit.model],
          ['Serial Number', audit.serial],
          ['Part Number', audit.part_number],
        ]}
      />
    </Section>
  );
}
