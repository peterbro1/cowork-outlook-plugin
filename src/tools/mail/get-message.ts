import type { GraphClient, ToolDefinition } from "../types.js";
import { sanitizeEmailHtml } from "../../utils/html-sanitizer.js";

function formatRecipient(r: any): string {
  const name = r.emailAddress?.name || "";
  const addr = r.emailAddress?.address || "";
  return name ? `${name} <${addr}>` : addr;
}

export function createGetMessageTool(graph: GraphClient): ToolDefinition {
  return {
    name: "get_message",
    description: "Get the full details of a specific email message by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: { type: "string", description: "The message ID to retrieve." },
      },
      required: ["messageId"],
    },
    async handler(args: { messageId: string }) {
      const path = `/me/messages/${args.messageId}?$select=id,subject,sender,from,toRecipients,ccRecipients,receivedDateTime,body,isRead,hasAttachments,importance,categories`;
      const msg = await graph.get(path);

      const bodyText = msg.body?.contentType === "html"
        ? sanitizeEmailHtml(msg.body.content)
        : msg.body?.content || "";

      const to = (msg.toRecipients || []).map(formatRecipient).join(", ");
      const cc = (msg.ccRecipients || []).map(formatRecipient).join(", ");
      const categories = (msg.categories || []).join(", ");

      const lines = [
        `Subject: ${msg.subject}`,
        `From: ${formatRecipient(msg.from)}`,
        `To: ${to}`,
        cc ? `CC: ${cc}` : null,
        `Date: ${msg.receivedDateTime}`,
        `Read: ${msg.isRead}`,
        `Importance: ${msg.importance}`,
        `Has Attachments: ${msg.hasAttachments}`,
        categories ? `Categories: ${categories}` : null,
        `ID: ${msg.id}`,
        "",
        "--- Body ---",
        bodyText,
      ].filter((l) => l !== null);

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  };
}
