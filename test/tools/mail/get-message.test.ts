import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGetMessageTool } from "../../../src/tools/mail/get-message.js";

const mockGraph = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
};

describe("get_message tool", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should have correct tool metadata", () => {
    const tool = createGetMessageTool(mockGraph);
    expect(tool.name).toBe("get_message");
    expect(tool.inputSchema).toBeDefined();
  });

  it("should fetch message by ID with correct select fields", async () => {
    mockGraph.get.mockResolvedValue({
      id: "msg1",
      subject: "Test Subject",
      sender: { emailAddress: { name: "Alice", address: "alice@example.com" } },
      from: { emailAddress: { name: "Alice", address: "alice@example.com" } },
      toRecipients: [{ emailAddress: { name: "Bob", address: "bob@example.com" } }],
      ccRecipients: [],
      receivedDateTime: "2026-03-15T10:00:00Z",
      body: { contentType: "html", content: "<p>Hello <b>World</b></p>" },
      isRead: true,
      hasAttachments: false,
      importance: "normal",
      categories: ["Work"],
    });

    const tool = createGetMessageTool(mockGraph);
    const result = await tool.handler({ messageId: "msg1" });

    expect(mockGraph.get).toHaveBeenCalledWith(
      "/me/messages/msg1?$select=id,subject,sender,from,toRecipients,ccRecipients,receivedDateTime,body,isRead,hasAttachments,importance,categories"
    );

    const text = result.content[0].text;
    expect(text).toContain("Test Subject");
    expect(text).toContain("Alice");
    expect(text).toContain("Bob");
    expect(text).toContain("Hello World");
    expect(text).not.toContain("<p>");
    expect(text).not.toContain("<b>");
  });

  it("should strip HTML tags from body", async () => {
    mockGraph.get.mockResolvedValue({
      id: "msg1",
      subject: "HTML Test",
      sender: { emailAddress: { name: "Test", address: "test@example.com" } },
      from: { emailAddress: { name: "Test", address: "test@example.com" } },
      toRecipients: [],
      ccRecipients: [],
      receivedDateTime: "2026-03-15T10:00:00Z",
      body: { contentType: "html", content: "<div><p>Line 1</p><br><p>Line 2</p></div>" },
      isRead: false,
      hasAttachments: true,
      importance: "high",
      categories: [],
    });

    const tool = createGetMessageTool(mockGraph);
    const result = await tool.handler({ messageId: "msg1" });

    const text = result.content[0].text;
    expect(text).toContain("Line 1");
    expect(text).toContain("Line 2");
    expect(text).not.toContain("<div>");
    expect(text).not.toContain("<p>");
  });

  it("should decode HTML entities", async () => {
    mockGraph.get.mockResolvedValue({
      id: "msg1",
      subject: "Entity Test",
      sender: { emailAddress: { name: "Test", address: "test@example.com" } },
      from: { emailAddress: { name: "Test", address: "test@example.com" } },
      toRecipients: [],
      ccRecipients: [],
      receivedDateTime: "2026-03-15T10:00:00Z",
      body: { contentType: "html", content: "A &amp; B &lt; C &gt; D &quot;E&quot;" },
      isRead: true,
      hasAttachments: false,
      importance: "normal",
      categories: [],
    });

    const tool = createGetMessageTool(mockGraph);
    const result = await tool.handler({ messageId: "msg1" });

    const text = result.content[0].text;
    expect(text).toContain('A & B < C > D "E"');
  });

  it("should display multiple to and cc recipients", async () => {
    mockGraph.get.mockResolvedValue({
      id: "msg1",
      subject: "Multi Recipient",
      sender: { emailAddress: { name: "Sender", address: "sender@example.com" } },
      from: { emailAddress: { name: "Sender", address: "sender@example.com" } },
      toRecipients: [
        { emailAddress: { name: "To1", address: "to1@example.com" } },
        { emailAddress: { name: "To2", address: "to2@example.com" } },
      ],
      ccRecipients: [
        { emailAddress: { name: "Cc1", address: "cc1@example.com" } },
      ],
      receivedDateTime: "2026-03-15T10:00:00Z",
      body: { contentType: "text", content: "Plain text body" },
      isRead: true,
      hasAttachments: false,
      importance: "normal",
      categories: [],
    });

    const tool = createGetMessageTool(mockGraph);
    const result = await tool.handler({ messageId: "msg1" });

    const text = result.content[0].text;
    expect(text).toContain("To1");
    expect(text).toContain("To2");
    expect(text).toContain("Cc1");
    expect(text).toContain("Plain text body");
  });

  it("should require messageId", () => {
    const tool = createGetMessageTool(mockGraph);
    expect(tool.inputSchema.required).toContain("messageId");
  });
});
