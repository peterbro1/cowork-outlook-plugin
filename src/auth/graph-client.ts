import { GRAPH_BASE_URL } from "../config.js";
import { getConfig } from "../config.js";
import { loadTokens, saveTokens, isTokenExpired } from "./token-store.js";
import { refreshToken as refreshTokenFn } from "./oauth.js";
import type { AppConfig, TokenCache } from "../types/config.js";

export class GraphClient {
  private tokenStorePath: string;
  private config: AppConfig;
  private refreshPromise: Promise<TokenCache> | null = null;

  constructor(tokenStorePath: string, config?: AppConfig) {
    this.tokenStorePath = tokenStorePath;
    this.config = config ?? getConfig();
  }

  async ensureAuthenticated(): Promise<TokenCache> {
    const tokens = await loadTokens(this.tokenStorePath);

    if (!tokens) {
      throw new Error(
        "No tokens found. Please authenticate first using the device code flow.",
      );
    }

    if (isTokenExpired(tokens)) {
      // If a refresh is already in flight, wait for it
      if (this.refreshPromise) {
        return this.refreshPromise;
      }

      // Start refresh and store the promise
      this.refreshPromise = this.performRefresh(tokens.refreshToken);
      try {
        const newTokens = await this.refreshPromise;
        return newTokens;
      } finally {
        this.refreshPromise = null;
      }
    }

    return tokens;
  }

  private async performRefresh(refreshTokenValue: string): Promise<TokenCache> {
    try {
      const newTokens = await refreshTokenFn(this.config, refreshTokenValue);
      await saveTokens(newTokens, this.tokenStorePath);
      return newTokens;
    } catch (error) {
      throw new Error(
        "Failed to refresh token. Please re-authenticate using the device code flow.",
      );
    }
  }

  private buildHeaders(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: 'IdType="ImmutableId"',
    };
  }

  private async handleResponse(response: Response): Promise<any> {
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Graph API error ${response.status}: ${text}`);
    }
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }
    // Some endpoints (e.g., accept/decline) return 202 with no body
    return undefined;
  }

  /**
   * GET with automatic pagination. Follows @odata.nextLink until all pages are fetched
   * or maxItems is reached.
   * @param path - The initial Graph API path
   * @param maxItems - Maximum total items to collect (default 100, max 500)
   * @returns Array of all collected items from the `value` arrays across pages
   */
  async getPaginated(path: string, maxItems: number = 100): Promise<any[]> {
    const items: any[] = [];
    let url: string | null = `${GRAPH_BASE_URL}${path}`;
    const cap = Math.min(maxItems, 500);

    while (url && items.length < cap) {
      const tokens = await this.ensureAuthenticated();
      const response: Response = await fetch(url, {
        method: "GET",
        headers: this.buildHeaders(tokens.accessToken),
      });

      if (!response.ok) {
        const text: string = await response.text();
        throw new Error(`Graph API error ${response.status}: ${text}`);
      }

      const data: { value?: any[]; "@odata.nextLink"?: string } = await response.json();
      const values = data.value || [];
      items.push(...values);

      // Follow nextLink if present and we haven't hit the cap
      url = data["@odata.nextLink"] || null;
    }

    return items.slice(0, cap);
  }

  async get(path: string): Promise<any> {
    const tokens = await this.ensureAuthenticated();
    const response = await fetch(`${GRAPH_BASE_URL}${path}`, {
      method: "GET",
      headers: this.buildHeaders(tokens.accessToken),
    });
    return this.handleResponse(response);
  }

  async post(path: string, body: unknown): Promise<any> {
    const tokens = await this.ensureAuthenticated();
    const response = await fetch(`${GRAPH_BASE_URL}${path}`, {
      method: "POST",
      headers: this.buildHeaders(tokens.accessToken),
      body: JSON.stringify(body),
    });
    return this.handleResponse(response);
  }

  async patch(path: string, body: unknown): Promise<any> {
    const tokens = await this.ensureAuthenticated();
    const response = await fetch(`${GRAPH_BASE_URL}${path}`, {
      method: "PATCH",
      headers: this.buildHeaders(tokens.accessToken),
      body: JSON.stringify(body),
    });
    return this.handleResponse(response);
  }
}
