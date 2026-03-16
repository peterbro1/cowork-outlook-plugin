import type { GraphClient, ToolDefinition } from "../types.js";

export function createRsvpEventTool(graph: GraphClient): ToolDefinition {
  return {
    name: "rsvp_event",
    description: "RSVP to a calendar event (accept, tentatively accept, or decline)",
    inputSchema: {
      type: "object",
      properties: {
        eventId: { type: "string", description: "The event ID" },
        response: {
          type: "string",
          enum: ["accept", "tentativelyAccept", "decline"],
          description: "RSVP response type",
        },
        comment: { type: "string", description: "Optional comment with the response" },
        sendResponse: { type: "boolean", description: "Whether to send the response to the organizer (default: true)" },
      },
      required: ["eventId", "response"],
    },
    handler: async (args: any) => {
      const { eventId, response, comment, sendResponse = true } = args;

      const body: Record<string, any> = { sendResponse };
      if (comment !== undefined) {
        body.comment = comment;
      }

      await graph.post(`/me/events/${eventId}/${response}`, body);

      return {
        content: [{ type: "text", text: `RSVP sent: ${response} for event ${eventId}.` }],
      };
    },
  };
}
