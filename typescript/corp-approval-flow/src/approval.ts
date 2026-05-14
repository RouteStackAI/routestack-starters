import { config } from "./config.js";
import { signJwt } from "./deep-link.js";
import type { ApprovalRecord } from "./types.js";

const TTL_SECONDS = 60 * 60 * 24;

export function createApprovalLink(approvalId: string): string {
  const token = signJwt({ approvalId }, config.jwtSecret, TTL_SECONDS);
  return `${config.app.baseUrl}/approve?token=${encodeURIComponent(token)}`;
}

export async function sendApprovalEmail(record: ApprovalRecord, approvalLink: string): Promise<void> {
  const subject = `Travel approval needed for ${record.request.employeeName}`;
  const option = record.selectedOption;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto;">
      <h2>Corporate Travel Approval Request</h2>
      <p><strong>Employee:</strong> ${record.request.employeeName} (${record.request.employeeEmail})</p>
      <p><strong>Purpose:</strong> ${record.request.purpose}</p>
      <p><strong>Type:</strong> ${record.request.travelType}</p>
      <p><strong>Proposed Option:</strong> ${option.title}</p>
      <p><strong>Price:</strong> ${option.totalPrice ?? "N/A"} ${option.currency ?? ""}</p>
      <p>${option.description}</p>
      <p>
        <a href="${approvalLink}" style="background:#1d4ed8;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Approve & Continue</a>
      </p>
      <p>This link expires in 24 hours.</p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resend.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.resend.from,
      to: [record.request.managerEmail],
      subject,
      html,
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Resend error (${response.status}): ${body}`);
  }
}
