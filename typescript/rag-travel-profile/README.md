# RouteStack.ai — RAG Travel Profile

An AI travel agent that remembers user preferences using a vector database and automatically filters RouteStack results based on stored profiles.

## Prerequisites

- Node.js >= 20
- A RouteStack API key ([get one at routestack.ai](https://routestack.ai))
- An OpenAI API key (for embeddings + chat)
- A Pinecone API key (or run Chroma locally)

## Quick Start

```bash
cp .env.example .env
# Add your API keys to .env
pnpm install
pnpm run seed     # Load sample preference data
pnpm start
```

## Configuration

| Variable | Required | Description |
|:---------|:---------|:------------|
| `ROUTESTACK_API_KEY` | Yes | Your RouteStack API key |
| `ROUTESTACK_MCP_URL` | Yes | MCP server endpoint |
| `LLM_PROVIDER` | Yes | `openai` or `anthropic`, or `mistral` |
| `OPENAI_API_KEY` | If using OpneAI | OpneAI API key |
| `OPENAI_MODEL` | No | OpenAI model (default: `gpt-4.1-mini`) |
| `ANTHROPIC_API_KEY` | If using Anthropic | Anthropic API key |
| `ANTHROPIC_MODEL` | No | Anthropic model (default: `claude-sonnet-4-5-latest`) |
| `MISTRAL_API_KEY` | If using Mistral | Mistral API key |
| `MISTRAL_MODEL` | No | Mistral model (default: `mistral-large-latest`) |
| `MISTRAL_BASE_URL` | No | Mistral API base URL (default: `https://api.mistral.ai/v1`) |
| `PINECONE_API_KEY` | Yes* | Pinecone key (*or use Chroma) |
| `PINECONE_INDEX` | Yes* | Pinecone index name |
| `CHROMA_URL` | No | Chroma URL for local alternative |

## How It Works

```
Stored preference: "Prefers Delta, aisle seat, Marriott hotels"

You: "Find me a flight to Chicago next week"
    ↓
Vector DB retrieves relevant preferences
    ↓
LLM context: "User prefers Delta and aisle seats"
    ↓
RouteStack MCP search → filtered results
    ↓
Agent: "Here are Delta flights with aisle seats available..."
```

1. User preferences are stored as embeddings in a vector database
2. When searching, relevant preferences are retrieved via similarity search
3. Preferences are injected into the LLM context
4. The agent filters and ranks RouteStack results accordingly

## Customization

- Add preferences in `src/seed/sample-profiles.ts`
- Store company travel policies as embeddings for compliance
- Switch between Pinecone and Chroma in `src/profile/store.ts`
