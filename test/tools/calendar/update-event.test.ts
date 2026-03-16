import { describe, it, expect, vi, beforeEach } from "vitest";
import { createUpdateEventTool } from "../../../src/tools/calendar/update-event.js";
import type { GraphClient } from "../../../src/tools/types.js";

describe("update_event", () => {
  let mockGraph: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockGraph = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
    };
  });

  it("has correct tool name", () => {
    const tool = createUpdateEventTool(mockGraph as unknown as GraphClient);
    expect(tool.name).toBe("update_event");
  });

  it("calls PATCH with correct path", async () => {
    mockGraph.patch.mockResolvedValue({ id: "evt-1" });

    const tool = createUpdateEventTool(mockGraph as unknown as GraphClient);
    await tool.handler({ eventId: "evt-1", subject: "Updated Subject" });

    expect(mockGraph.patch).toHaveBeenCalledWith(
      "/me/events/evt-1",
      expect.any(Object),
    );
  });

  it("only includes changed fields in patch body", async () => {
    mockGraph.patch.mockResolvedValue({ id: "evt-1" });

    const tool = createUpdateEventTool(mockGraph as unknown as GraphClient);
    await tool.handler({ eventId: "evt-1", subject: "New Subject" });

    const body = mockGraph.patch.mock.calls[0][1];
    expect(body).toEqual({ subject: "New Subject" });
    expect(body).not.toHaveProperty("start");
    expect(body).not.toHaveProperty("end");
    expect(body).not.toHaveProperty("body");
    expect(body).not.toHaveProperty("location");
  });

  it("formats start with timezone when provided", async () => {
    mockGraph.patch.mockResolvedValue({ id: "evt-1" });

    const tool = createUpdateEventTool(mockGraph as unknown as GraphClient);
    await tool.handler({
      eventId: "evt-1",
      start: "2026-03-20T14:00:00",
      startTimeZone: "Australia/Brisbane",
    });

    const body = mockGraph.patch.mock.calls[0][1];
    expect(body.start).toEqual({ dateTime: "2026-03-20T14:00:00", timeZone: "Australia/Brisbane" });
  });

  it("formats end with timezone when provided", async () => {
    mockGraph.patch.mockResolvedValue({ id: "evt-1" });

    const tool = createUpdateEventTool(mockGraph as unknown as GraphClient);
    await tool.handler({
      eventId: "evt-1",
      end: "2026-03-20T15:00:00",
      endTimeZone: "Australia/Brisbane",
    });

    const body = mockGraph.patch.mock.calls[0][1];
    expect(body.end).toEqual({ dateTime: "2026-03-20T15:00:00", timeZone: "Australia/Brisbane" });
  });

  it("includes body as html content", async () => {
    mockGraph.patch.mockResolvedValue({ id: "evt-1" });

    const tool = createUpdateEventTool(mockGraph as unknown as GraphClient);
    await tool.handler({
      eventId: "evt-1",
      body: "Updated notes",
    });

    const patchBody = mockGraph.patch.mock.calls[0][1];
    expect(patchBody.body).toEqual({ contentType: "html", content: "Updated notes" });
  });

  it("includes location when provided", async () => {
    mockGraph.patch.mockResolvedValue({ id: "evt-1" });

    const tool = createUpdateEventTool(mockGraph as unknown as GraphClient);
    await tool.handler({
      eventId: "evt-1",
      location: "New Room",
    });

    const patchBody = mockGraph.patch.mock.calls[0][1];
    expect(patchBody.location).toEqual({ displayName: "New Room" });
  });

  it("handles multiple fields updated at once", async () => {
    mockGraph.patch.mockResolvedValue({ id: "evt-1" });

    const tool = createUpdateEventTool(mockGraph as unknown as GraphClient);
    await tool.handler({
      eventId: "evt-1",
      subject: "New Title",
      location: "Room B",
      body: "New body",
    });

    const patchBody = mockGraph.patch.mock.calls[0][1];
    expect(patchBody.subject).toBe("New Title");
    expect(patchBody.location).toEqual({ displayName: "Room B" });
    expect(patchBody.body).toEqual({ contentType: "html", content: "New body" });
  });

  it("returns confirmation", async () => {
    mockGraph.patch.mockResolvedValue({ id: "evt-1" });

    const tool = createUpdateEventTool(mockGraph as unknown as GraphClient);
    const result = await tool.handler({ eventId: "evt-1", subject: "Updated" });

    const text = result.content[0].text;
    expect(text.toLowerCase()).toContain("updated");
    expect(text).toContain("evt-1");
  });
});
