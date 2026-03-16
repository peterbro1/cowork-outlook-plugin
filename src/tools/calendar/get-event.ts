import type { GraphClient, ToolDefinition } from "../types.js";

export function createGetEventTool(graph: GraphClient): ToolDefinition {
  return {
    name: "get_event",
    description: "Get full details of a calendar event by ID",
    inputSchema: {
      type: "object",
      properties: {
        eventId: { type: "string", description: "The event ID" },
      },
      required: ["eventId"],
    },
    handler: async (args: any) => {
      const { eventId } = args;

      const select = [
        "id", "subject", "body", "start", "end", "location", "attendees",
        "organizer", "recurrence", "isAllDay", "responseStatus",
        "onlineMeeting", "showAs", "sensitivity",
      ].join(",");

      const event = await graph.get(`/me/events/${eventId}?$select=${select}`);

      const lines: string[] = [];
      lines.push(`Subject: ${event.subject}`);
      lines.push(`ID: ${event.id}`);
      lines.push(`Start: ${event.start?.dateTime} (${event.start?.timeZone})`);
      lines.push(`End: ${event.end?.dateTime} (${event.end?.timeZone})`);
      lines.push(`All Day: ${event.isAllDay}`);
      lines.push(`Show As: ${event.showAs}`);
      lines.push(`Sensitivity: ${event.sensitivity}`);
      lines.push(`Location: ${event.location?.displayName || "None"}`);
      lines.push(`Organizer: ${event.organizer?.emailAddress?.name} <${event.organizer?.emailAddress?.address}>`);
      lines.push(`Response: ${event.responseStatus?.response}`);

      if (event.onlineMeeting?.joinUrl) {
        lines.push(`Online Meeting: ${event.onlineMeeting.joinUrl}`);
      }

      if (event.recurrence) {
        const pattern = event.recurrence.pattern;
        const range = event.recurrence.range;
        let recDesc = `Recurrence: ${pattern.type} every ${pattern.interval}`;
        if (pattern.daysOfWeek?.length) {
          recDesc += ` on ${pattern.daysOfWeek.join(", ")}`;
        }
        recDesc += ` (${range.type} from ${range.startDate}`;
        if (range.endDate) recDesc += ` to ${range.endDate}`;
        if (range.numberOfOccurrences) recDesc += `, ${range.numberOfOccurrences} occurrences`;
        recDesc += ")";
        lines.push(recDesc);
      }

      if (event.attendees?.length > 0) {
        lines.push("Attendees:");
        for (const a of event.attendees) {
          lines.push(`  - ${a.emailAddress?.name} <${a.emailAddress?.address}> (${a.type}, ${a.status?.response})`);
        }
      }

      if (event.body?.content) {
        lines.push(`\nBody (${event.body.contentType}):\n${event.body.content}`);
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    },
  };
}
