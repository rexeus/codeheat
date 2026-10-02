import { describe, expect, it } from "vitest";

import { isContractFile } from "./contract-files.js";

describe("isContractFile", () => {
  it.each([
    "api/main.tsp",
    "proto/user.proto",
    "schema.graphql",
    "queries/Orders.gql",
    "events/order.avsc",
    "idl/service.thrift",
    "model/shop.smithy",
    "Models/USER.PROTO",
  ])("recognizes the interface definition %s", (path) => {
    expect(isContractFile(path)).toBe(true);
  });

  it.each([
    "schemas/user.schema.json",
    "order.schema.json",
    "openapi.yaml",
    "docs/openapi.yml",
    "api/openapi.json",
    "api/openapi.v3.yaml",
    "asyncapi.yaml",
    "events/asyncapi.2.json",
    "swagger.json",
    "Swagger.YML",
  ])("recognizes the schema or API description %s", (path) => {
    expect(isContractFile(path)).toBe(true);
  });

  it.each([
    "src/app.ts",
    "package.json",
    "tsconfig.json",
    "schema.json",
    "docker-compose.yaml",
    "openapi-generator.yaml",
    "my-openapi.yaml",
    "openapi.ts",
    "openapi.md",
    "swagger-ui.json",
    "proto",
    ".proto",
    "notes.tsp.md",
    "api.protobuf",
    "schema.json.bak",
  ])("leaves %s to the language list", (path) => {
    expect(isContractFile(path)).toBe(false);
  });
});
