import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGetEventTool } from "../../../src/tools/calendar/get-event.js";
import type { GraphClient } from "../../../src/tools/types.js";

describe("get_event", () => {
  let mockGraph: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockGraph = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
    };
  });

  it("has correct tool name", () => {
    const tool = createGetEventTool(mockGraph as unknown as GraphClient);
    expect(tool.name).toBe("get_event");
  });

  it("calls correct Graph API path with eventId", async () => {
    mockGraph.get.mockResolvedValue({
      id: "evt-1",
      subject: "Meeting",
      body: { contentType: "html", content: "<p>Notes</p>" },
      start: { dateTime: "2026-03-16T09:00:00.0000000", timeZone: "Australia/Brisbane" },
      end: { dateTime: "2026-03-16T10:00:00.0000000", timeZone: "Australia/Brisbane" },
      location: { displayName: "Room A" },
      attendees: [],
      organizer: { emailAddress: { name: "Alice", address: "alice@example.com" } },
      recurrence: null,
      isAllDay: false,
      responseStatus: { response: "accepted", time: "2026-03-15T00:00:00Z" },
      onlineMeeting: null,
      showAs: "busy",
      sensitivity: "normal",
    });

    const tool = createGetEventTool(mockGraph as unknown as GraphClient);
    await tool.handler({ eventId: "evt-1" });

    const calledPath = mockGraph.get.mock.calls[0][0] as string;
    expect(calledPath).toContain("/me/events/evt-1");
    expect(calledPath).toContain("$select=");
  });

  it("formats event details including attendees", async () => {
    mockGraph.get.mockResolvedValue({
      id: "evt-1",
      subject: "Team Sync",
      body: { contentType: "text", content: "Weekly sync" },
      start: { dateTime: "2026-03-16T09:00:00.0000000", timeZone: "Australia/Brisbane" },
      end: { dateTime: "2026-03-16T10:00:00.0000000", timeZone: "Australia/Brisbane" },
      location: { displayName: "Conference Room" },
      attendees: [
        { emailAddress: { name: "Bob", address: "bob@example.com" }, status: { response: "accepted" }, type: "required" },
        { emailAddress: { name: "Carol", address: "carol@example.com" }, status: { response: "tentativelyAccepted" }, type: "optional" },
      ],
      organizer: { emailAddress: { name: "Alice", address: "alice@example.com" } },
      recurrence: null,
      isAllDay: false,
      responseStatus: { response: "organizer", time: "0001-01-01T00:00:00Z" },
      onlineMeeting: { joinUrl: "https://teams.microsoft.com/meet/123" },
      showAs: "busy",
      sensitivity: "normal",
    });

    const tool = createGetEventTool(mockGraph as unknown as GraphClient);
    const result = await tool.handler({ eventId: "evt-1" });

    const text = result.content[0].text;
    expect(text).toContain("Team Sync");
    expect(text).toContain("Conference Room");
    expect(text).toContain("bob@example.com");
    expect(text).toContain("carol@example.com");
    expect(text).toContain("alice@example.com");
    expect(text).toContain("https://teams.microsoft.com/meet/123");
    expect(text).toContain("busy");
  });

  it("formats recurrence information", async () => {
    mockGraph.get.mockResolvedValue({
      id: "evt-2",
      subject: "Daily Standup",
      body: { contentType: "text", content: "" },
      start: { dateTime: "2026-03-16T09:00:00.0000000", timeZone: "UTC" },
      end: { dateTime: "2026-03-16T09:15:00.0000000", timeZone: "UTC" },
      location: { displayName: "" },
      attendees: [],
      organizer: { emailAddress: { name: "Alice", address: "alice@example.com" } },
      recurrence: {
        pattern: { type: "daily", interval: 1 },
        range: { type: "noEnd", startDate: "2026-03-16" },
      },
      isAllDay: false,
      responseStatus: { response: "organizer", time: "0001-01-01T00:00:00Z" },
      onlineMeeting: null,
      showAs: "busy",
      sensitivity: "normal",
    });

    const tool = createGetEventTool(mockGraph as unknown as GraphClient);
    const result = await tool.handler({ eventId: "evt-2" });

    const text = result.content[0].text;
    expect(text).toContain("daily");
  });

  it("handles event with no online meeting or location", async () => {
    mockGraph.get.mockResolvedValue({
      id: "evt-3",
      subject: "Quick Chat",
      body: { contentType: "text", content: "" },
      start: { dateTime: "2026-03-16T14:00:00.0000000", timeZone: "UTC" },
      end: { dateTime: "2026-03-16T14:30:00.0000000", timeZone: "UTC" },
      location: { displayName: "" },
      attendees: [],
      organizer: { emailAddress: { name: "Alice", address: "alice@example.com" } },
      recurrence: null,
      isAllDay: false,
      responseStatus: { response: "accepted", time: "2026-03-15T00:00:00Z" },
      onlineMeeting: null,
      showAs: "tentative",
      sensitivity: "private",
    });

    const tool = createGetEventTool(mockGraph as unknown as GraphClient);
    const result = await tool.handler({ eventId: "evt-3" });

    const text = result.content[0].text;
    expect(text).toContain("Quick Chat");
    expect(text).toContain("private");
  });
});
