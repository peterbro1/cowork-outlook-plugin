import type { GraphClient, ToolDefinition } from "../types.js";

export function createArchiveMessageTool(graph: GraphClient): ToolDefinition {
  return {
    name: "archive_message",
    description: "Move one or more messages to the archive folder. This is non-destructive and never deletes messages.",
    inputSchema: {
      type: "object",
      properties: {
        messageIds: {
          type: "array",
          items: { type: "string" },
          description: "One or more message IDs to archive.",
        },
      },
      required: ["messageIds"],
    },
    async handler(args: { messageIds: string[] }) {
      let succeeded = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const id of args.messageIds) {
        try {
          await graph.post(`/me/messages/${id}/move`, { destinationId: "archive" });
          succeeded++;
        } catch (err: any) {
          failed++;
          errors.push(`${id}: ${err.message || "Unknown error"}`);
        }
      }

      const parts: string[] = [];
      if (succeeded > 0) {
        parts.push(`Successfully archived ${succeeded} message(s).`);
      }
      if (failed > 0) {
        parts.push(`Failed to archive ${failed} message(s).`);
        parts.push("Errors:", ...errors);
      }

      return { content: [{ type: "text" as const, text: parts.join("\n") }] };
    },
  };
}
