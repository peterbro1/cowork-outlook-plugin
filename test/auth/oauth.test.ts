import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupServer as setupMswServer } from "msw/node";
import { http, HttpResponse } from "msw";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  refreshToken,
  startCallbackServer,
  runAuthFlow,
  OAuthError,
} from "../../src/auth/oauth.js";
import type { AppConfig } from "../../src/types/config.js";

const TEST_CONFIG: AppConfig = {
  clientId: "test-client-id",
  tenantId: "test-tenant",
  scopes: ["offline_access", "User.Read", "Mail.ReadWrite"],
  tokenStorePath: "/tmp/test-tokens.json",
};

const TOKEN_URL = "https://login.microsoftonline.com/test-tenant/oauth2/v2.0/token";

const mswServer = setupMswServer();

beforeAll(() => mswServer.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

describe("PKCE helpers", () => {
  it("generateCodeVerifier returns a base64url string of correct length", () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generateCodeChallenge returns a different base64url string", () => {
    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);
    expect(challenge).not.toBe(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("same verifier always produces the same challenge", () => {
    const verifier = "test-verifier-12345678901234567890123456789012";
    const c1 = generateCodeChallenge(verifier);
    const c2 = generateCodeChallenge(verifier);
    expect(c1).toBe(c2);
  });

  it("generateState returns a hex string", () => {
    const state = generateState();
    expect(state).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("buildAuthorizationUrl", () => {
  it("builds the correct authorization URL with PKCE params", () => {
    const url = buildAuthorizationUrl(TEST_CONFIG, "http://localhost:3000/callback", "test-challenge", "test-state");
    const parsed = new URL(url);

    expect(parsed.origin).toBe("https://login.microsoftonline.com");
    expect(parsed.pathname).toBe("/test-tenant/oauth2/v2.0/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("redirect_uri")).toBe("http://localhost:3000/callback");
    expect(parsed.searchParams.get("response_mode")).toBe("query");
    expect(parsed.searchParams.get("scope")).toBe("offline_access User.Read Mail.ReadWrite");
    expect(parsed.searchParams.get("code_challenge")).toBe("test-challenge");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("state")).toBe("test-state");
  });
});

describe("exchangeCodeForTokens", () => {
  it("exchanges code for tokens via PKCE (no client_secret)", async () => {
    mswServer.use(
      http.post(TOKEN_URL, async ({ request }) => {
        const body = await request.text();
        const params = new URLSearchParams(body);

        expect(params.get("grant_type")).toBe("authorization_code");
        expect(params.get("code")).toBe("test-auth-code");
        expect(params.get("code_verifier")).toBe("test-verifier");
        expect(params.get("redirect_uri")).toBe("http://localhost:3000/callback");
        expect(params.get("client_id")).toBe("test-client-id");
        // No client_secret should be present
        expect(params.has("client_secret")).toBe(false);

        return HttpResponse.json({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expires_in: 3600,
          scope: "offline_access User.Read Mail.ReadWrite",
          token_type: "Bearer",
        });
      }),
    );

    const tokens = await exchangeCodeForTokens(
      TEST_CONFIG,
      "test-auth-code",
      "http://localhost:3000/callback",
      "test-verifier",
    );

    expect(tokens.accessToken).toBe("new-access-token");
    expect(tokens.refreshToken).toBe("new-refresh-token");
    expect(tokens.expiresAt).toBeGreaterThan(Date.now());
    expect(tokens.scope).toBe("offline_access User.Read Mail.ReadWrite");
  });

  it("throws OAuthError on failure", async () => {
    mswServer.use(
      http.post(TOKEN_URL, () => {
        return HttpResponse.json(
          { error: "invalid_grant", error_description: "The code has expired" },
          { status: 400 },
        );
      }),
    );

    await expect(
      exchangeCodeForTokens(TEST_CONFIG, "bad-code", "http://localhost:3000/callback", "verifier"),
    ).rejects.toThrow(OAuthError);
  });
});

describe("refreshToken", () => {
  it("exchanges refresh token for new tokens", async () => {
    mswServer.use(
      http.post(TOKEN_URL, async ({ request }) => {
        const body = await request.text();
        const params = new URLSearchParams(body);
        expect(params.get("grant_type")).toBe("refresh_token");
        expect(params.get("refresh_token")).toBe("old-refresh-token");

        return HttpResponse.json({
          access_token: "refreshed-access-token",
          refresh_token: "refreshed-refresh-token",
          expires_in: 3600,
          scope: "offline_access User.Read Mail.ReadWrite",
          token_type: "Bearer",
        });
      }),
    );

    const tokens = await refreshToken(TEST_CONFIG, "old-refresh-token");
    expect(tokens.accessToken).toBe("refreshed-access-token");
    expect(tokens.refreshToken).toBe("refreshed-refresh-token");
  });

  it("throws OAuthError on invalid_grant", async () => {
    mswServer.use(
      http.post(TOKEN_URL, () => {
        return HttpResponse.json(
          { error: "invalid_grant", error_description: "Refresh token expired" },
          { status: 400 },
        );
      }),
    );

    await expect(refreshToken(TEST_CONFIG, "expired-token")).rejects.toThrow(OAuthError);
  });
});

describe("startCallbackServer", () => {
  it("resolves with the authorization code on valid callback", async () => {
    const state = "test-state-123";
    const { promise, port } = await startCallbackServer(state);

    expect(port).toBeGreaterThan(0);

    const response = await fetch(`http://127.0.0.1:${port}/callback?code=auth-code-xyz&state=${state}`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Authenticated");

    const code = await promise;
    expect(code).toBe("auth-code-xyz");
  });

  it("rejects on state mismatch", async () => {
    const { promise, port } = await startCallbackServer("expected-state");

    await fetch(`http://127.0.0.1:${port}/callback?code=some-code&state=wrong-state`);

    await expect(promise).rejects.toThrow("State mismatch");
  });

  it("rejects when OAuth error is returned in callback", async () => {
    const { promise, port } = await startCallbackServer("test-state");

    await fetch(
      `http://127.0.0.1:${port}/callback?error=access_denied&error_description=User+cancelled&state=test-state`,
    );

    await expect(promise).rejects.toThrow(OAuthError);
  });

  it("rejects on timeout", async () => {
    const { promise } = await startCallbackServer("state", 100);

    await expect(promise).rejects.toThrow("timed out");
  });

  it("returns 404 for non-callback paths", async () => {
    const { promise, port } = await startCallbackServer("state");

    const response = await fetch(`http://127.0.0.1:${port}/other-path`);
    expect(response.status).toBe(404);

    // Clean up
    await fetch(`http://127.0.0.1:${port}/callback?code=cleanup&state=state`);
    await promise;
  });
});

describe("runAuthFlow", () => {
  it("runs the full PKCE flow: localhost listener → browser → callback → token exchange", async () => {
    mswServer.use(
      http.post(TOKEN_URL, () => {
        return HttpResponse.json({
          access_token: "flow-access-token",
          refresh_token: "flow-refresh-token",
          expires_in: 3600,
          scope: "offline_access User.Read Mail.ReadWrite",
          token_type: "Bearer",
        });
      }),
    );

    let capturedUrl = "";
    const mockOpenBrowser = async (url: string) => {
      capturedUrl = url;

      // Parse the auth URL to extract state and redirect_uri
      const parsed = new URL(url);
      const state = parsed.searchParams.get("state")!;
      const redirectUri = parsed.searchParams.get("redirect_uri")!;

      // Simulate Microsoft redirecting back to our localhost callback
      await fetch(`${redirectUri}?code=test-auth-code&state=${state}`);
    };

    const tokens = await runAuthFlow(TEST_CONFIG, mockOpenBrowser);

    // Verify the auth URL was constructed correctly
    expect(capturedUrl).toContain("login.microsoftonline.com");
    expect(capturedUrl).toContain("code_challenge=");
    expect(capturedUrl).toContain("code_challenge_method=S256");
    expect(capturedUrl).toContain("response_type=code");
    expect(capturedUrl).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A");

    // Verify tokens came back
    expect(tokens.accessToken).toBe("flow-access-token");
    expect(tokens.refreshToken).toBe("flow-refresh-token");
  });
});
