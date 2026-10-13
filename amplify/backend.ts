import { defineBackend } from "@aws-amplify/backend";
import { CfnOutput } from "aws-cdk-lib";
import {
  AuthorizationType,
  CognitoUserPoolsAuthorizer,
  Cors,
  LambdaIntegration,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import { CfnFunction } from "aws-cdk-lib/aws-lambda";

import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { submitAudit } from "./functions/submit-audit/resource";

const backend = defineBackend({
  auth,
  data,
  submitAudit,
});

// Reference the existing Amplify-generated table.
const auditTable = backend.data.resources.tables["DeviceAudit"];

const lambda = backend.submitAudit.resources.lambda;

// Grant the Lambda permission to write to DynamoDB.
auditTable.grantWriteData(lambda);

// Configure the table name through the CloudFormation resource.
const lambdaResource = lambda.node.defaultChild as CfnFunction;

lambdaResource.addPropertyOverride(
  "Environment.Variables.DEVICE_AUDIT_TABLE",
  auditTable.tableName,
);

// Create a separate stack for the agent API.
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

// Require authentication through the existing Cognito User Pool.
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
