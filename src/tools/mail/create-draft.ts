import type { GraphClient, ToolDefinition } from "../types.js";

export function createDraftTool(graph: GraphClient): ToolDefinition {
  return {
    name: "create_draft",
    description: "Create an email draft. This only saves a draft and does NOT send the message.",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Email subject." },
        body: { type: "string", description: "Email body content." },
        bodyType: {
          type: "string",
          enum: ["text", "html"],
          description: "Body content type (default: html).",
        },
        toRecipients: {
          type: "array",
          items: { type: "string" },
          description: "Email addresses of To recipients.",
        },
        ccRecipients: {
          type: "array",
          items: { type: "string" },
          description: "Email addresses of CC recipients.",
        },
        importance: {
          type: "string",
          enum: ["low", "normal", "high"],
          description: "Message importance (default: normal).",
        },
      },
      required: ["subject", "body", "toRecipients"],
    },
    async handler(args: {
      subject: string;
      body: string;
      bodyType?: "text" | "html";
      toRecipients: string[];
      ccRecipients?: string[];
      importance?: "low" | "normal" | "high";
    }) {
      const draft: any = {
        subject: args.subject,
        body: {
          contentType: args.bodyType || "html",
          content: args.body,
        },
        toRecipients: args.toRecipients.map((addr) => ({
          emailAddress: { address: addr },
        })),
        importance: args.importance || "normal",
      };

      if (args.ccRecipients && args.ccRecipients.length > 0) {
        draft.ccRecipients = args.ccRecipients.map((addr) => ({
          emailAddress: { address: addr },
        }));
      }

      const response = await graph.post("/me/messages", draft);

      return {
        content: [
          {
            type: "text" as const,
            text: `Draft created successfully.\nDraft ID: ${response.id}`,
          },
        ],
      };
    },
  };
}
