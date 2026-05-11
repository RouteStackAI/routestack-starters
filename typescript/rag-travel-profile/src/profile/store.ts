import { ChromaClient } from "chromadb";
import { Mistral } from "@mistralai/mistralai";
import OpenAI from "openai";

import { config } from "../config.js";
import type { RetrievedProfile, UserProfile } from "./types.js";

type ChromaMetadataValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | boolean[]
  | null;

type ChromaMetadata = Record<string, ChromaMetadataValue>;

const COLLECTION_NAME = "travel-user-profiles";

let chromaClient: ChromaClient | null = null;

const mistralClient = config.embeddings.mistral.apiKey
  ? new Mistral({
      apiKey: config.embeddings.mistral.apiKey,
    })
  : null;

const openaiClient = config.embeddings.openai.apiKey
  ? new OpenAI({
      apiKey: config.embeddings.openai.apiKey,
    })
  : null;

function toChromaMetadata(metadata?: Record<string, unknown>): ChromaMetadata {
  if (!metadata) return {};

  const result: ChromaMetadata = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      result[key] = value;
      continue;
    }

    if (
      Array.isArray(value) &&
      value.every(
        (v) =>
          typeof v === "string" ||
          typeof v === "number" ||
          typeof v === "boolean",
      )
    ) {
      result[key] = value as ChromaMetadataValue;
    }
  }

  return result;
}

async function getChromaCollection() {
  if (!config.vector.chromaUrl) {
    throw new Error("CHROMA_URL is missing");
  }

  if (!chromaClient) {
    const url = new URL(config.vector.chromaUrl);

    chromaClient = new ChromaClient({
      host: url.hostname,
      port: Number(url.port || 8000),
      ssl: url.protocol === "https:",
    });
  }

  return chromaClient.getOrCreateCollection({
    name: COLLECTION_NAME,
    embeddingFunction: undefined,
  });
}

async function embed(text: string): Promise<number[]> {
  if (config.embeddings.provider === "mistral") {
    if (!mistralClient) {
      throw new Error("Missing Mistral API key");
    }

    const result = await mistralClient.embeddings.create({
      model: config.embeddings.mistral.model,
      inputs: [text],
    });

    const embedding = result.data?.[0]?.embedding;

    if (!embedding) {
      throw new Error("Mistral embeddings API returned no embedding");
    }

    return embedding;
  }

  if (!openaiClient) {
    throw new Error("Missing OpenAI API key");
  }

  const result = await openaiClient.embeddings.create({
    model: config.embeddings.openai.model,
    input: text,
  });

  return result.data[0].embedding;
}

export async function upsertProfile(profile: UserProfile) {
  const collection = await getChromaCollection();
  const vector = await embed(profile.text);

  const metadata = toChromaMetadata(profile.metadata);

  const payload: {
    ids: string[];
    embeddings: number[][];
    documents: string[];
    metadatas?: Record<string, any>[];
  } = {
    ids: [profile.id],
    embeddings: [vector],
    documents: [profile.text],
  };

  if (Object.keys(metadata).length > 0) {
    payload.metadatas = [metadata];
  }

  await collection.upsert(payload);
}

export async function searchProfiles(
  query: string,
  topK = 3,
): Promise<RetrievedProfile[]> {
  const collection = await getChromaCollection();
  const vector = await embed(query);

  const result = await collection.query({
    queryEmbeddings: [vector],
    nResults: topK,
  });

  const ids = result.ids[0] ?? [];
  const docs = result.documents?.[0] ?? [];
  const metas = result.metadatas?.[0] ?? [];
  const distances = result.distances?.[0] ?? [];

  return ids.map((id, i) => ({
    id,
    text: docs[i] ?? "",
    metadata: (metas[i] ?? {}) as Record<string, unknown>,
    score: typeof distances[i] === "number" ? 1 - distances[i] : 0,
  }));
}
