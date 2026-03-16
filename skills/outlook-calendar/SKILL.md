---
name: outlook-calendar
description: |
  Manages Microsoft 365 calendar via the Outlook connector. Handles viewing, creating, updating, and responding to calendar events.
  Triggers when the user says "check my calendar", "what meetings do I have", "schedule a meeting", "create an event", "accept this invite", "decline the meeting", "move this meeting", or references calendar, events, meetings, schedule, or appointments.
---

You have access to Microsoft 365 calendar tools through the Outlook connector. Use them to help the user manage their schedule.

## Authentication

Before using any calendar tool, check if the user is authenticated. If a tool returns an error about missing tokens, call `o365_login`. See the outlook-email skill for the full authentication flow.

## Viewing the calendar

- Use `list_calendars` to see all calendars the user has access to (default, shared, etc.).
- Use `list_events` to see events in a date range. Always provide `startDateTime` and `endDateTime` in ISO 8601 format. This uses the calendarView endpoint which automatically expands recurring events into individual occurrences. Results are auto-paginated.
- Use `get_event` to see full details of a specific event including attendees, recurrence pattern, location, body, and online meeting link.

## Creating events

- Use `create_event` to schedule new events. Always include:
  - `subject` — The event title
  - `start` and `end` — ISO 8601 datetimes
  - `startTimeZone` and `endTimeZone` — IANA timezone names (e.g., "Australia/Brisbane", "America/New_York")
- Optional fields: `body`, `location`, `attendees` (array of email addresses), `isAllDay`, `calendarId`, `recurrence`.

## Recurring events

The `recurrence` parameter supports these pattern types:
- `daily` — Every N days
- `weekly` — Every N weeks on specific days (`daysOfWeek`: "monday", "tuesday", etc.)
- `absoluteMonthly` — Day N of every M months
- `relativeMonthly` — E.g., second Tuesday of every month
- `absoluteYearly` / `relativeYearly` — Annual patterns

Each recurrence needs a range: `endDate` (stops on a date), `numbered` (stops after N occurrences), or `noEnd` (runs forever).

Example — weekly standup every Monday and Wednesday until end of year:
```json
{
  "recurrence": {
    "pattern": { "type": "weekly", "interval": 1, "daysOfWeek": ["monday", "wednesday"] },
    "range": { "type": "endDate", "startDate": "2026-03-16", "endDate": "2026-12-31" }
  }
}
```

## Updating events

- Use `update_event` to change an existing event. Only send the fields that need to change — the tool sends a partial update.
- You can update subject, start/end times, body, and location.

## Responding to invites

- Use `rsvp_event` to accept, tentatively accept, or decline. Set `response` to one of: `accept`, `tentativelyAccept`, `decline`. Optionally include a `comment` and control whether a response is sent to the organiser with `sendResponse` (default true).

## Output format

Event lists use pipe-delimited format: `id|subject|start|end|location|allDay|showAs`. Parse this to present a readable schedule to the user with times formatted in their local timezone.

## Important rules

1. Never attempt to delete calendar events. There is no delete tool.
2. Always use IANA timezone names, not UTC offsets or abbreviations.
3. When listing events, default to the next 7 days if the user doesn't specify a range.
4. When creating events, confirm the details with the user before calling the tool if the request is ambiguous.
