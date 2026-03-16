import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCreateEventTool } from "../../../src/tools/calendar/create-event.js";
import type { GraphClient } from "../../../src/tools/types.js";

describe("create_event", () => {
  let mockGraph: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockGraph = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
    };
  });

  it("has correct tool name", () => {
    const tool = createCreateEventTool(mockGraph as unknown as GraphClient);
    expect(tool.name).toBe("create_event");
  });

  it("creates a basic event with required fields", async () => {
    mockGraph.post.mockResolvedValue({ id: "new-evt-1", subject: "New Meeting" });

    const tool = createCreateEventTool(mockGraph as unknown as GraphClient);
    await tool.handler({
      subject: "New Meeting",
      start: "2026-03-20T10:00:00",
      startTimeZone: "Australia/Brisbane",
      end: "2026-03-20T11:00:00",
      endTimeZone: "Australia/Brisbane",
    });

    expect(mockGraph.post).toHaveBeenCalledWith(
      "/me/events",
      expect.objectContaining({
        subject: "New Meeting",
        start: { dateTime: "2026-03-20T10:00:00", timeZone: "Australia/Brisbane" },
        end: { dateTime: "2026-03-20T11:00:00", timeZone: "Australia/Brisbane" },
      }),
    );
  });

  it("includes optional body and location", async () => {
    mockGraph.post.mockResolvedValue({ id: "new-evt-2", subject: "Lunch" });

    const tool = createCreateEventTool(mockGraph as unknown as GraphClient);
    await tool.handler({
      subject: "Lunch",
      start: "2026-03-20T12:00:00",
      startTimeZone: "Australia/Brisbane",
      end: "2026-03-20T13:00:00",
      endTimeZone: "Australia/Brisbane",
      body: "<p>Meet at the cafe</p>",
      bodyType: "html",
      location: "Cafe Downtown",
    });

    const body = mockGraph.post.mock.calls[0][1];
    expect(body.body).toEqual({ contentType: "html", content: "<p>Meet at the cafe</p>" });
    expect(body.location).toEqual({ displayName: "Cafe Downtown" });
  });

  it("defaults bodyType to html", async () => {
    mockGraph.post.mockResolvedValue({ id: "new-evt-3" });

    const tool = createCreateEventTool(mockGraph as unknown as GraphClient);
    await tool.handler({
      subject: "Test",
      start: "2026-03-20T10:00:00",
      startTimeZone: "UTC",
      end: "2026-03-20T11:00:00",
      endTimeZone: "UTC",
      body: "Some text",
    });

    const body = mockGraph.post.mock.calls[0][1];
    expect(body.body.contentType).toBe("html");
  });

  it("includes attendees as email addresses", async () => {
    mockGraph.post.mockResolvedValue({ id: "new-evt-4" });

    const tool = createCreateEventTool(mockGraph as unknown as GraphClient);
    await tool.handler({
      subject: "Team Meeting",
      start: "2026-03-20T10:00:00",
      startTimeZone: "UTC",
      end: "2026-03-20T11:00:00",
      endTimeZone: "UTC",
      attendees: ["bob@example.com", "carol@example.com"],
    });

    const body = mockGraph.post.mock.calls[0][1];
    expect(body.attendees).toEqual([
      { emailAddress: { address: "bob@example.com" }, type: "required" },
      { emailAddress: { address: "carol@example.com" }, type: "required" },
    ]);
  });

  it("uses calendarId when provided", async () => {
    mockGraph.post.mockResolvedValue({ id: "new-evt-5" });

    const tool = createCreateEventTool(mockGraph as unknown as GraphClient);
    await tool.handler({
      subject: "Personal Event",
      start: "2026-03-20T10:00:00",
      startTimeZone: "UTC",
      end: "2026-03-20T11:00:00",
      endTimeZone: "UTC",
      calendarId: "cal-personal",
    });

    expect(mockGraph.post).toHaveBeenCalledWith(
      "/me/calendars/cal-personal/events",
      expect.any(Object),
    );
  });

  it("includes isAllDay flag", async () => {
    mockGraph.post.mockResolvedValue({ id: "new-evt-6" });

    const tool = createCreateEventTool(mockGraph as unknown as GraphClient);
    await tool.handler({
      subject: "Holiday",
      start: "2026-03-20T00:00:00",
      startTimeZone: "UTC",
      end: "2026-03-21T00:00:00",
      endTimeZone: "UTC",
      isAllDay: true,
    });

    const body = mockGraph.post.mock.calls[0][1];
    expect(body.isAllDay).toBe(true);
  });

  it("includes recurrence pattern", async () => {
    mockGraph.post.mockResolvedValue({ id: "new-evt-7" });

    const recurrence = {
      pattern: { type: "weekly" as const, interval: 1, daysOfWeek: ["monday", "wednesday", "friday"] },
      range: { type: "endDate" as const, startDate: "2026-03-20", endDate: "2026-06-20" },
    };

    const tool = createCreateEventTool(mockGraph as unknown as GraphClient);
    await tool.handler({
      subject: "Recurring Standup",
      start: "2026-03-20T09:00:00",
      startTimeZone: "Australia/Brisbane",
      end: "2026-03-20T09:15:00",
      endTimeZone: "Australia/Brisbane",
      recurrence,
    });

    const body = mockGraph.post.mock.calls[0][1];
    expect(body.recurrence).toEqual(recurrence);
  });

  it("returns confirmation with event ID", async () => {
    mockGraph.post.mockResolvedValue({ id: "new-evt-8", subject: "Created Event" });

    const tool = createCreateEventTool(mockGraph as unknown as GraphClient);
    const result = await tool.handler({
      subject: "Created Event",
      start: "2026-03-20T10:00:00",
      startTimeZone: "UTC",
      end: "2026-03-20T11:00:00",
      endTimeZone: "UTC",
    });

    const text = result.content[0].text;
    expect(text).toContain("new-evt-8");
    expect(text.toLowerCase()).toContain("created");
  });
});
