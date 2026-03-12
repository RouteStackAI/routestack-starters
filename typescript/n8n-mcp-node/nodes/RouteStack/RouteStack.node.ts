// RouteStack n8n Node
// TODO: Implement n8n node with Search Flights, Search Hotels, Search Cars actions

export class RouteStack {
  description = {
    displayName: "RouteStack",
    name: "routeStack",
    group: ["transform"],
    version: 1,
    description: "Search flights, hotels, and cars via RouteStack MCP",
    defaults: { name: "RouteStack" },
    inputs: ["main"],
    outputs: ["main"],
    credentials: [{ name: "routeStackApi", required: true }],
  };

  async execute() {
    // TODO: Implement tool calls to RouteStack MCP
    return [[]];
  }
}
