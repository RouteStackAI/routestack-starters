import { Plane, Hotel, Car } from "lucide-react";
import { ChatWindow } from "@/components/chat-window";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto mb-8 max-w-4xl">
        <h1 className="text-4xl font-semibold tracking-tight">
          RouteStack AI Travel Assistant
        </h1>

        <p className="mt-3 text-zinc-600">
          Search flights, hotels and cars using RouteStack MCP.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm">
            <Hotel className="h-4 w-4" />
            Hotels
          </div>

          <div className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm">
            <Plane className="h-4 w-4" />
            Flights
          </div>

          <div className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm">
            <Car className="h-4 w-4" />
            Cars
          </div>
        </div>
      </div>

      <ChatWindow />
    </main>
  );
}