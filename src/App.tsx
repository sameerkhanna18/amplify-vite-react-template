import React from 'react';
import SystemInformation from './components/systeminfo';

type AuditRecord = {
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

type AppProps = {
  audit: AuditRecord;
};

export default function App({ audit }: AppProps) {
  return (
    <main>
      <SystemInformation audit={audit} />
    </main>
  );
}
