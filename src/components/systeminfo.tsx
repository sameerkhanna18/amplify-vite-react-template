tsx
type AuditRecord = {
  product_type?: string;
  chassis_type?: string;
  manufacturer?: string;
  model?: string;
  serial?: string;
  part_number?: string;
  cpu?: string;
  cpu_info?: {
    model?: string;
  };
};

type SystemInformationProps = {
  audit?: AuditRecord;
};

export default function SystemInformation({
  audit,
}: SystemInformationProps) {
  const productType =
    audit?.product_type &&
    audit.product_type !== 'Unknown'
      ? audit.product_type
      : audit?.chassis_type === 'Notebook'
        ? 'Laptop'
        : audit?.chassis_type || '';

  const rows: [string, string][] = [
    ['Product Type', productType],
    [
      'CPU',
      audit?.cpu_info?.model || audit?.cpu || '',
    ],
    ['Manufacturer', audit?.manufacturer || ''],
    ['Model', audit?.model || ''],
    ['Serial Number', audit?.serial || ''],
    ['Part Number', audit?.part_number || ''],
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
