import { describe, it, expect, vi, beforeEach } from "vitest";
import { createListCalendarsTool } from "../../../src/tools/calendar/list-calendars.js";
import type { GraphClient } from "../../../src/tools/types.js";

describe("list_calendars", () => {
  let mockGraph: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockGraph = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
    };
  });

  it("has correct tool name and schema", () => {
    const tool = createListCalendarsTool(mockGraph as unknown as GraphClient);
    expect(tool.name).toBe("list_calendars");
    expect(tool.inputSchema).toBeDefined();
  });

  it("calls correct Graph API path", async () => {
    mockGraph.get.mockResolvedValue({ value: [] });

    const tool = createListCalendarsTool(mockGraph as unknown as GraphClient);
    await tool.handler({});

    expect(mockGraph.get).toHaveBeenCalledWith(
      "/me/calendars?$select=id,name,color,isDefaultCalendar,canEdit",
    );
  });

  it("formats output as pipe-delimited lines", async () => {
    mockGraph.get.mockResolvedValue({
      value: [
        { id: "cal-1", name: "Calendar", color: "auto", isDefaultCalendar: true, canEdit: true },
        { id: "cal-2", name: "Work", color: "lightBlue", isDefaultCalendar: false, canEdit: false },
      ],
    });

    const tool = createListCalendarsTool(mockGraph as unknown as GraphClient);
    const result = await tool.handler({});

    const text = result.content[0].text;
    expect(text).toContain("cal-1|Calendar|auto|true|true");
    expect(text).toContain("cal-2|Work|lightBlue|false|false");
  });

  it("handles empty calendar list", async () => {
    mockGraph.get.mockResolvedValue({ value: [] });

    const tool = createListCalendarsTool(mockGraph as unknown as GraphClient);
    const result = await tool.handler({});

    const text = result.content[0].text;
    expect(text).toContain("No calendars found");
  });
});
