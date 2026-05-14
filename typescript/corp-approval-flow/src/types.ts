import crypto from "node:crypto";

export type TravelType = "flight" | "hotel";

export interface EmployeeRequest {
  employeeName: string;
  employeeEmail: string;
  managerEmail: string;
  purpose: string;
  travelType: TravelType;
  origin?: string;
  destination: string;
  checkInDate?: string;
  checkOutDate?: string;
  departDate?: string;
  returnDate?: string;
  travelers: number;
  budget: number;
}

export interface TravelOption {
  title: string;
  totalPrice?: number;
  currency?: string;
  description: string;
  paymentUrl?: string;
  raw: Record<string, unknown>;
}

export interface ApprovalRecord {
  id: string;
  createdAt: string;
  status: "pending" | "approved";
  request: EmployeeRequest;
  selectedOption: TravelOption;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolResult {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  isError?: boolean;
}

export interface SearchResult {
  summary: string;
  options: TravelOption[];
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
