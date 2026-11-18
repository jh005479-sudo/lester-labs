// Hardhat's public helpers still read Zod 3's error.errors and errorMap.
// Preserve the upstream schemas and RPC conversions, using Zod 4 diagnostics.
export * from "@nomicfoundation/hardhat-zod-utils";
import { z } from "zod";

export function validateUserConfigZodType(config, schema) {
  const result = schema.safeParse(config);
  return result.success ? [] : result.error.issues.map(({ path, message }) => ({ path, message }));
}

export function incompatibleFieldType(message = "Unexpected field") {
  return z.never({ error: message }).optional();
}
