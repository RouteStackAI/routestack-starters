// RouteStack API Credentials for n8n
// TODO: Implement n8n credential type

export class RouteStackApi {
  name = "routeStackApi";
  displayName = "RouteStack API";
  properties = [
    {
      displayName: "API Key",
      name: "apiKey",
      type: "string" as const,
      default: "",
    },
    {
      displayName: "MCP URL",
      name: "mcpUrl",
      type: "string" as const,
      default: "https://mcp.routestack.ai/sse",
    },
  ];
}
