import { describe, it, expect, vi, beforeEach } from "vitest";
import { createListEventsTool } from "../../../src/tools/calendar/list-events.js";
import type { GraphClient } from "../../../src/tools/types.js";

describe("list_events", () => {
  let mockGraph: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn>; getPaginated: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockGraph = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      getPaginated: vi.fn(),
    };
  });

  it("has correct tool name", () => {
    const tool = createListEventsTool(mockGraph as unknown as GraphClient);
    expect(tool.name).toBe("list_events");
  });

  it("calls calendarView with date range and default top", async () => {
    mockGraph.getPaginated.mockResolvedValue([]);

    const tool = createListEventsTool(mockGraph as unknown as GraphClient);
    await tool.handler({
      startDateTime: "2026-03-16T00:00:00Z",
      endDateTime: "2026-03-17T00:00:00Z",
    });

    const calledPath = mockGraph.getPaginated.mock.calls[0][0] as string;
    expect(calledPath).toContain("/me/calendarView");
    expect(calledPath).toContain("startDateTime=2026-03-16T00:00:00Z");
    expect(calledPath).toContain("endDateTime=2026-03-17T00:00:00Z");
    expect(calledPath).toContain("$top=20");
    expect(calledPath).toContain("$orderby=start/dateTime");
    expect(mockGraph.getPaginated.mock.calls[0][1]).toBe(20);
  });

  it("uses calendarId when provided", async () => {
    mockGraph.getPaginated.mockResolvedValue([]);

    const tool = createListEventsTool(mockGraph as unknown as GraphClient);
    await tool.handler({
      startDateTime: "2026-03-16T00:00:00Z",
      endDateTime: "2026-03-17T00:00:00Z",
      calendarId: "cal-123",
    });

    const calledPath = mockGraph.getPaginated.mock.calls[0][0] as string;
    expect(calledPath).toContain("/me/calendars/cal-123/calendarView");
  });

  it("respects custom top parameter", async () => {
    mockGraph.getPaginated.mockResolvedValue([]);

    const tool = createListEventsTool(mockGraph as unknown as GraphClient);
    await tool.handler({
      startDateTime: "2026-03-16T00:00:00Z",
      endDateTime: "2026-03-17T00:00:00Z",
      top: 5,
    });

    const calledPath = mockGraph.getPaginated.mock.calls[0][0] as string;
    expect(calledPath).toContain("$top=5");
    expect(mockGraph.getPaginated.mock.calls[0][1]).toBe(5);
  });

  it("formats events as pipe-delimited output", async () => {
    mockGraph.getPaginated.mockResolvedValue([
      {
        id: "evt-1",
        subject: "Team Standup",
        start: { dateTime: "2026-03-16T09:00:00.0000000", timeZone: "UTC" },
        end: { dateTime: "2026-03-16T09:30:00.0000000", timeZone: "UTC" },
        location: { displayName: "Room A" },
        isAllDay: false,
        showAs: "busy",
      },
      {
        id: "evt-2",
        subject: "Lunch",
        start: { dateTime: "2026-03-16T12:00:00.0000000", timeZone: "UTC" },
        end: { dateTime: "2026-03-16T13:00:00.0000000", timeZone: "UTC" },
        location: { displayName: "" },
        isAllDay: false,
        showAs: "free",
      },
    ]);

    const tool = createListEventsTool(mockGraph as unknown as GraphClient);
    const result = await tool.handler({
      startDateTime: "2026-03-16T00:00:00Z",
      endDateTime: "2026-03-17T00:00:00Z",
    });

    const text = result.content[0].text;
    expect(text).toContain("evt-1|Team Standup|2026-03-16T09:00:00.0000000|2026-03-16T09:30:00.0000000|Room A|false|busy");
    expect(text).toContain("evt-2|Lunch|2026-03-16T12:00:00.0000000|2026-03-16T13:00:00.0000000||false|free");
  });

  it("handles empty event list", async () => {
    mockGraph.getPaginated.mockResolvedValue([]);

    const tool = createListEventsTool(mockGraph as unknown as GraphClient);
    const result = await tool.handler({
      startDateTime: "2026-03-16T00:00:00Z",
      endDateTime: "2026-03-17T00:00:00Z",
    });

    const text = result.content[0].text;
    expect(text).toContain("No events found");
  });
});
