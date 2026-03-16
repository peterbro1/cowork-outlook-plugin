import type { GraphClient, ToolDefinition } from "../types.js";

export function createCreateEventTool(graph: GraphClient): ToolDefinition {
  return {
    name: "create_event",
    description: "Create a new calendar event",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Event subject/title" },
        start: { type: "string", description: "Start date/time (ISO 8601)" },
        startTimeZone: { type: "string", description: "IANA timezone for start (e.g., Australia/Brisbane)" },
        end: { type: "string", description: "End date/time (ISO 8601)" },
        endTimeZone: { type: "string", description: "IANA timezone for end" },
        body: { type: "string", description: "Event body content" },
        bodyType: { type: "string", enum: ["text", "html"], description: "Body content type (default: html)" },
        location: { type: "string", description: "Event location" },
        attendees: { type: "array", items: { type: "string" }, description: "Email addresses of attendees" },
        isAllDay: { type: "boolean", description: "Whether this is an all-day event" },
        calendarId: { type: "string", description: "Calendar ID (defaults to primary)" },
        recurrence: {
          type: "object",
          description: "Recurrence pattern and range",
          properties: {
            pattern: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["daily", "weekly", "absoluteMonthly", "relativeMonthly", "absoluteYearly", "relativeYearly"] },
                interval: { type: "number" },
                daysOfWeek: { type: "array", items: { type: "string" } },
              },
              required: ["type", "interval"],
            },
            range: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["endDate", "numbered", "noEnd"] },
                startDate: { type: "string" },
                endDate: { type: "string" },
                numberOfOccurrences: { type: "number" },
              },
              required: ["type", "startDate"],
            },
          },
          required: ["pattern", "range"],
        },
      },
      required: ["subject", "start", "startTimeZone", "end", "endTimeZone"],
    },
    handler: async (args: any) => {
      const {
        subject, start, startTimeZone, end, endTimeZone,
        body, bodyType = "html", location, attendees,
        isAllDay, calendarId, recurrence,
      } = args;

      const eventBody: Record<string, any> = {
        subject,
        start: { dateTime: start, timeZone: startTimeZone },
        end: { dateTime: end, timeZone: endTimeZone },
      };

      if (body !== undefined) {
        eventBody.body = { contentType: bodyType, content: body };
      }

      if (location !== undefined) {
        eventBody.location = { displayName: location };
      }

      if (attendees?.length) {
        eventBody.attendees = attendees.map((email: string) => ({
          emailAddress: { address: email },
          type: "required",
        }));
      }

      if (isAllDay !== undefined) {
        eventBody.isAllDay = isAllDay;
      }

      if (recurrence) {
        eventBody.recurrence = recurrence;
      }

      const path = calendarId
        ? `/me/calendars/${calendarId}/events`
        : "/me/events";

      const result = await graph.post(path, eventBody);

      return {
        content: [{ type: "text", text: `Event created successfully.\nID: ${result.id}` }],
      };
    },
  };
}
