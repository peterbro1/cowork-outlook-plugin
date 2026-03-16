import type { GraphClient, ToolDefinition } from "../types.js";

export function createMoveMessageTool(graph: GraphClient): ToolDefinition {
  return {
    name: "move_message",
    description: "Move email messages to a specified folder. Use list_mail_folders to find folder IDs.",
    inputSchema: {
      type: "object",
      properties: {
        messageIds: {
          type: "array",
          items: { type: "string" },
          description: "One or more message IDs to move.",
        },
        destinationFolderId: {
          type: "string",
          description: "The ID of the destination folder.",
        },
      },
      required: ["messageIds", "destinationFolderId"],
    },
    async handler(args: { messageIds: string[]; destinationFolderId: string }) {
      let succeeded = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const id of args.messageIds) {
        try {
          await graph.post(`/me/messages/${id}/move`, {
            destinationId: args.destinationFolderId,
          });
          succeeded++;
        } catch (err: any) {
          failed++;
          errors.push(`${id}: ${err.message || "Unknown error"}`);
        }
      }

      const total = args.messageIds.length;
      const parts: string[] = [];
      parts.push(`Moved ${succeeded} of ${total} messages to folder.`);

      if (failed > 0) {
        parts.push(`Failed to move ${failed} message(s).`);
        parts.push("Errors:", ...errors);
      }

      return { content: [{ type: "text" as const, text: parts.join("\n") }] };
    },
  };
}
