import { describe, it, expect, vi, beforeEach } from "vitest";
import { createListFoldersTool } from "../../../src/tools/mail/list-folders.js";

const mockGraph = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
};

describe("list_mail_folders tool", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should have correct tool metadata", () => {
    const tool = createListFoldersTool(mockGraph);
    expect(tool.name).toBe("list_mail_folders");
    expect(tool.inputSchema).toBeDefined();
  });

  it("should list mail folders", async () => {
    mockGraph.get.mockResolvedValue({
      value: [
        { id: "folder1", displayName: "Inbox", unreadItemCount: 5, totalItemCount: 100 },
        { id: "folder2", displayName: "Sent Items", unreadItemCount: 0, totalItemCount: 50 },
      ],
    });

    const tool = createListFoldersTool(mockGraph);
    const result = await tool.handler({});

    expect(mockGraph.get).toHaveBeenCalledWith("/me/mailFolders?$top=50");

    const text = result.content[0].text;
    expect(text).toContain("id|name|unread|total");
    expect(text).toContain("folder1|Inbox|5|100");
    expect(text).toContain("folder2|Sent Items|0|50");
  });

  it("should handle empty folder list", async () => {
    mockGraph.get.mockResolvedValue({ value: [] });

    const tool = createListFoldersTool(mockGraph);
    const result = await tool.handler({});

    const text = result.content[0].text;
    expect(text).toContain("No folders found");
  });
});
