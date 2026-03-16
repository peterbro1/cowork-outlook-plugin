import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMoveMessageTool } from "../../../src/tools/mail/move-message.js";

const mockGraph = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
};

describe("move_message tool", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should have correct tool metadata", () => {
    const tool = createMoveMessageTool(mockGraph);
    expect(tool.name).toBe("move_message");
    expect(tool.inputSchema.required).toContain("messageIds");
    expect(tool.inputSchema.required).toContain("destinationFolderId");
  });

  it("should move a single message successfully", async () => {
    mockGraph.post.mockResolvedValue({ id: "msg1", parentFolderId: "dest-folder" });

    const tool = createMoveMessageTool(mockGraph);
    const result = await tool.handler({
      messageIds: ["msg1"],
      destinationFolderId: "dest-folder",
    });

    expect(mockGraph.post).toHaveBeenCalledWith("/me/messages/msg1/move", {
      destinationId: "dest-folder",
    });

    const text = result.content[0].text;
    expect(text).toContain("1 of 1");
  });

  it("should move multiple messages", async () => {
    mockGraph.post.mockResolvedValue({ id: "any" });

    const tool = createMoveMessageTool(mockGraph);
    const result = await tool.handler({
      messageIds: ["msg1", "msg2", "msg3"],
      destinationFolderId: "target-folder",
    });

    expect(mockGraph.post).toHaveBeenCalledTimes(3);
    expect(mockGraph.post).toHaveBeenCalledWith("/me/messages/msg1/move", {
      destinationId: "target-folder",
    });
    expect(mockGraph.post).toHaveBeenCalledWith("/me/messages/msg2/move", {
      destinationId: "target-folder",
    });
    expect(mockGraph.post).toHaveBeenCalledWith("/me/messages/msg3/move", {
      destinationId: "target-folder",
    });

    const text = result.content[0].text;
    expect(text).toContain("3 of 3");
  });

  it("should handle partial failures", async () => {
    mockGraph.post
      .mockResolvedValueOnce({ id: "msg1" })
      .mockRejectedValueOnce(new Error("Not found"))
      .mockResolvedValueOnce({ id: "msg3" });

    const tool = createMoveMessageTool(mockGraph);
    const result = await tool.handler({
      messageIds: ["msg1", "msg2", "msg3"],
      destinationFolderId: "folder-x",
    });

    const text = result.content[0].text;
    expect(text).toContain("2 of 3");
    expect(text).toMatch(/fail|error/i);
    expect(text).toContain("msg2");
  });

  it("should report correct counts in output", async () => {
    mockGraph.post
      .mockResolvedValueOnce({ id: "msg1" })
      .mockRejectedValueOnce(new Error("Server error"));

    const tool = createMoveMessageTool(mockGraph);
    const result = await tool.handler({
      messageIds: ["msg1", "msg2"],
      destinationFolderId: "folder-y",
    });

    const text = result.content[0].text;
    expect(text).toContain("Moved 1 of 2");
    expect(text).toMatch(/fail/i);
  });

  it("should call correct Graph API path with correct body", async () => {
    mockGraph.post.mockResolvedValue({ id: "msg-abc" });

    const tool = createMoveMessageTool(mockGraph);
    await tool.handler({
      messageIds: ["msg-abc"],
      destinationFolderId: "folder-def",
    });

    expect(mockGraph.post).toHaveBeenCalledWith("/me/messages/msg-abc/move", {
      destinationId: "folder-def",
    });
  });
});
