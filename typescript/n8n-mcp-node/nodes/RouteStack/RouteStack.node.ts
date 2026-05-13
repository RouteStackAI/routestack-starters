import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ILoadOptionsFunctions,
	INodePropertyOptions,
} from 'n8n-workflow';

import { callTool, listTools } from './mcp-client.js';

export class RouteStack implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'RouteStack MCP',
		name: 'routeStack',
		icon: 'file:routestack.svg',
		group: ['transform'],
		version: 1,
		description: 'Execute RouteStack MCP tools',
		defaults: {
			name: 'RouteStack MCP',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'routeStackApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'callTool',
				options: [
					{
						name: 'Call Tool',
						value: 'callTool',
					},
					{
						name: 'Test Connection',
						value: 'testConnection',
					},
				],
			},
			{
				displayName: 'Tool',
				name: 'toolName',
				type: 'options',
				required: true,
				typeOptions: {
					loadOptionsMethod: 'getTools',
				},
				default: '',
				displayOptions: {
					show: {
						operation: ['callTool'],
					},
				},
			},
			{
				displayName: 'Arguments',
				name: 'toolArgs',
				type: 'json',
				default: '{}',
				displayOptions: {
					show: {
						operation: ['callTool'],
					},
				},
			},
		],
	};

	methods = {
		loadOptions: {
			async getTools(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				const credentials =
					await this.getCredentials('routeStackApi');

				const tools = await listTools({
					apiKey: credentials.apiKey as string,
					apiSecret: credentials.apiSecret as string,
					mcpUrl: credentials.mcpUrl as string,
				});

				return tools.map((tool) => ({
					name: tool.name,
					value: tool.name,
					description: tool.description,
				}));
			},
		},
	};

	async execute(
		this: IExecuteFunctions,
	): Promise<INodeExecutionData[][]> {
		const credentials = await this.getCredentials('routeStackApi');

		const items = this.getInputData();

		const results: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const operation = this.getNodeParameter(
				'operation',
				i,
			) as 'callTool' | 'testConnection';

			if (operation === 'testConnection') {
				try {
					const tools = await listTools({
						apiKey: credentials.apiKey as string,
						apiSecret: credentials.apiSecret as string,
						mcpUrl: credentials.mcpUrl as string,
					});

					results.push({
						json: {
							success: true,
							operation,
							message: 'Connection successful',
							toolCount: tools.length,
							toolsSample: tools.slice(0, 10).map((t) => t.name),
						},
					});
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);

					results.push({
						json: {
							success: false,
							operation,
							message: 'Connection failed',
							error: message,
						},
					});
				}

				continue;
			}

			const toolName = this.getNodeParameter(
				'toolName',
				i,
			) as string;

			const args = this.getNodeParameter(
				'toolArgs',
				i,
			) as string;

			const result = await callTool(
				{
					apiKey: credentials.apiKey as string,
					apiSecret: credentials.apiSecret as string,
					mcpUrl: credentials.mcpUrl as string,
				},
				toolName,
				JSON.parse(args),
			);

			results.push({
				json: {
					success: !result.isError,
					tool: toolName,
					args,
					response: result.content,
				},
			});
		}

		return [results];
	}
}
