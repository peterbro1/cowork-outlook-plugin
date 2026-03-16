import { describe, it, expect, vi, beforeEach } from "vitest";
import { createListMessagesTool } from "../../../src/tools/mail/list-messages.js";

const mockGraph = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
};

describe("list_messages tool", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should have correct tool metadata", () => {
    const tool = createListMessagesTool(mockGraph);
    expect(tool.name).toBe("list_messages");
    expect(tool.description).toBeTruthy();
    expect(tool.inputSchema).toBeDefined();
  });

  it("should list messages from inbox with defaults", async () => {
    mockGraph.get.mockResolvedValue({
      value: [
        {
          id: "msg1",
          subject: "Hello",
          sender: { emailAddress: { name: "Alice", address: "alice@example.com" } },
          receivedDateTime: "2026-03-15T10:00:00Z",
          isRead: true,
          bodyPreview: "Hi there",
        },
        {
          id: "msg2",
          subject: "Meeting",
          sender: { emailAddress: { name: "Bob", address: "bob@example.com" } },
          receivedDateTime: "2026-03-14T09:00:00Z",
          isRead: false,
          bodyPreview: "Let's meet",
        },
      ],
    });

    const tool = createListMessagesTool(mockGraph);
    const result = await tool.handler({});

    expect(mockGraph.get).toHaveBeenCalledWith(
      "/me/messages?$select=id,subject,sender,receivedDateTime,isRead,bodyPreview&$top=10&$skip=0&$orderby=receivedDateTime desc"
    );

    const text = result.content[0].text;
    expect(text).toContain("id|received|from|subject|preview");
    expect(text).toContain("msg1|");
    expect(text).toContain("Alice");
    expect(text).toContain("Hello");
    expect(text).toContain("msg2|");
    expect(text).toContain("Bob");
  });

  it("should use folderId when provided", async () => {
    mockGraph.get.mockResolvedValue({ value: [] });

    const tool = createListMessagesTool(mockGraph);
    await tool.handler({ folderId: "folder123" });

    expect(mockGraph.get).toHaveBeenCalledWith(
      expect.stringContaining("/me/mailFolders/folder123/messages")
    );
  });

  it("should respect top and skip parameters", async () => {
    mockGraph.get.mockResolvedValue({ value: [] });

    const tool = createListMessagesTool(mockGraph);
    await tool.handler({ top: 5, skip: 10 });

    expect(mockGraph.get).toHaveBeenCalledWith(
      expect.stringContaining("$top=5")
    );
    expect(mockGraph.get).toHaveBeenCalledWith(
      expect.stringContaining("$skip=10")
    );
  });

  it("should clamp top to 1-50 range", async () => {
    mockGraph.get.mockResolvedValue({ value: [] });

    const tool = createListMessagesTool(mockGraph);
    await tool.handler({ top: 100 });

    expect(mockGraph.get).toHaveBeenCalledWith(
      expect.stringContaining("$top=50")
    );
  });

  it("should clamp top minimum to 1", async () => {
    mockGraph.get.mockResolvedValue({ value: [] });

    const tool = createListMessagesTool(mockGraph);
    await tool.handler({ top: 0 });

    expect(mockGraph.get).toHaveBeenCalledWith(
      expect.stringContaining("$top=1")
    );
  });

  it("should include hasMore info when results equal top", async () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({
      id: `msg${i}`,
      subject: `Subject ${i}`,
      sender: { emailAddress: { name: "Test", address: "test@example.com" } },
      receivedDateTime: "2026-03-15T10:00:00Z",
      isRead: true,
      bodyPreview: "Preview",
    }));
    mockGraph.get.mockResolvedValue({ value: messages });

    const tool = createListMessagesTool(mockGraph);
    const result = await tool.handler({});

    const text = result.content[0].text;
    expect(text).toContain("hasMore: true");
    expect(text).toContain("nextSkip: 10");
  });

  it("should show hasMore false when results less than top", async () => {
    mockGraph.get.mockResolvedValue({
      value: [
        {
          id: "msg1",
          subject: "Only one",
          sender: { emailAddress: { name: "Test", address: "test@example.com" } },
          receivedDateTime: "2026-03-15T10:00:00Z",
          isRead: true,
          bodyPreview: "Preview",
        },
      ],
    });

    const tool = createListMessagesTool(mockGraph);
    const result = await tool.handler({});

    const text = result.content[0].text;
    expect(text).toContain("hasMore: false");
  });

  it("should handle empty results", async () => {
    mockGraph.get.mockResolvedValue({ value: [] });

    const tool = createListMessagesTool(mockGraph);
    const result = await tool.handler({});

    const text = result.content[0].text;
    expect(text).toContain("No messages found");
  });
});
