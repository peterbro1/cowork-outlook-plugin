import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDraftTool } from "../../../src/tools/mail/create-draft.js";

const mockGraph = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
};

describe("create_draft tool", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should have correct tool metadata", () => {
    const tool = createDraftTool(mockGraph);
    expect(tool.name).toBe("create_draft");
    expect(tool.inputSchema.required).toContain("subject");
    expect(tool.inputSchema.required).toContain("body");
    expect(tool.inputSchema.required).toContain("toRecipients");
  });

  it("should create a draft with required fields", async () => {
    mockGraph.post.mockResolvedValue({ id: "draft1", subject: "Hello" });

    const tool = createDraftTool(mockGraph);
    const result = await tool.handler({
      subject: "Hello",
      body: "Hi there",
      toRecipients: ["alice@example.com"],
    });

    expect(mockGraph.post).toHaveBeenCalledWith("/me/messages", {
      subject: "Hello",
      body: { contentType: "html", content: "Hi there" },
      toRecipients: [{ emailAddress: { address: "alice@example.com" } }],
      importance: "normal",
    });

    const text = result.content[0].text;
    expect(text).toContain("draft1");
    expect(text).toMatch(/draft|created/i);
  });

  it("should support text body type", async () => {
    mockGraph.post.mockResolvedValue({ id: "draft2" });

    const tool = createDraftTool(mockGraph);
    await tool.handler({
      subject: "Plain",
      body: "Plain text",
      bodyType: "text",
      toRecipients: ["bob@example.com"],
    });

    expect(mockGraph.post).toHaveBeenCalledWith("/me/messages", expect.objectContaining({
      body: { contentType: "text", content: "Plain text" },
    }));
  });

  it("should support cc recipients", async () => {
    mockGraph.post.mockResolvedValue({ id: "draft3" });

    const tool = createDraftTool(mockGraph);
    await tool.handler({
      subject: "With CC",
      body: "Body",
      toRecipients: ["to@example.com"],
      ccRecipients: ["cc1@example.com", "cc2@example.com"],
    });

    expect(mockGraph.post).toHaveBeenCalledWith("/me/messages", expect.objectContaining({
      ccRecipients: [
        { emailAddress: { address: "cc1@example.com" } },
        { emailAddress: { address: "cc2@example.com" } },
      ],
    }));
  });

  it("should support importance", async () => {
    mockGraph.post.mockResolvedValue({ id: "draft4" });

    const tool = createDraftTool(mockGraph);
    await tool.handler({
      subject: "Urgent",
      body: "Important!",
      toRecipients: ["boss@example.com"],
      importance: "high",
    });

    expect(mockGraph.post).toHaveBeenCalledWith("/me/messages", expect.objectContaining({
      importance: "high",
    }));
  });

  it("should support multiple to recipients", async () => {
    mockGraph.post.mockResolvedValue({ id: "draft5" });

    const tool = createDraftTool(mockGraph);
    await tool.handler({
      subject: "Group",
      body: "Hello all",
      toRecipients: ["a@example.com", "b@example.com"],
    });

    expect(mockGraph.post).toHaveBeenCalledWith("/me/messages", expect.objectContaining({
      toRecipients: [
        { emailAddress: { address: "a@example.com" } },
        { emailAddress: { address: "b@example.com" } },
      ],
    }));
  });
});
