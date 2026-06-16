import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { ArrowUp, Loader2 } from "lucide-react";
import { getMessageText } from "@/lib/message-text";
import { ChatMessage } from "./chat-message";

const SCROLL_THRESHOLD_PX = 80;

const SUGGESTIONS = [
  "Find flights from SFO to London next Friday",
  "Search hotels in Paris for 2 nights",
  "Rent a car at Miami airport next week",
] as const;

export function ChatWindow() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  const { messages, input, handleInputChange, handleSubmit, isLoading, append } =
    useChat({
      api: "/api/chat",
    });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      setIsNearBottom(distanceFromBottom < SCROLL_THRESHOLD_PX);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isNearBottom) {
      scrollToBottom("smooth");
    }
  }, [messages, isLoading, isNearBottom, scrollToBottom]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    handleSubmit(e);
    requestAnimationFrame(() => scrollToBottom("smooth"));
  };

  const sendSuggestion = (text: string) => {
    void append({ role: "user", content: text });
  };

  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].id;
    }
    return null;
  }, [messages]);

  const assistantHasStartedStreaming = useMemo(() => {
    if (!lastAssistantId) return false;
    const message = messages.find((m) => m.id === lastAssistantId);
    return message ? getMessageText(message).trim().length > 0 : false;
  }, [messages, lastAssistantId]);

  const showLoadingPlaceholder =
    isLoading && !assistantHasStartedStreaming;

  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <div className="mx-auto flex h-screen w-full max-w-3xl flex-col">
      <header className="shrink-0 border-b border-border px-4 py-4">
        <h1 className="text-base font-semibold tracking-tight text-foreground">
          RouteStack MCP Playground
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Try this MCP server — search flights, hotels, and cars in chat.
        </p>
      </header>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-6"
      >
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-8 text-center">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                What would you like to do?
              </p>
              <p className="text-sm text-muted-foreground">
                Ask a travel question to run RouteStack tools.
              </p>
            </div>
            <div className="flex w-full max-w-lg flex-col gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => sendSuggestion(suggestion)}
                  className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-muted/60"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {messages.map((message) => {
              const text = getMessageText(message);

              if (message.role === "assistant" && !text.trim()) {
                return null;
              }

              const isStreaming =
                isLoading &&
                message.role === "assistant" &&
                message.id === lastAssistantId;

              return (
                <ChatMessage
                  key={message.id}
                  role={message.role as "user" | "assistant"}
                  content={text}
                  isStreaming={isStreaming}
                />
              );
            })}

            {showLoadingPlaceholder && (
              <ChatMessage role="assistant" isLoading />
            )}
          </div>
        )}
        <div ref={bottomRef} className="h-4" />
      </div>

      <div className="shrink-0 border-t border-border bg-background px-4 py-4">
        <form
          id="chat-composer"
          onSubmit={onSubmit}
          className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm"
        >
          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Send a message..."
            rows={1}
            className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />

          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            aria-label="Send message"
            className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
