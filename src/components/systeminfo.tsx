// systeminfo.tsx

import React from 'react';

export type SystemInfoAudit = {
  product_type: string;
  chassis_type: string;
  manufacturer: string;
  model: string;
  serial: string;
  part_number: string;
  cpu: string;
  cpu_info: {
    model?: string;
    [key: string]: unknown;
  };
};

type SystemInformationProps = {
  audit: SystemInfoAudit;
};

export default function SystemInformation({
  audit,
}: SystemInformationProps) {
  const productType =
    audit.product_type &&
    audit.product_type !== 'Unknown'
      ? audit.product_type
      : audit.chassis_type;

  const cpu =
    audit.cpu_info?.model ||
    audit.cpu ||
    '';

  const rows = [
    ['Product Type', productType],
    ['CPU', cpu],
    ['Manufacturer', audit.manufacturer],
    ['Model', audit.model],
    ['Serial Number', audit.serial],
    ['Part Number', audit.part_number],
  ];

  return (
    <section className="system-information">
      <h2>System Information</h2>

      <p>
        Computer identification and primary hardware
        specifications.
      </p>

      <table>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{value || 'Unavailable'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
