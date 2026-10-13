import { useState } from "react";
import { Authenticator } from "@aws-amplify/ui-react";
import { fetchAuthSession } from "aws-amplify/auth";
import "@aws-amplify/ui-react/styles.css";

const AGENT_URL = "http://127.0.0.1:8765";
const API_URL =
  "https://6on18j0ihi.execute-api.eu-west-2.amazonaws.com/prod/audits";

interface AuditResult {
  Host: string;
  Make: string;
  Model: string;
  Serial: string;
  OsVersion: string;
  Kernel: string;
  CPU: string;
  Ram: string;
  Storage: string;
  AuditTime: string;
}

function App() {
  const [agentToken, setAgentToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [audit, setAudit] = useState<AuditResult | null>(null);

  async function runAudit() {
    setLoading(true);
    setMessage("");
    setAudit(null);

    try {
      // 1. Get the signed-in user's Cognito ID token.
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      if (!idToken) {
        throw new Error(
          "Your session has no ID token. Please sign in again."
        );
      }

      // 2. Ask the local Python agent to collect device information.
      const agentResponse = await fetch(`${AGENT_URL}/audit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Agent-Token": agentToken.trim(),
        },
        body: JSON.stringify({}),
      });

      const agentData = await agentResponse.json();

      if (!agentResponse.ok) {
        throw new Error(
          agentData.message ?? "The local agent failed."
        );
      }

      const deviceAudit = agentData as AuditResult;

      // 3. Enforce the mandatory serial number in the frontend.
      if (
        typeof deviceAudit.Serial !== "string" ||
        !deviceAudit.Serial.trim()
      ) {
        throw new Error(
          "No valid hardware serial number was collected. " +
          "The audit has not been submitted."
        );
      }

      // 4. Submit the audit to the existing Cognito-protected API.
      const apiResponse = await fetch(API_URL, {
        method: "POST",
        headers: {
          Authorization: idToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(deviceAudit),
      });

      const apiData = await apiResponse.json().catch(() => ({}));

      if (!apiResponse.ok) {
        throw new Error(
          apiData.message ??
          `AWS rejected the audit (HTTP ${apiResponse.status}).`
        );
      }

      // 5. Display the successful result.
      setAudit(deviceAudit);
      setMessage(
        `Audit submitted successfully. Audit ID: ${
          apiData.auditId ?? "created"
        }`
      );
    } catch (error) {
      console.error("Device audit failed:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Authenticator>
      {({ signOut, user }) => (
        <main
          style={{
            maxWidth: "760px",
            margin: "40px auto",
            padding: "24px",
            fontFamily: "Arial, sans-serif",
          }}
        >
          <h1>Portable Device Audit</h1>

          <p>
            Signed in as:{" "}
            {user?.signInDetails?.loginId ?? "Authenticated user"}
          </p>

          <section
            style={{
              marginTop: "28px",
              padding: "20px",
              border: "1px solid #ddd",
              borderRadius: "8px",
            }}
          >
            <h2>Run Device Audit</h2>

            <p>
              Connect your USB audit agent and ensure its local
              service is running.
            </p>

            <label
              htmlFor="agent-token"
              style={{ display: "block", marginBottom: "8px" }}
            >
              Agent pairing token
            </label>

            <input
              id="agent-token"
              type="password"
              autoComplete="off"
              value={agentToken}
              onChange={(event) => setAgentToken(event.target.value)}
              placeholder="Paste the token from the agent terminal"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px",
                marginBottom: "16px",
              }}
            />

            <button
              onClick={runAudit}
              disabled={loading || !agentToken.trim()}
              style={{
                padding: "12px 20px",
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? "Auditing..." : "Run Device Audit"}
            </button>
          </section>

          {message && (
            <p
              role="status"
              style={{
                marginTop: "20px",
                overflowWrap: "anywhere",
              }}
            >
              {message}
            </p>
          )}

          {audit && (
            <section style={{ marginTop: "24px" }}>
              <h2>Collected Device Information</h2>

              <dl>
                {Object.entries(audit).map(([key, value]) => (
                  <div
                    key={key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "140px 1fr",
                      gap: "12px",
                      padding: "8px 0",
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    <dt>
                      <strong>{key}</strong>
                    </dt>
                    <dd
                      style={{
                        margin: 0,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <button
            onClick={signOut}
            style={{ marginTop: "28px", padding: "10px 16px" }}
          >
            Sign out
          </button>
        </main>
      )}
    </Authenticator>
  );
}

export default App;

