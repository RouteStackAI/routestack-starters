"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Loader2, SendHorizonal } from "lucide-react";
import { ChatMessage } from "./chat-message";

export function ChatWindow() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [isNearBottom, setIsNearBottom] = useState(true);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({
      behavior,
      block: "end",
    });
  };

  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: "/api/chat",
    });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const threshold = 120;

      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;

      setIsNearBottom(distanceFromBottom < threshold);
    };

    el.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isNearBottom) {
      scrollToBottom("smooth");
    }
  }, [messages, isLoading, isNearBottom]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    handleSubmit(e);
    requestAnimationFrame(() => {
      scrollToBottom("smooth");
    });
  };

  const getMessageText = (m: any) => {
    if (m.role !== "assistant") {
      return m.content ?? "";
    }

    const partsText =
      m.parts
        ?.filter((part: any) => part.type === "text")
        .map((part: any) => part.text)
        .join("") ?? "";

    return partsText || m.content || "";
  };

  const lastAssistantMessage = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");

  const assistantHasStartedStreaming =
    !!lastAssistantMessage &&
    getMessageText(lastAssistantMessage).trim().length > 0;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div
        ref={scrollRef}
        className="relative h-[70vh] min-h-[500px] overflow-y-auto rounded-3xl border border-zinc-200 bg-zinc-50 py-5 pl-5 pr-2"
      >
        <div className="space-y-4">
          {messages.length === 0 && !isLoading ? (
            <div className="text-sm text-zinc-500">
              Ask something like:
              <div className="mt-2">“Find hotels in London next Friday”</div>
            </div>
          ) : (
            <>
              {messages.map((m) => {
                const text = getMessageText(m);

                if (m.role === "assistant" && !text.trim()) {
                  return null;
                }

                return (
                  <ChatMessage
                    key={m.id}
                    role={m.role as "user" | "assistant"}
                    content={text}
                    timestamp={m.createdAt}
                  />
                );
              })}

              {isLoading && !assistantHasStartedStreaming && (
                <ChatMessage role="assistant" isLoading />
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>
        {!isNearBottom && (
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="sticky bottom-4 left-1/2 ml-auto block rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 shadow-sm"
          >
            Scroll to bottom
          </button>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm"
      >
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask RouteStack..."
          className="flex-1 rounded-xl px-4 py-3 outline-none"
        />

        <button
          type="submit"
          disabled={isLoading}
          className="rounded-xl bg-black px-4 py-3 text-white"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizonal className="h-4 w-4" />
          )}
        </button>
      </form>
    </div>
  );
}
