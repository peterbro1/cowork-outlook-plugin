import type { GraphClient, ToolDefinition } from "../types.js";
import { createListMessagesTool } from "./list-messages.js";
import { createGetMessageTool } from "./get-message.js";
import { createSearchMessagesTool } from "./search-messages.js";
import { createListFoldersTool } from "./list-folders.js";
import { createArchiveMessageTool } from "./archive-message.js";
import { createMarkReadTool } from "./mark-read.js";
import { createDraftTool } from "./create-draft.js";
import { createCreateFolderTool } from "./create-folder.js";
import { createMoveMessageTool } from "./move-message.js";

export function createMailTools(graph: GraphClient): ToolDefinition[] {
  return [
    createListMessagesTool(graph),
    createGetMessageTool(graph),
    createSearchMessagesTool(graph),
    createListFoldersTool(graph),
    createArchiveMessageTool(graph),
    createMarkReadTool(graph),
    createDraftTool(graph),
    createCreateFolderTool(graph),
    createMoveMessageTool(graph),
  ];
}

export {
  createListMessagesTool,
  createGetMessageTool,
  createSearchMessagesTool,
  createListFoldersTool,
  createArchiveMessageTool,
  createMarkReadTool,
  createDraftTool,
  createCreateFolderTool,
  createMoveMessageTool,
};
