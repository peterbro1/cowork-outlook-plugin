import { runAuthFlow } from "../../auth/oauth.js";
import { saveTokens } from "../../auth/token-store.js";
import { getConfig } from "../../config.js";
import type { ToolDefinition } from "../types.js";

export function createLoginTool(
  openBrowser?: (url: string) => Promise<void>,
): ToolDefinition {
  return {
    name: "o365_login",
    description:
      "Authenticate with Microsoft 365. Opens a browser window for the user to sign in. The session token is stored locally and is valid for one hour; run this tool again when it expires.",
    inputSchema: { type: "object", properties: {}, required: [] },
    handler: async () => {
      const config = getConfig();

      // Default: use the 'open' package to launch the browser
      const opener = openBrowser ?? (async (url: string) => {
        const open = (await import("open")).default;
        await open(url);
      });

      const tokens = await runAuthFlow(config, opener);
      await saveTokens(tokens, config.tokenStorePath);

      return {
        content: [
          {
            type: "text" as const,
            text: "Authentication successful! Tokens have been saved. You can now use email and calendar tools.",
          },
        ],
      };
    },
  };
}
