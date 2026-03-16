import type { GraphClient, ToolDefinition } from "../types.js";
import { createListCalendarsTool } from "./list-calendars.js";
import { createListEventsTool } from "./list-events.js";
import { createGetEventTool } from "./get-event.js";
import { createCreateEventTool } from "./create-event.js";
import { createUpdateEventTool } from "./update-event.js";
import { createRsvpEventTool } from "./rsvp-event.js";

export function createCalendarTools(graph: GraphClient): ToolDefinition[] {
  return [
    createListCalendarsTool(graph),
    createListEventsTool(graph),
    createGetEventTool(graph),
    createCreateEventTool(graph),
    createUpdateEventTool(graph),
    createRsvpEventTool(graph),
  ];
}
