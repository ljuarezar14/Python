import { Fragment } from "react";
import { parseMarkdown } from "@/lib/markdown";
import type { InlineSegment } from "@/lib/markdown";

function Inline({ segments }: { segments: InlineSegment[] }) {
  return segments.map((segment, index) => {
    if (segment.kind === "code") {
      return <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[0.9em]" key={index}>{segment.text}</code>;
    }
    if (segment.kind === "strong") return <strong key={index}>{segment.text}</strong>;
    if (segment.kind === "emphasis") return <em key={index}>{segment.text}</em>;
    return <Fragment key={index}>{segment.text}</Fragment>;
  });
}

const HEADING_STYLES = {
  2: "mt-8 text-2xl font-bold first:mt-0",
  3: "mt-6 text-xl font-bold first:mt-0",
  4: "mt-5 text-lg font-bold first:mt-0",
} as const;

// Solo crea elementos de React a partir de texto: nunca inserta HTML.
export function MarkdownContent({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-4 leading-relaxed">
      {parseMarkdown(markdown).map((block, index) => {
        switch (block.kind) {
          case "heading": {
            const Heading = `h${block.level}` as const;
            return <Heading className={HEADING_STYLES[block.level]} key={index}><Inline segments={block.content} /></Heading>;
          }
          case "list": {
            const items = block.items.map((item, part) => <li key={part}><Inline segments={item} /></li>);
            return block.ordered ? (
              <ol className="list-decimal space-y-1 pl-6" key={index} start={block.start}>{items}</ol>
            ) : (
              <ul className="list-disc space-y-1 pl-6" key={index}>{items}</ul>
            );
          }
          case "code":
            return (
              <pre
                aria-label={block.language === "python" ? "Ejemplo de código Python" : "Ejemplo de código"}
                className="overflow-x-auto rounded-xl bg-code p-4 font-mono text-sm leading-relaxed text-code-text"
                key={index}
                role="region"
                tabIndex={0}
              >
                <code>{block.text}</code>
              </pre>
            );
          default:
            return <p key={index}><Inline segments={block.content} /></p>;
        }
      })}
    </div>
  );
}
