import React from "react";
import ReactDOM from "react-dom/client";
import { TravelSearch } from "./TravelSearch.js";
import "./styles.css";

function DemoApp() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[1440px] flex-col px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-7">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#F5C542]">
            RouteStack Sample
          </p>
          <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-3xl">
            Travel booking widget
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
            Search destinations, compare live hotel inventory, and continue
            structured flight and car flows through RouteStack MCP.
          </p>
        </div>
      </section>

      <TravelSearch apiBaseUrl="http://127.0.0.1:3000" />
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DemoApp />
  </React.StrictMode>,
);
