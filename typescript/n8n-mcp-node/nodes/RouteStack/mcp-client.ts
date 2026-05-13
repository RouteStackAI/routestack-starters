import crypto from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

export interface RouteStackConfig {
	apiKey: string;
	apiSecret?: string;
	mcpUrl: string;
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

let client: Client | null = null;
let cachedPartnerToken: string | null = null;
let currentConfigHash: string | null = null;

function hashConfig(config: RouteStackConfig): string {
	return `${config.apiKey}:${config.apiSecret ?? ''}:${config.mcpUrl}`;
}

async function getPartnerToken(config: RouteStackConfig): Promise<string> {
	if (cachedPartnerToken) return cachedPartnerToken;

	const { apiKey, apiSecret, mcpUrl } = config;

	if (!apiSecret) {
		return apiKey;
	}

	const timestamp = Math.floor(Date.now() / 1000);
	const nonce = crypto.randomUUID();

	const hmac = crypto
		.createHmac('sha256', apiSecret)
		.update(`${apiKey}:${timestamp}:${nonce}`)
		.digest('base64url');

	const base = new URL(mcpUrl);
	const tokenUrl = new URL('/mcp/auth/partner-token', base.origin);

	const res = await fetch(tokenUrl, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
		},
		body: JSON.stringify({
			apiKey,
			hmac,
			timestamp,
			nonce,
		}),
	});

	const text = await res.text();

	if (!res.ok) {
		throw new Error(`RouteStack auth failed (${res.status}): ${text}`);
	}

	let parsed: any;

	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error(`Invalid auth response: ${text}`);
	}

	const token =
		parsed.token ??
		parsed.accessToken ??
		parsed.partnerToken ??
		parsed.jwt;

	if (!token || typeof token !== 'string') {
		throw new Error('Partner token missing in auth response');
	}

	cachedPartnerToken = token;
	return token;
}

export async function connectMcp(config: RouteStackConfig): Promise<Client> {
	const nextHash = hashConfig(config);

	if (client && currentConfigHash === nextHash) {
		return client;
	}

	if (client) {
		try {
			await client.close();
		} catch {}
		client = null;
	}

	cachedPartnerToken = null;

	const token = await getPartnerToken(config);

	const headers = {
		Authorization: `Bearer ${token}`,
	};

	const url = new URL(config.mcpUrl);

	client = new Client({
		name: 'n8n-routestack-node',
		version: '0.2.0',
	});

	try {
		const transport = new StreamableHTTPClientTransport(url, {
			requestInit: { headers },
		});

		await client.connect(transport);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);

		const fallback =
			message.includes('404') ||
			message.includes('405') ||
			message.includes('Not Found') ||
			message.includes('Method Not Allowed');

		if (!fallback) {
			throw error;
		}

		await client.close().catch(() => {});

		client = new Client({
			name: 'n8n-routestack-node',
			version: '0.2.0',
		});

		const transport = new SSEClientTransport(url, {
			requestInit: { headers },
		});

		await client.connect(transport);
	}

	currentConfigHash = nextHash;

	return client;
}

export async function listTools(config: RouteStackConfig): Promise<McpTool[]> {
	const activeClient = await connectMcp(config);

	const allTools: McpTool[] = [];
	let cursor: string | undefined;

	do {
		const result = await activeClient.listTools({ cursor });

		allTools.push(
			...result.tools.map((tool) => ({
				name: tool.name,
				description: tool.description ?? '',
				inputSchema: (tool.inputSchema ?? {}) as Record<string, unknown>,
			})),
		);

		cursor = result.nextCursor;
	} while (cursor);

	return allTools;
}

export async function callTool(
	config: RouteStackConfig,
	name: string,
	args: Record<string, unknown>,
): Promise<McpToolResult> {
	try {
		const activeClient = await connectMcp(config);

		const result = await activeClient.callTool({
			name,
			arguments: args,
		});

		return {
			content: (result.content ?? []) as McpToolResult['content'],
			isError: result.isError as boolean | undefined,
		};
	} catch (error) {
		return {
			isError: true,
			content: [
				{
					type: 'text',
					text:
						error instanceof Error
							? error.message
							: String(error),
				},
			],
		};
	}
}