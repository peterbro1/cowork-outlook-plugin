import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSearchMessagesTool } from "../../../src/tools/mail/search-messages.js";

const mockGraph = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
};

describe("search_messages tool", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should have correct tool metadata", () => {
    const tool = createSearchMessagesTool(mockGraph);
    expect(tool.name).toBe("search_messages");
    expect(tool.inputSchema.required).toContain("query");
  });

  it("should search messages with query", async () => {
    mockGraph.get.mockResolvedValue({
      value: [
        {
          id: "msg1",
          subject: "Budget Report",
          sender: { emailAddress: { name: "Finance", address: "finance@example.com" } },
          receivedDateTime: "2026-03-15T10:00:00Z",
          isRead: true,
          bodyPreview: "Q1 budget attached",
        },
      ],
    });

    const tool = createSearchMessagesTool(mockGraph);
    const result = await tool.handler({ query: "budget" });

    expect(mockGraph.get).toHaveBeenCalledWith(
      '/me/messages?$search="budget"&$select=id,subject,sender,receivedDateTime,bodyPreview&$top=10'
    );

    const text = result.content[0].text;
    expect(text).toContain("Budget Report");
    expect(text).toContain("Finance");
  });

  it("should use custom top value", async () => {
    mockGraph.get.mockResolvedValue({ value: [] });

    const tool = createSearchMessagesTool(mockGraph);
    await tool.handler({ query: "test", top: 5 });

    expect(mockGraph.get).toHaveBeenCalledWith(
      expect.stringContaining("$top=5")
    );
  });

  it("should clamp top to 1-25 range", async () => {
    mockGraph.get.mockResolvedValue({ value: [] });

    const tool = createSearchMessagesTool(mockGraph);
    await tool.handler({ query: "test", top: 100 });

    expect(mockGraph.get).toHaveBeenCalledWith(
      expect.stringContaining("$top=25")
    );
  });

  it("should handle empty search results", async () => {
    mockGraph.get.mockResolvedValue({ value: [] });

    const tool = createSearchMessagesTool(mockGraph);
    const result = await tool.handler({ query: "nonexistent" });

    const text = result.content[0].text;
    expect(text).toContain("No messages found");
  });

  it("should format results as pipe-delimited", async () => {
    mockGraph.get.mockResolvedValue({
      value: [
        {
          id: "msg1",
          subject: "Test",
          sender: { emailAddress: { name: "User", address: "user@example.com" } },
          receivedDateTime: "2026-03-15T10:00:00Z",
          isRead: false,
          bodyPreview: "Preview text",
        },
      ],
    });

    const tool = createSearchMessagesTool(mockGraph);
    const result = await tool.handler({ query: "test" });

    const text = result.content[0].text;
    const lines = text.split("\n");
    expect(lines[0]).toBe("id|received|from|subject|preview");
    expect(lines[1]).toContain("|");
    expect(lines[1]).toContain("msg1");
  });
});
