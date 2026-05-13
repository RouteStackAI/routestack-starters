import type {
	ICredentialType,
	INodeProperties,
	ICredentialTestRequest,
} from 'n8n-workflow';

export class RouteStackApi implements ICredentialType {
	name = 'routeStackApi';

	displayName = 'RouteStack API';

	documentationUrl = 'https://routestack.ai';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			required: true,
			default: '',
		},
		{
			displayName: 'API Secret',
			name: 'apiSecret',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
		},
		{
			displayName: 'MCP URL',
			name: 'mcpUrl',
			type: 'string',
			default: 'https://mcp.routestack.ai/sse',
			required: true,
		},
	];

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.mcpUrl}}',
			url: '/',
			method: 'GET',
		},
	};
}