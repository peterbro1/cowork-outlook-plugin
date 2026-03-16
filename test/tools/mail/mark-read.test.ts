import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMarkReadTool } from "../../../src/tools/mail/mark-read.js";

const mockGraph = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
};

describe("mark_message_read tool", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should have correct tool metadata", () => {
    const tool = createMarkReadTool(mockGraph);
    expect(tool.name).toBe("mark_message_read");
    expect(tool.inputSchema.required).toContain("messageId");
    expect(tool.inputSchema.required).toContain("isRead");
  });

  it("should mark a message as read", async () => {
    mockGraph.patch.mockResolvedValue({ id: "msg1", isRead: true });

    const tool = createMarkReadTool(mockGraph);
    const result = await tool.handler({ messageId: "msg1", isRead: true });

    expect(mockGraph.patch).toHaveBeenCalledWith(
      "/me/messages/msg1",
      { isRead: true }
    );

    const text = result.content[0].text;
    expect(text).toMatch(/read/i);
  });

  it("should mark a message as unread", async () => {
    mockGraph.patch.mockResolvedValue({ id: "msg1", isRead: false });

    const tool = createMarkReadTool(mockGraph);
    const result = await tool.handler({ messageId: "msg1", isRead: false });

    expect(mockGraph.patch).toHaveBeenCalledWith(
      "/me/messages/msg1",
      { isRead: false }
    );

    const text = result.content[0].text;
    expect(text).toMatch(/unread/i);
  });
});
