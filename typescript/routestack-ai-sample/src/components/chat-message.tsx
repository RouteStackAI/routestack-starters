import { memo } from "react";
import { StreamdownContent } from "./streamdown-content";

type Props = {
  role: "user" | "assistant";
  content?: string;
  isLoading?: boolean;
  isStreaming?: boolean;
};

function ChatMessageInner({
  role,
  content = "",
  isLoading = false,
  isStreaming = false,
}: Props) {
  const isUser = role === "user";

  if (isLoading) {
    return (
      <div className="flex justify-start">
        <div className="flex items-center gap-1.5 py-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl bg-muted px-4 py-2.5 text-sm leading-relaxed text-foreground">
          <div className="whitespace-pre-wrap break-words">{content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 text-sm text-foreground">
      <StreamdownContent content={content} isStreaming={isStreaming} />
    </div>
  );
}

export const ChatMessage = memo(ChatMessageInner);
