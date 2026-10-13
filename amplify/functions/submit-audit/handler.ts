import type { APIGatewayProxyHandler } from "aws-lambda";
import {
  DynamoDBClient,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { randomUUID } from "node:crypto";

const dynamodb = new DynamoDBClient({});

const TABLE_NAME = process.env.DEVICE_AUDIT_TABLE;

export const handler: APIGatewayProxyHandler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin":
      "https://portable-audit-agent.d3io5lnwh2u6as.amplifyapp.com",
    "Vary": "Origin",
  };

  try {
    const claims = event.requestContext.authorizer?.claims;
    const sub = claims?.sub;
    const username =
      claims?.["cognito:username"] ?? claims?.email;

    if (!sub || !username) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: "Not authenticated" }),
      };
    }

    if (!TABLE_NAME) {
      throw new Error("DEVICE_AUDIT_TABLE is not configured");
    }

    const body = JSON.parse(event.body ?? "{}");

    const fields = [
      "Host",
      "Make",
      "Model",
      "OsVersion",
      "Kernel",
      "CPU",
      "Ram",
      "Storage",
    ];

    for (const field of fields) {
      if (
        typeof body[field] !== "string" ||
        body[field].length > 1000
      ) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            message: `Invalid field: ${field}`,
          }),
        };
      }
    }

    const now = new Date().toISOString();

    const item = {
      id: { S: randomUUID() },
      __typename: { S: "DeviceAudit" },
      Host: { S: body.Host },
      Make: { S: body.Make },
      Model: { S: body.Model },
      Serial: {
        S: typeof body.Serial === "string" ? body.Serial : "",
      },
      OsVersion: { S: body.OsVersion },
      Kernel: { S: body.Kernel },
      CPU: { S: body.CPU },
      Ram: { S: body.Ram },
      Storage: { S: body.Storage },
      AuditTime: { S: now },
      createdAt: { S: now },
      updatedAt: { S: now },
      owner: { S: `${sub}::${username}` },
    };

    await dynamodb.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: item,
        ConditionExpression: "attribute_not_exists(id)",
      }),
    );

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: "Audit saved successfully",
        auditId: item.id.S,
        auditTime: now,
      }),
    };
  } catch (error) {
    console.error("Audit submission failed", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Unable to save audit" }),
    };
  }
};
