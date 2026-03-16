import type { GraphClient, ToolDefinition } from "../types.js";

function formatMessage(msg: any): string {
  const from = msg.sender?.emailAddress?.name || msg.sender?.emailAddress?.address || "Unknown";
  const preview = (msg.bodyPreview || "").replace(/\n/g, " ").substring(0, 80);
  return `${msg.id}|${msg.receivedDateTime}|${from}|${msg.subject}|${preview}`;
}

export function createListMessagesTool(graph: GraphClient): ToolDefinition {
  return {
    name: "list_messages",
    description: "List email messages from the inbox or a specific folder, ordered by most recent first.",
    inputSchema: {
      type: "object",
      properties: {
        folderId: { type: "string", description: "Mail folder ID. Omit to list from inbox." },
        top: { type: "number", description: "Number of messages to return (1-50, default 10)." },
        skip: { type: "number", description: "Number of messages to skip for pagination." },
      },
    },
    async handler(args: { folderId?: string; top?: number; skip?: number }) {
      const top = Math.max(1, Math.min(50, args.top ?? 10));
      const skip = args.skip ?? 0;

      const basePath = args.folderId
        ? `/me/mailFolders/${args.folderId}/messages`
        : "/me/messages";

      const path = `${basePath}?$select=id,subject,sender,receivedDateTime,isRead,bodyPreview&$top=${top}&$skip=${skip}&$orderby=receivedDateTime desc`;
      const response = await graph.get(path);
      const messages: any[] = response.value || [];

      if (messages.length === 0) {
        return { content: [{ type: "text" as const, text: "No messages found." }] };
      }

      const header = "id|received|from|subject|preview";
      const rows = messages.map(formatMessage);
      const hasMore = messages.length >= top;
      const nextSkip = skip + messages.length;

      const text = [header, ...rows, "", `hasMore: ${hasMore}`, `nextSkip: ${nextSkip}`].join("\n");

      return { content: [{ type: "text" as const, text }] };
    },
  };
}
