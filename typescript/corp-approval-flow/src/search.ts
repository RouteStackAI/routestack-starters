import { deterministicSearch } from "./booking-flow.js";
import type { EmployeeRequest, McpTool, SearchResult } from "./types.js";

export async function searchTravelOptions(request: EmployeeRequest, _tools: McpTool[]): Promise<SearchResult> {
  return deterministicSearch(request);
}
