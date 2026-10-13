import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { submitAudit } from "./functions/submit-audit/resource";

import {
  AuthorizationType,
  CognitoUserPoolsAuthorizer,
  Cors,
  LambdaIntegration,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";

import { CfnOutput } from "aws-cdk-lib";

const backend = defineBackend({
  auth,
  data,
  submitAudit,
});

// Existing Amplify-generated DeviceAudit table.
const auditTable = backend.data.resources.tables["DeviceAudit"];

const lambda = backend.submitAudit.resources.lambda;

// Grant the Lambda permission to write audit records.
auditTable.grantWriteData(lambda);

lambda.addEnvironment("DEVICE_AUDIT_TABLE", auditTable.tableName);

// Create a separate stack for the REST API.
const apiStack = backend.createStack("device-audit-api");

const api = new RestApi(apiStack, "DeviceAuditApi", {
  restApiName: "DeviceAudit-Agent-API",
  deployOptions: {
    stageName: "prod",
  },
  defaultCorsPreflightOptions: {
    allowOrigins: Cors.ALL_ORIGINS,
    allowMethods: ["POST", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
  },
});

// Protect the endpoint with Cognito authentication.
const authorizer = new CognitoUserPoolsAuthorizer(
  apiStack,
  "DeviceAuditCognitoAuthorizer",
  {
    cognitoUserPools: [backend.auth.resources.userPool],
  },
);

const audits = api.root.addResource("audits");

audits.addMethod(
  "POST",
  new LambdaIntegration(lambda),
  {
    authorizationType: AuthorizationType.COGNITO,
    authorizer,
  },
);

new CfnOutput(apiStack, "DeviceAuditApiUrl", {
  value: api.url,
});