import { memo } from "react";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";

const streamdownPlugins = { code };

type Props = {
  content: string;
  isStreaming: boolean;
};

function StreamdownContentInner({ content, isStreaming }: Props) {
  return (
    <Streamdown
      mode={isStreaming ? "streaming" : "static"}
      plugins={streamdownPlugins}
      shikiTheme={["github-light", "github-dark"]}
      isAnimating={isStreaming}
      caret={isStreaming ? "block" : undefined}
      parseIncompleteMarkdown
      controls={{ code: true, table: true, mermaid: false }}
      remend={{
        links: true,
        images: true,
        bold: true,
        italic: true,
        inlineCode: true,
        strikethrough: true,
      }}
      className="streamdown-chat text-card-foreground"
    >
      {content}
    </Streamdown>
  );
}

export const StreamdownContent = memo(StreamdownContentInner);
