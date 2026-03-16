import type { GraphClient, ToolDefinition } from "../types.js";

export function createListCalendarsTool(graph: GraphClient): ToolDefinition {
  return {
    name: "list_calendars",
    description: "List all calendars for the current user",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    handler: async (_args: any) => {
      const result = await graph.get(
        "/me/calendars?$select=id,name,color,isDefaultCalendar,canEdit",
      );
      const calendars = result.value as any[];

      if (calendars.length === 0) {
        return { content: [{ type: "text", text: "No calendars found." }] };
      }

      const header = "id|name|color|default|canEdit";
      const lines = calendars.map(
        (c: any) =>
          `${c.id}|${c.name}|${c.color}|${c.isDefaultCalendar}|${c.canEdit}`,
      );

      return {
        content: [{ type: "text", text: [header, ...lines].join("\n") }],
      };
    },
  };
}
