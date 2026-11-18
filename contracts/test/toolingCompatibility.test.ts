import assert from "node:assert/strict";
import { createHardhatRuntimeEnvironment } from "hardhat/hre";
import { rpcData, rpcQuantity, validateParams } from "@nomicfoundation/hardhat-zod-utils/rpc";
import config from "../hardhat.config.js";

describe("Hardhat validation with Zod 4", () => {
  it("reports invalid network URLs, incompatible compilers and plugin settings at their paths", async () => {
    // Model an untyped project configuration loaded by the CLI.
    const invalid = JSON.parse(`{
      "networks": { "example": { "type": "http", "url": "invalid" } },
      "solidity": { "version": "0.8.24", "compilers": [] },
      "test": { "mocha": { "rootHooks": { "afterEach": 42 } } }
    }`);
    await assert.rejects(createHardhatRuntimeEnvironment({ ...config, ...invalid }), (error: Error) => {
      assert.match(error.message, /config\.networks\.example\.url/);
      assert.match(error.message, /config\.solidity\.compilers: This field is incompatible/);
      assert.match(error.message, /config\.test\.mocha\.rootHooks\.afterEach/);
      return true;
    });
  });

  it("decodes valid RPC values and rejects malformed parameters", () => {
    assert.deepEqual(validateParams(["0x2a", "0xab"], rpcQuantity, rpcData), [42n, Uint8Array.of(0xab)]);
    assert.throws(() => validateParams(["invalid"], rpcQuantity), /valid RPC quantity/);
  });
});
