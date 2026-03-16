export interface AppConfig {
  clientId: string;
  tenantId: string;
  scopes: string[];
  tokenStorePath: string;
}

export interface TokenCache {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  scope: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface AuthResult {
  tokens: TokenCache;
  port: number;
}
