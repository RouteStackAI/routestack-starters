"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  role: "user" | "assistant";
  content?: string;
  isLoading?: boolean;
  timestamp?: Date | string;
};

function formatTime(timestamp?: Date | string) {
  if (!timestamp) return "";

  const date =
    typeof timestamp === "string"
      ? new Date(timestamp)
      : timestamp;

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ChatMessage({
  role,
  content = "",
  isLoading = false,
  timestamp,
}: Props) {
  const isUser = role === "user";
  const time = formatTime(timestamp);

  if (isLoading) {
    return (
      <div className="max-w-full">
        <div className="inline-flex rounded-2xl bg-white px-4 py-3 text-zinc-900">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400 [animation-delay:150ms]" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400 [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div className={isUser ? "max-w-[80%]" : "w-full"}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? "inline-block w-fit bg-black text-white"
              : "w-full bg-white text-zinc-900"
          }`}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap break-words">{content}</div>
          ) : (
            <div className="overflow-x-auto">
              <div className="prose prose-sm max-w-none prose-zinc">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    table: ({ children }) => (
                      <table className="w-full min-w-[700px] border-collapse text-sm">
                        {children}
                      </table>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-zinc-100">{children}</thead>
                    ),
                    th: ({ children }) => (
                      <th className="border border-zinc-200 px-3 py-2 text-left font-medium">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="border border-zinc-200 px-3 py-2 align-top">
                        {children}
                      </td>
                    ),
                    code: ({ children }) => (
                      <code className="rounded bg-zinc-100 px-1 py-0.5">
                        {children}
                      </code>
                    ),
                    pre: ({ children }) => (
                      <pre className="overflow-x-auto rounded-xl bg-zinc-100 p-3">
                        {children}
                      </pre>
                    ),
                    img: ({ src, alt }) => (
                      <img
                        src={src || ""}
                        alt={alt || ""}
                        className="my-3 h-auto max-h-[320px] w-full max-w-[420px] rounded-xl object-cover"
                      />
                    ),
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        {time ? (
          <div
            className={`mt-1 px-1 text-xs text-zinc-400 ${
              isUser ? "text-right" : "text-left"
            }`}
          >
            {time}
          </div>
        ) : null}
      </div>
    </div>
  );
}
