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
| `OPENAI_API_KEY` | Yes | For embeddings and chat |
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
