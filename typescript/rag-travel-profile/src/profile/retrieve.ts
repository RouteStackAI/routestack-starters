import { searchProfiles } from "./store.js";

export async function retrieveRelevantProfile(query: string): Promise<string> {
  const profiles = await searchProfiles(query, 3);

  if (!profiles.length) return "";

  return profiles
    .map((p, i) => `${i + 1}. ${p.text}`)
    .join("\n");
}