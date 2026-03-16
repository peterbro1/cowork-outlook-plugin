import { deleteTokens } from "../../auth/token-store.js";
import { getConfig } from "../../config.js";
import type { ToolDefinition } from "../types.js";

export function createLogoutTool(): ToolDefinition {
  return {
    name: "o365_logout",
    description: "Remove stored Microsoft 365 credentials from this machine.",
    inputSchema: { type: "object", properties: {}, required: [] },
    handler: async () => {
      const config = getConfig();
      await deleteTokens(config.tokenStorePath);
      return {
        content: [
          {
            type: "text" as const,
            text: "Logged out. Stored tokens have been removed.",
          },
        ],
      };
    },
  };
}
