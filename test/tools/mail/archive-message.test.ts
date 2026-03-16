import { describe, it, expect, vi, beforeEach } from "vitest";
import { createArchiveMessageTool } from "../../../src/tools/mail/archive-message.js";

const mockGraph = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
};

describe("archive_message tool", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should have correct tool metadata", () => {
    const tool = createArchiveMessageTool(mockGraph);
    expect(tool.name).toBe("archive_message");
    expect(tool.inputSchema.required).toContain("messageIds");
  });

  it("should archive a single message", async () => {
    mockGraph.post.mockResolvedValue({ id: "msg1", parentFolderId: "archive" });

    const tool = createArchiveMessageTool(mockGraph);
    const result = await tool.handler({ messageIds: ["msg1"] });

    expect(mockGraph.post).toHaveBeenCalledWith(
      "/me/messages/msg1/move",
      { destinationId: "archive" }
    );

    const text = result.content[0].text;
    expect(text).toContain("1");
    expect(text).toMatch(/moved|archived/i);
  });

  it("should archive multiple messages", async () => {
    mockGraph.post.mockResolvedValue({ id: "any", parentFolderId: "archive" });

    const tool = createArchiveMessageTool(mockGraph);
    const result = await tool.handler({ messageIds: ["msg1", "msg2", "msg3"] });

    expect(mockGraph.post).toHaveBeenCalledTimes(3);
    expect(mockGraph.post).toHaveBeenCalledWith("/me/messages/msg1/move", { destinationId: "archive" });
    expect(mockGraph.post).toHaveBeenCalledWith("/me/messages/msg2/move", { destinationId: "archive" });
    expect(mockGraph.post).toHaveBeenCalledWith("/me/messages/msg3/move", { destinationId: "archive" });

    const text = result.content[0].text;
    expect(text).toContain("3");
  });

  it("should report failures", async () => {
    mockGraph.post
      .mockResolvedValueOnce({ id: "msg1", parentFolderId: "archive" })
      .mockRejectedValueOnce(new Error("Not found"));

    const tool = createArchiveMessageTool(mockGraph);
    const result = await tool.handler({ messageIds: ["msg1", "msg2"] });

    const text = result.content[0].text;
    expect(text).toContain("1");
    expect(text).toMatch(/fail|error/i);
  });

  it("should handle all failures", async () => {
    mockGraph.post.mockRejectedValue(new Error("Server error"));

    const tool = createArchiveMessageTool(mockGraph);
    const result = await tool.handler({ messageIds: ["msg1"] });

    const text = result.content[0].text;
    expect(text).toMatch(/fail|error/i);
  });
});
