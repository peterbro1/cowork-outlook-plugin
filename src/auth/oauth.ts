import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { AUTHORITY_BASE_URL } from "../config.js";
import type { AppConfig, TokenCache, TokenResponse } from "../types/config.js";

export class OAuthError extends Error {
  constructor(
    public readonly errorCode: string,
    public readonly errorDescription: string,
  ) {
    super(`${errorCode}: ${errorDescription}`);
    this.name = "OAuthError";
  }
}

/**
 * Generate a cryptographically random code verifier for PKCE (43-128 chars, base64url).
 */
export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Derive the code challenge from the verifier using SHA-256 (S256 method).
 */
export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/**
 * Generate a random state parameter to prevent CSRF.
 */
export function generateState(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Build the Microsoft OAuth 2.0 authorization URL with PKCE parameters.
 */
export function buildAuthorizationUrl(
  config: AppConfig,
  redirectUri: string,
  codeChallenge: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: config.scopes.join(" "),
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  });

  return `${AUTHORITY_BASE_URL}/${config.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

/**
 * Exchange an authorization code for tokens using PKCE (no client_secret).
 */
export async function exchangeCodeForTokens(
  config: AppConfig,
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<TokenCache> {
  const url = `${AUTHORITY_BASE_URL}/${config.tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: config.clientId,
    scope: config.scopes.join(" "),
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new OAuthError(err.error, err.error_description);
  }

  const data = (await response.json()) as TokenResponse;

  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  };
}

const SUCCESS_HTML = `<!DOCTYPE html>
<html><head><title>Authentication Successful</title></head>
<body style="font-family:sans-serif;text-align:center;padding:60px">
<h1>Authenticated!</h1>
<p>You can close this window and return to Claude.</p>
</body></html>`;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const ERROR_HTML = (msg: string) => `<!DOCTYPE html>
<html><head><title>Authentication Failed</title></head>
<body style="font-family:sans-serif;text-align:center;padding:60px">
<h1>Authentication Failed</h1>
<p>${escapeHtml(msg)}</p>
</body></html>`;

/**
 * Start a temporary local HTTP server that listens for the OAuth callback.
 * Returns a promise that resolves with the authorization code.
 *
 * @param timeoutMs - How long to wait before giving up (default 120s)
 * @returns Object with the code promise, the server, and the port
 */
export async function startCallbackServer(
  expectedState: string,
  timeoutMs: number = 120_000,
): Promise<{ promise: Promise<string>; server: Server; port: number }> {
  let resolvePromise: (code: string) => void;
  let rejectPromise: (err: Error) => void;
  let settled = false;

  const promise = new Promise<string>((resolve, reject) => {
    resolvePromise = (code: string) => { settled = true; resolve(code); };
    rejectPromise = (err: Error) => { settled = true; reject(err); };
  });

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || "/", `http://localhost`);

    if (url.pathname !== "/callback") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    if (error) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(ERROR_HTML(errorDescription || error));
      rejectPromise(new OAuthError(error, errorDescription || "Authentication was denied"));
      return;
    }

    if (state !== expectedState) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(ERROR_HTML("Invalid state parameter - possible CSRF attack"));
      rejectPromise(new Error("State mismatch - possible CSRF attack"));
      return;
    }

    if (!code) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(ERROR_HTML("No authorization code received"));
      rejectPromise(new Error("No authorization code in callback"));
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(SUCCESS_HTML);
    resolvePromise(code);
  });

  // Wait for the server to actually be listening before returning the port
  const port = await new Promise<number>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(typeof address === "object" && address ? address.port : 0);
    });
  });

  // Timeout — reject if the user takes too long
  const timer = setTimeout(() => {
    if (!settled) {
      rejectPromise(new Error("Authentication timed out. Please try again."));
    }
    server.close();
  }, timeoutMs);

  // Clean up timer and server when promise settles
  promise.then(
    () => { clearTimeout(timer); server.close(); },
    () => { clearTimeout(timer); server.close(); },
  );

  return { promise, server, port };
}

/**
 * Run the full interactive OAuth PKCE flow:
 * 1. Generate PKCE code verifier + challenge
 * 2. Spin up localhost callback server
 * 3. Open browser to Microsoft authorize endpoint
 * 4. Wait for callback with auth code
 * 5. Exchange code for tokens
 * 6. Shut down callback server
 *
 * @param config - App configuration
 * @param openBrowser - Function to open a URL in the browser (injected for testability)
 * @returns TokenCache with the access token
 */
export async function runAuthFlow(
  config: AppConfig,
  openBrowser: (url: string) => Promise<void>,
): Promise<TokenCache> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  const { promise: codePromise, server, port } = await startCallbackServer(state);
  const redirectUri = `http://localhost:${port}/callback`;

  const authUrl = buildAuthorizationUrl(config, redirectUri, codeChallenge, state);
  await openBrowser(authUrl);

  const code = await codePromise;

  // Server is cleaned up by the .finally() in startCallbackServer
  const tokens = await exchangeCodeForTokens(config, code, redirectUri, codeVerifier);
  return tokens;
}
