export interface GraphClient {
  get(path: string): Promise<any>;
  post(path: string, body: any): Promise<any>;
  patch(path: string, body: any): Promise<any>;
  getPaginated(path: string, maxItems?: number): Promise<any[]>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  handler: (args: any) => Promise<{
    content: Array<{ type: "text"; text: string }>;
  }>;
}
