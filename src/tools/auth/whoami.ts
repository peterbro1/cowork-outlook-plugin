import type { GraphClient, ToolDefinition } from "../types.js";

export function createWhoamiTool(graph: GraphClient): ToolDefinition {
  return {
    name: "o365_whoami",
    description: "Show the currently authenticated Microsoft 365 user.",
    inputSchema: { type: "object", properties: {}, required: [] },
    handler: async () => {
      const profile = await graph.get(
        "/me?$select=displayName,mail,userPrincipalName",
      );
      return {
        content: [
          {
            type: "text" as const,
            text: `Authenticated as: ${profile.displayName}\nEmail: ${profile.mail || profile.userPrincipalName}`,
          },
        ],
      };
    },
  };
}
