import type { GraphClient, ToolDefinition } from "../types.js";

export function createListFoldersTool(graph: GraphClient): ToolDefinition {
  return {
    name: "list_mail_folders",
    description: "List all mail folders with their unread and total message counts.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    async handler() {
      const response = await graph.get("/me/mailFolders?$top=50");
      const folders: any[] = response.value || [];

      if (folders.length === 0) {
        return { content: [{ type: "text" as const, text: "No folders found." }] };
      }

      const header = "id|name|unread|total";
      const rows = folders.map(
        (f) => `${f.id}|${f.displayName}|${f.unreadItemCount}|${f.totalItemCount}`
      );

      return { content: [{ type: "text" as const, text: [header, ...rows].join("\n") }] };
    },
  };
}
