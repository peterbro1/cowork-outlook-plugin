import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import { GraphClient } from "../../src/auth/graph-client.js";
import { saveTokens } from "../../src/auth/token-store.js";
import type { AppConfig, TokenCache } from "../../src/types/config.js";

const TEST_CONFIG: AppConfig = {
  clientId: "test-client-id",
  tenantId: "test-tenant-id",
  scopes: ["User.Read", "Mail.ReadWrite", "offline_access"],
  tokenStorePath: "/tmp/tokens.json",
};

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const TOKEN_URL = "https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/token";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function makeTokenCache(overrides: Partial<TokenCache> = {}): TokenCache {
  return {
    accessToken: "test-access-token",
    refreshToken: "test-refresh-token",
    expiresAt: Date.now() + 3600_000,
    scope: "User.Read Mail.ReadWrite",
    ...overrides,
  };
}

describe("GraphClient", () => {
  let tempDir: string;
  let tokenPath: string;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  async function setupClient(tokenOverrides: Partial<TokenCache> = {}): Promise<GraphClient> {
    tempDir = await mkdtemp(join(tmpdir(), "graph-client-"));
    tokenPath = join(tempDir, "tokens.json");
    await saveTokens(makeTokenCache(tokenOverrides), tokenPath);
    return new GraphClient(tokenPath, TEST_CONFIG);
  }

  describe("GET request", () => {
    it("adds auth header and Prefer header and returns parsed JSON", async () => {
      const client = await setupClient();
      let capturedHeaders: Record<string, string> = {};

      server.use(
        http.get(`${GRAPH_BASE}/me`, ({ request }) => {
          capturedHeaders = {
            authorization: request.headers.get("Authorization") || "",
            contentType: request.headers.get("Content-Type") || "",
            prefer: request.headers.get("Prefer") || "",
          };
          return HttpResponse.json({ displayName: "Test User" });
        }),
      );

      const data = await client.get("/me");

      expect(capturedHeaders.authorization).toBe("Bearer test-access-token");
      expect(capturedHeaders.prefer).toBe('IdType="ImmutableId"');
      expect(data.displayName).toBe("Test User");
    });
  });

  describe("POST request", () => {
    it("sends JSON body with auth and returns parsed JSON", async () => {
      const client = await setupClient();
      let capturedBody: unknown;
      let capturedHeaders: Record<string, string> = {};

      server.use(
        http.post(`${GRAPH_BASE}/me/messages`, async ({ request }) => {
          capturedBody = await request.json();
          capturedHeaders = {
            authorization: request.headers.get("Authorization") || "",
            contentType: request.headers.get("Content-Type") || "",
          };
          return HttpResponse.json({ id: "draft-1", isDraft: true });
        }),
      );

      const body = { subject: "Hello", body: { contentType: "text", content: "Hi" } };
      const data = await client.post("/me/messages", body);

      expect(capturedHeaders.authorization).toBe("Bearer test-access-token");
      expect(capturedHeaders.contentType).toBe("application/json");
      expect(capturedBody).toEqual(body);
      expect(data.id).toBe("draft-1");
    });
  });

  describe("PATCH request", () => {
    it("sends JSON body with auth and returns parsed JSON", async () => {
      const client = await setupClient();
      let capturedBody: unknown;

      server.use(
        http.patch(`${GRAPH_BASE}/me/messages/123`, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({ id: "123", isRead: true });
        }),
      );

      const body = { isRead: true };
      const data = await client.patch("/me/messages/123", body);

      expect(capturedBody).toEqual(body);
      expect(data.isRead).toBe(true);
    });
  });

  describe("auto-refresh", () => {
    it("refreshes expired token before making request", async () => {
      const client = await setupClient({ expiresAt: Date.now() - 10_000 });

      server.use(
        http.post(TOKEN_URL, () => {
          return HttpResponse.json({
            access_token: "refreshed-access-token",
            refresh_token: "refreshed-refresh-token",
            expires_in: 3600,
            scope: "User.Read Mail.ReadWrite",
            token_type: "Bearer",
          });
        }),
        http.get(`${GRAPH_BASE}/me`, ({ request }) => {
          const auth = request.headers.get("Authorization");
          return HttpResponse.json({ token: auth });
        }),
      );

      const data = await client.get("/me");
      expect(data.token).toBe("Bearer refreshed-access-token");
    });
  });

  describe("no tokens", () => {
    it("throws when no tokens are available", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "graph-client-"));
      tokenPath = join(tempDir, "tokens.json");
      const client = new GraphClient(tokenPath, TEST_CONFIG);

      await expect(client.get("/me")).rejects.toThrow("No tokens found");
    });
  });

  describe("concurrent refresh", () => {
    it("multiple concurrent requests share a single token refresh", async () => {
      const client = await setupClient({ expiresAt: Date.now() - 10_000 });
      let refreshCallCount = 0;

      server.use(
        http.post(TOKEN_URL, async () => {
          refreshCallCount++;
          await new Promise((r) => setTimeout(r, 50));
          return HttpResponse.json({
            access_token: "refreshed-token",
            refresh_token: "new-refresh-token",
            expires_in: 3600,
            scope: "User.Read Mail.ReadWrite",
            token_type: "Bearer",
          });
        }),
        http.get(`${GRAPH_BASE}/me`, ({ request }) => {
          return HttpResponse.json({ auth: request.headers.get("Authorization") });
        }),
      );

      const [r1, r2, r3] = await Promise.all([
        client.get("/me"),
        client.get("/me"),
        client.get("/me"),
      ]);

      expect(refreshCallCount).toBe(1);
      expect(r1.auth).toBe("Bearer refreshed-token");
      expect(r2.auth).toBe("Bearer refreshed-token");
      expect(r3.auth).toBe("Bearer refreshed-token");
    });

    it("second concurrent request waits for first refresh", async () => {
      const client = await setupClient({ expiresAt: Date.now() - 10_000 });

      server.use(
        http.post(TOKEN_URL, async () => {
          await new Promise((r) => setTimeout(r, 100));
          return HttpResponse.json({
            access_token: "delayed-refreshed-token",
            refresh_token: "new-refresh-token",
            expires_in: 3600,
            scope: "User.Read Mail.ReadWrite",
            token_type: "Bearer",
          });
        }),
        http.get(`${GRAPH_BASE}/me`, ({ request }) => {
          return HttpResponse.json({ auth: request.headers.get("Authorization") });
        }),
      );

      const [r1, r2] = await Promise.all([
        client.get("/me"),
        client.get("/me"),
      ]);

      expect(r1.auth).toBe("Bearer delayed-refreshed-token");
      expect(r2.auth).toBe("Bearer delayed-refreshed-token");
    });
  });

  describe("error response", () => {
    it("throws on 401 response from Graph API", async () => {
      const client = await setupClient();

      server.use(
        http.get(`${GRAPH_BASE}/me`, () => {
          return HttpResponse.json(
            { error: { code: "InvalidAuthenticationToken", message: "Access token has expired." } },
            { status: 401 },
          );
        }),
      );

      await expect(client.get("/me")).rejects.toThrow("Graph API error 401");
    });
  });

  describe("getPaginated", () => {
    it("follows @odata.nextLink across pages", async () => {
      const client = await setupClient();

      server.use(
        http.get(`${GRAPH_BASE}/me/messages`, ({ request }) => {
          const url = new URL(request.url);
          const skip = url.searchParams.get("$skip");

          if (!skip) {
            return HttpResponse.json({
              value: [{ id: "1" }, { id: "2" }],
              "@odata.nextLink": `${GRAPH_BASE}/me/messages?$skip=2&$top=2`,
            });
          } else if (skip === "2") {
            return HttpResponse.json({
              value: [{ id: "3" }, { id: "4" }],
              "@odata.nextLink": `${GRAPH_BASE}/me/messages?$skip=4&$top=2`,
            });
          } else {
            return HttpResponse.json({
              value: [{ id: "5" }],
            });
          }
        }),
      );

      const items = await client.getPaginated("/me/messages");

      expect(items).toHaveLength(5);
      expect(items.map((i: any) => i.id)).toEqual(["1", "2", "3", "4", "5"]);
    });

    it("stops at maxItems limit", async () => {
      const client = await setupClient();
      let requestCount = 0;

      server.use(
        http.get(`${GRAPH_BASE}/me/messages`, ({ request }) => {
          requestCount++;
          const url = new URL(request.url);
          const skip = parseInt(url.searchParams.get("$skip") || "0", 10);
          const items = Array.from({ length: 30 }, (_, i) => ({ id: `${skip + i + 1}` }));
          return HttpResponse.json({
            value: items,
            "@odata.nextLink": `${GRAPH_BASE}/me/messages?$skip=${skip + 30}&$top=30`,
          });
        }),
      );

      const items = await client.getPaginated("/me/messages", 50);

      expect(items).toHaveLength(50);
      expect(items[0].id).toBe("1");
      expect(items[49].id).toBe("50");
    });

    it("handles single page (no nextLink)", async () => {
      const client = await setupClient();

      server.use(
        http.get(`${GRAPH_BASE}/me/events`, () => {
          return HttpResponse.json({
            value: [{ id: "evt-1" }, { id: "evt-2" }, { id: "evt-3" }],
          });
        }),
      );

      const items = await client.getPaginated("/me/events");

      expect(items).toHaveLength(3);
      expect(items.map((i: any) => i.id)).toEqual(["evt-1", "evt-2", "evt-3"]);
    });

    it("handles empty first page", async () => {
      const client = await setupClient();

      server.use(
        http.get(`${GRAPH_BASE}/me/events`, () => {
          return HttpResponse.json({ value: [] });
        }),
      );

      const items = await client.getPaginated("/me/events");

      expect(items).toHaveLength(0);
    });
  });
});
