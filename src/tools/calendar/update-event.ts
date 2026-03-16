import type { GraphClient, ToolDefinition } from "../types.js";

export function createUpdateEventTool(graph: GraphClient): ToolDefinition {
  return {
    name: "update_event",
    description: "Update an existing calendar event (only changed fields are sent)",
    inputSchema: {
      type: "object",
      properties: {
        eventId: { type: "string", description: "The event ID to update" },
        subject: { type: "string", description: "New subject" },
        start: { type: "string", description: "New start date/time (ISO 8601)" },
        startTimeZone: { type: "string", description: "IANA timezone for start" },
        end: { type: "string", description: "New end date/time (ISO 8601)" },
        endTimeZone: { type: "string", description: "IANA timezone for end" },
        body: { type: "string", description: "New body content" },
        location: { type: "string", description: "New location" },
      },
      required: ["eventId"],
    },
    handler: async (args: any) => {
      const { eventId, subject, start, startTimeZone, end, endTimeZone, body, location } = args;

      const patchBody: Record<string, any> = {};

      if (subject !== undefined) {
        patchBody.subject = subject;
      }

      if (start !== undefined) {
        patchBody.start = { dateTime: start, timeZone: startTimeZone ?? "UTC" };
      }

      if (end !== undefined) {
        patchBody.end = { dateTime: end, timeZone: endTimeZone ?? "UTC" };
      }

      if (body !== undefined) {
        patchBody.body = { contentType: "html", content: body };
      }

      if (location !== undefined) {
        patchBody.location = { displayName: location };
      }

      await graph.patch(`/me/events/${eventId}`, patchBody);

      return {
        content: [{ type: "text", text: `Event updated successfully.\nID: ${eventId}` }],
      };
    },
  };
}
