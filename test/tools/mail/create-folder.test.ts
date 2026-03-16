import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCreateFolderTool } from "../../../src/tools/mail/create-folder.js";

const mockGraph = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
};

describe("create_mail_folder tool", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should have correct tool metadata", () => {
    const tool = createCreateFolderTool(mockGraph);
    expect(tool.name).toBe("create_mail_folder");
    expect(tool.inputSchema.required).toContain("displayName");
  });

  it("should create a top-level folder when no parentFolderId is provided", async () => {
    mockGraph.post.mockResolvedValue({
      id: "new-folder-id",
      displayName: "My Folder",
    });

    const tool = createCreateFolderTool(mockGraph);
    const result = await tool.handler({ displayName: "My Folder" });

    expect(mockGraph.post).toHaveBeenCalledWith("/me/mailFolders", {
      displayName: "My Folder",
    });

    const text = result.content[0].text;
    expect(text).toContain("My Folder");
    expect(text).toContain("new-folder-id");
  });

  it("should create a subfolder when parentFolderId is provided", async () => {
    mockGraph.post.mockResolvedValue({
      id: "sub-folder-id",
      displayName: "Sub Folder",
    });

    const tool = createCreateFolderTool(mockGraph);
    const result = await tool.handler({
      displayName: "Sub Folder",
      parentFolderId: "parent-123",
    });

    expect(mockGraph.post).toHaveBeenCalledWith(
      "/me/mailFolders/parent-123/childFolders",
      { displayName: "Sub Folder" }
    );

    const text = result.content[0].text;
    expect(text).toContain("Sub Folder");
    expect(text).toContain("sub-folder-id");
  });

  it("should return the folder name and ID in output", async () => {
    mockGraph.post.mockResolvedValue({
      id: "folder-abc",
      displayName: "Reports",
    });

    const tool = createCreateFolderTool(mockGraph);
    const result = await tool.handler({ displayName: "Reports" });

    const text = result.content[0].text;
    expect(text).toContain("Created folder 'Reports'");
    expect(text).toContain("id: folder-abc");
  });

  it("should call correct Graph API path for top-level folder", async () => {
    mockGraph.post.mockResolvedValue({ id: "id1", displayName: "Test" });

    const tool = createCreateFolderTool(mockGraph);
    await tool.handler({ displayName: "Test" });

    expect(mockGraph.post).toHaveBeenCalledWith("/me/mailFolders", {
      displayName: "Test",
    });
  });

  it("should call correct Graph API path for subfolder", async () => {
    mockGraph.post.mockResolvedValue({ id: "id2", displayName: "Child" });

    const tool = createCreateFolderTool(mockGraph);
    await tool.handler({ displayName: "Child", parentFolderId: "parent-xyz" });

    expect(mockGraph.post).toHaveBeenCalledWith(
      "/me/mailFolders/parent-xyz/childFolders",
      { displayName: "Child" }
    );
  });
});
