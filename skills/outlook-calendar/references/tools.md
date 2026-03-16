# Calendar tool reference

## list_calendars

List all calendars the user has access to.

Parameters: None.

Output: Pipe-delimited rows `id|name|color|default|canEdit`.

## list_events

List events in a date range. Recurring events are expanded into individual occurrences. Auto-paginates across large result sets.

Parameters:
- `startDateTime` (required, string) — ISO 8601 start datetime (e.g., "2026-03-16T00:00:00").
- `endDateTime` (required, string) — ISO 8601 end datetime.
- `calendarId` (optional, string) — Specific calendar ID. Omit for the default calendar.
- `top` (optional, number, 1-50, default 20) — Maximum events to return.

Output: Pipe-delimited rows `id|subject|start|end|location|allDay|showAs`.

## get_event

Get full details of a calendar event.

Parameters:
- `eventId` (required, string) — The event ID.

Output: Formatted text with subject, start/end times, location, organiser, attendees (with RSVP status), recurrence description, body, sensitivity, online meeting link.

## create_event

Create a new calendar event.

Parameters:
- `subject` (required, string) — Event title.
- `start` (required, string) — ISO 8601 start datetime.
- `startTimeZone` (required, string) — IANA timezone (e.g., "Australia/Brisbane").
- `end` (required, string) — ISO 8601 end datetime.
- `endTimeZone` (required, string) — IANA timezone.
- `body` (optional, string) — Event description.
- `bodyType` (optional, "text" or "html", default "html") — Body content type.
- `location` (optional, string) — Event location.
- `attendees` (optional, string[]) — Email addresses of attendees.
- `isAllDay` (optional, boolean) — Whether this is an all-day event.
- `calendarId` (optional, string) — Target calendar ID. Omit for default.
- `recurrence` (optional, object) — Recurrence pattern and range.
  - `pattern.type`: "daily", "weekly", "absoluteMonthly", "relativeMonthly", "absoluteYearly", "relativeYearly"
  - `pattern.interval`: How many units between occurrences
  - `pattern.daysOfWeek`: Array of day names (for weekly)
  - `range.type`: "endDate", "numbered", "noEnd"
  - `range.startDate`: When recurrence starts
  - `range.endDate`: When recurrence ends (for endDate type)
  - `range.numberOfOccurrences`: How many times (for numbered type)

Output: Confirmation with event ID.

## update_event

Update an existing calendar event. Only changed fields are sent.

Parameters:
- `eventId` (required, string) — The event ID.
- `subject` (optional, string) — New title.
- `start` (optional, string) — New start datetime.
- `startTimeZone` (optional, string) — New start timezone.
- `end` (optional, string) — New end datetime.
- `endTimeZone` (optional, string) — New end timezone.
- `body` (optional, string) — New description.
- `location` (optional, string) — New location.

Output: Confirmation.

## rsvp_event

Accept, tentatively accept, or decline a calendar event.

Parameters:
- `eventId` (required, string) — The event ID.
- `response` (required, string) — One of: "accept", "tentativelyAccept", "decline".
- `comment` (optional, string) — Message to the organiser.
- `sendResponse` (optional, boolean, default true) — Whether to notify the organiser.

Output: Confirmation of the RSVP action.
