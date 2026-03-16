import type { GraphClient, ToolDefinition } from "../types.js";

export function createCreateFolderTool(graph: GraphClient): ToolDefinition {
  return {
    name: "create_mail_folder",
    description: "Create a new mail folder. Can create top-level folders or subfolders.",
    inputSchema: {
      type: "object",
      properties: {
        displayName: {
          type: "string",
          description: "The name for the new folder.",
        },
        parentFolderId: {
          type: "string",
          description: "Optional parent folder ID to create a subfolder. Omit for a top-level folder.",
        },
      },
      required: ["displayName"],
    },
    async handler(args: { displayName: string; parentFolderId?: string }) {
      const path = args.parentFolderId
        ? `/me/mailFolders/${args.parentFolderId}/childFolders`
        : "/me/mailFolders";

      const response = await graph.post(path, { displayName: args.displayName });

      return {
        content: [
          {
            type: "text" as const,
            text: `Created folder '${response.displayName}' (id: ${response.id})`,
          },
        ],
      };
    },
  };
}
