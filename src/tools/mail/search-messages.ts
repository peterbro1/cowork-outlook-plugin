import type { GraphClient, ToolDefinition } from "../types.js";

function formatMessage(msg: any): string {
  const from = msg.sender?.emailAddress?.name || msg.sender?.emailAddress?.address || "Unknown";
  const preview = (msg.bodyPreview || "").replace(/\n/g, " ").substring(0, 80);
  return `${msg.id}|${msg.receivedDateTime}|${from}|${msg.subject}|${preview}`;
}

export function createSearchMessagesTool(graph: GraphClient): ToolDefinition {
  return {
    name: "search_messages",
    description: "Search email messages using a keyword query.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query string." },
        top: { type: "number", description: "Number of results to return (1-25, default 10)." },
      },
      required: ["query"],
    },
    async handler(args: { query: string; top?: number }) {
      const top = Math.max(1, Math.min(25, args.top ?? 10));
      const path = `/me/messages?$search="${args.query}"&$select=id,subject,sender,receivedDateTime,bodyPreview&$top=${top}`;
      const response = await graph.get(path);
      const messages: any[] = response.value || [];

      if (messages.length === 0) {
        return { content: [{ type: "text" as const, text: "No messages found." }] };
      }

      const header = "id|received|from|subject|preview";
      const rows = messages.map(formatMessage);

      return { content: [{ type: "text" as const, text: [header, ...rows].join("\n") }] };
    },
  };
}
