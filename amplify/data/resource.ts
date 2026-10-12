import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

const schema = a.schema({
  DeviceAudit: a
    .model({
      Host: a.string(),
      Make: a.string(),
      Model: a.string(),
      Serial: a.string(),
      OsVersion: a.string(),
      Kernel: a.string(),
      CPU: a.string(),
      Ram: a.string(),
      Storage: a.string(),
      AuditTime: a.datetime(),
    })
    .authorization((allow) => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});
