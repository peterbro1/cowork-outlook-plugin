import type { GraphClient, ToolDefinition } from "../types.js";

export function createListEventsTool(graph: GraphClient): ToolDefinition {
  return {
    name: "list_events",
    description: "List calendar events within a date range using calendarView (expands recurring events)",
    inputSchema: {
      type: "object",
      properties: {
        startDateTime: { type: "string", description: "Start of range (ISO 8601)" },
        endDateTime: { type: "string", description: "End of range (ISO 8601)" },
        calendarId: { type: "string", description: "Optional calendar ID (defaults to primary)" },
        top: { type: "number", description: "Number of events to return (1-50, default 20)", minimum: 1, maximum: 50 },
      },
      required: ["startDateTime", "endDateTime"],
    },
    handler: async (args: any) => {
      const { startDateTime, endDateTime, calendarId, top = 20 } = args;

      const base = calendarId
        ? `/me/calendars/${calendarId}/calendarView`
        : "/me/calendarView";

      const params = [
        `startDateTime=${startDateTime}`,
        `endDateTime=${endDateTime}`,
        `$select=id,subject,start,end,location,organizer,isAllDay,recurrence,showAs`,
        `$top=${top}`,
        `$orderby=start/dateTime`,
      ].join("&");

      const events = await graph.getPaginated(`${base}?${params}`, top);

      if (events.length === 0) {
        return { content: [{ type: "text", text: "No events found in the specified range." }] };
      }

      const header = "id|subject|start|end|location|allDay|showAs";
      const lines = events.map(
        (e: any) =>
          `${e.id}|${e.subject}|${e.start?.dateTime ?? ""}|${e.end?.dateTime ?? ""}|${e.location?.displayName ?? ""}|${e.isAllDay}|${e.showAs}`,
      );

      return {
        content: [{ type: "text", text: [header, ...lines].join("\n") }],
      };
    },
  };
}
