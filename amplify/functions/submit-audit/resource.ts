import { defineFunction } from "@aws-amplify/backend";

export const submitAudit = defineFunction({
  name: "submit-audit",
  entry: "./handler.ts",
  runtime: 22,
  timeoutSeconds: 15,
});
