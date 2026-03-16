import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRsvpEventTool } from "../../../src/tools/calendar/rsvp-event.js";
import type { GraphClient } from "../../../src/tools/types.js";

describe("rsvp_event", () => {
  let mockGraph: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockGraph = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
    };
  });

  it("has correct tool name", () => {
    const tool = createRsvpEventTool(mockGraph as unknown as GraphClient);
    expect(tool.name).toBe("rsvp_event");
  });

  it("calls POST to accept endpoint", async () => {
    mockGraph.post.mockResolvedValue({});

    const tool = createRsvpEventTool(mockGraph as unknown as GraphClient);
    await tool.handler({ eventId: "evt-1", response: "accept" });

    expect(mockGraph.post).toHaveBeenCalledWith(
      "/me/events/evt-1/accept",
      expect.objectContaining({ sendResponse: true }),
    );
  });

  it("calls POST to tentativelyAccept endpoint", async () => {
    mockGraph.post.mockResolvedValue({});

    const tool = createRsvpEventTool(mockGraph as unknown as GraphClient);
    await tool.handler({ eventId: "evt-1", response: "tentativelyAccept" });

    expect(mockGraph.post).toHaveBeenCalledWith(
      "/me/events/evt-1/tentativelyAccept",
      expect.any(Object),
    );
  });

  it("calls POST to decline endpoint", async () => {
    mockGraph.post.mockResolvedValue({});

    const tool = createRsvpEventTool(mockGraph as unknown as GraphClient);
    await tool.handler({ eventId: "evt-1", response: "decline" });

    expect(mockGraph.post).toHaveBeenCalledWith(
      "/me/events/evt-1/decline",
      expect.any(Object),
    );
  });

  it("includes comment in body", async () => {
    mockGraph.post.mockResolvedValue({});

    const tool = createRsvpEventTool(mockGraph as unknown as GraphClient);
    await tool.handler({
      eventId: "evt-1",
      response: "accept",
      comment: "Looking forward to it!",
    });

    const body = mockGraph.post.mock.calls[0][1];
    expect(body.comment).toBe("Looking forward to it!");
  });

  it("defaults sendResponse to true", async () => {
    mockGraph.post.mockResolvedValue({});

    const tool = createRsvpEventTool(mockGraph as unknown as GraphClient);
    await tool.handler({ eventId: "evt-1", response: "accept" });

    const body = mockGraph.post.mock.calls[0][1];
    expect(body.sendResponse).toBe(true);
  });

  it("respects sendResponse=false", async () => {
    mockGraph.post.mockResolvedValue({});

    const tool = createRsvpEventTool(mockGraph as unknown as GraphClient);
    await tool.handler({
      eventId: "evt-1",
      response: "decline",
      sendResponse: false,
    });

    const body = mockGraph.post.mock.calls[0][1];
    expect(body.sendResponse).toBe(false);
  });

  it("returns confirmation with response type", async () => {
    mockGraph.post.mockResolvedValue({});

    const tool = createRsvpEventTool(mockGraph as unknown as GraphClient);
    const result = await tool.handler({ eventId: "evt-1", response: "accept" });

    const text = result.content[0].text;
    expect(text.toLowerCase()).toContain("accept");
    expect(text).toContain("evt-1");
  });
});
