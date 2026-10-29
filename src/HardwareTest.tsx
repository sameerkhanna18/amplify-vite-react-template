import { useState } from 'react';

type HardwareTestProps = { signOut?: () => void; };

export default function HardwareTest({ signOut, }: HardwareTestProps) { const [testStatus, setTestStatus] = useState('Not started');

return ( <main style={{ minHeight: '100vh', padding: '28px', background: '#f4f7fb', color: '#172033', fontFamily: 'Arial, sans-serif', }}

>
  <div
    style={{
      maxWidth: '1200px',
      margin: '0 auto',
    }}
  >
    <header style={{ marginBottom: '28px' }}>
      <h1 style={{ color: '#172554' }}>
        Hardware Tests
      </h1>

      <p style={{ color: '#64748b' }}>
        Test your computer hardware and review diagnostic results.
      </p>
    </header>

    <section
      style={{
        padding: '24px',
        marginBottom: '20px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
      }}
    >
      <h2>RAM Test</h2>

      <p style={{ color: '#64748b', lineHeight: 1.6 }}>
        Run a memory diagnostic to investigate RAM stability
        and potential memory errors.
      </p>

      <div
        style={{
          padding: '14px',
          margin: '18px 0',
          background: '#f8fafc',
          borderRadius: '8px',
        }}
      >
        <strong>Test status:</strong> {testStatus}
      </div>

      <button
        type="button"
        onClick={() =>
          setTestStatus(
            'Not available yet — RAM diagnostic engine required',
          )
        }
        style={{
          padding: '12px 20px',
          background: '#2563eb',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        Start RAM Test
      </button>

      <p
        style={{
          marginTop: '16px',
          color: '#64748b',
          fontSize: '13px',
          lineHeight: 1.6,
        }}
      >
        Note: This page is currently a user interface only.
        A diagnostic engine must be connected before a real
        RAM test can run.
      </p>
    </section>

    <section
      style={{
        padding: '24px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
      }}
    >
      <h2>Additional Tests</h2>

      <p style={{ color: '#64748b' }}>
        More hardware diagnostics can be added here.
      </p>

      <ul style={{ lineHeight: 2 }}>
        <li>CPU Test — Coming soon</li>
        <li>Storage Test — Coming soon</li>
        <li>Display Test — Coming soon</li>
        <li>Keyboard Test — Coming soon</li>
      </ul>
    </section>

    <div style={{ marginTop: '24px' }}>
      <button
        type="button"
        onClick={signOut}
        style={{
          padding: '10px 16px',
          background: '#ffffff',
          color: '#334155',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          cursor: 'pointer',
        }}
      >
        Sign Out
      </button>
    </div>
  </div>
</main>


); }
