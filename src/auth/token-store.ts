import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { TokenCache } from "../types/config.js";

export async function saveTokens(
  tokenCache: TokenCache,
  filePath: string,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(tokenCache), "utf-8");
}

export async function loadTokens(filePath: string): Promise<TokenCache | null> {
  try {
    const data = await readFile(filePath, "utf-8");
    return JSON.parse(data) as TokenCache;
  } catch {
    return null;
  }
}

export async function deleteTokens(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    // ignore if file doesn't exist
  }
}

export function isTokenExpired(
  tokenCache: TokenCache,
  bufferMs: number = 60_000,
): boolean {
  return Date.now() + bufferMs >= tokenCache.expiresAt;
}
