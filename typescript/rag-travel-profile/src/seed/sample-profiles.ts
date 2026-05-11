import { upsertProfile } from "../profile/store.js";

export async function seedProfiles() {
  const profiles = [
    {
      id: "user-pref-1",
      text: "Prefers Delta Airlines for flights",
    },
    {
      id: "user-pref-2",
      text: "Always prefers aisle seat",
    },
    {
      id: "user-pref-3",
      text: "Usually books Marriott hotels",
    },
    {
      id: "user-pref-4",
      text: "Prefers refundable fares when available",
    },
  ];

  for (const profile of profiles) {
    await upsertProfile(profile);
  }

  console.log("Seed completed");
}