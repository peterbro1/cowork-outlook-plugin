import { describe, it, expect, afterEach, vi } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm, readFile, mkdir, writeFile } from "node:fs/promises";
import {
  saveTokens,
  loadTokens,
  deleteTokens,
  isTokenExpired,
} from "../../src/auth/token-store.js";
import type { TokenCache } from "../../src/types/config.js";

function makeTokenCache(overrides: Partial<TokenCache> = {}): TokenCache {
  return {
    accessToken: "access-123",
    expiresAt: Date.now() + 3600_000,
    scope: "User.Read Mail.ReadWrite",
    ...overrides,
  };
}

describe("token-store", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe("saveTokens / loadTokens round-trip", () => {
    it("saves and loads tokens correctly", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "token-store-"));
      const filePath = join(tempDir, "tokens.json");
      const tokens = makeTokenCache();

      await saveTokens(tokens, filePath);
      const loaded = await loadTokens(filePath);

      expect(loaded).toEqual(tokens);
    });
  });

  describe("loadTokens", () => {
    it("returns null for missing file", async () => {
      const result = await loadTokens("/nonexistent/path/tokens.json");
      expect(result).toBeNull();
    });
  });

  describe("saveTokens", () => {
    it("creates parent directories if they do not exist", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "token-store-"));
      const filePath = join(tempDir, "nested", "deep", "tokens.json");
      const tokens = makeTokenCache();

      await saveTokens(tokens, filePath);
      const content = await readFile(filePath, "utf-8");

      expect(JSON.parse(content)).toEqual(tokens);
    });
  });

  describe("isTokenExpired", () => {
    it("detects expired tokens", () => {
      const tokens = makeTokenCache({ expiresAt: Date.now() - 1000 });
      expect(isTokenExpired(tokens)).toBe(true);
    });

    it("detects tokens expiring within the buffer", () => {
      const tokens = makeTokenCache({ expiresAt: Date.now() + 30_000 });
      // default buffer is 60s, so 30s from now is within buffer
      expect(isTokenExpired(tokens)).toBe(true);
    });

    it("detects valid tokens outside the buffer", () => {
      const tokens = makeTokenCache({ expiresAt: Date.now() + 120_000 });
      expect(isTokenExpired(tokens)).toBe(false);
    });

    it("respects custom buffer", () => {
      const tokens = makeTokenCache({ expiresAt: Date.now() + 5_000 });
      expect(isTokenExpired(tokens, 3_000)).toBe(false);
      expect(isTokenExpired(tokens, 10_000)).toBe(true);
    });
  });

  describe("deleteTokens", () => {
    it("removes the token file", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "token-store-"));
      const filePath = join(tempDir, "tokens.json");
      await saveTokens(makeTokenCache(), filePath);

      await deleteTokens(filePath);
      const loaded = await loadTokens(filePath);

      expect(loaded).toBeNull();
    });

    it("does not throw if file does not exist", async () => {
      await expect(deleteTokens("/nonexistent/tokens.json")).resolves.not.toThrow();
    });
  });
});
