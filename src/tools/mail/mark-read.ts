import type { GraphClient, ToolDefinition } from "../types.js";

export function createMarkReadTool(graph: GraphClient): ToolDefinition {
  return {
    name: "mark_message_read",
    description: "Mark a message as read or unread.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: { type: "string", description: "The message ID." },
        isRead: { type: "boolean", description: "True to mark as read, false for unread." },
      },
      required: ["messageId", "isRead"],
    },
    async handler(args: { messageId: string; isRead: boolean }) {
      await graph.patch(`/me/messages/${args.messageId}`, { isRead: args.isRead });

      const status = args.isRead ? "read" : "unread";
      return {
        content: [{ type: "text" as const, text: `Message ${args.messageId} marked as ${status}.` }],
      };
    },
  };
}
