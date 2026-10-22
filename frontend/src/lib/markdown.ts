// Subconjunto de Markdown para lecciones y enunciados: títulos, párrafos, listas,
// bloques de código, `código`, **negrita** y _énfasis_. Devuelve datos, no HTML:
// el componente los convierte en elementos de React y cualquier otra marca
// (HTML, enlaces, imágenes) se muestra como texto.

export type InlineSegment = { kind: "text" | "code" | "strong" | "emphasis"; text: string };

export type MarkdownBlock =
  | { kind: "heading"; level: 2 | 3 | 4; content: InlineSegment[] }
  | { kind: "paragraph"; content: InlineSegment[] }
  | { kind: "list"; ordered: boolean; start: number; items: InlineSegment[][] }
  | { kind: "code"; language: string; text: string };

// El énfasis con _ exige que no haya letras alrededor, para no romper nombres
// como mi_variable escritos sin comillas invertidas.
const INLINE = /`([^`\n]+)`|\*\*([^*\n]+)\*\*|(?<![\p{L}\p{N}_])_([^_\n]+)_(?![\p{L}\p{N}_])/gu;
const FENCE_OPEN = /^```([\w+-]*)\s*$/;
const FENCE_CLOSE = /^```\s*$/;
const HEADING = /^(#{1,3})\s+(.+?)\s*#*\s*$/;
const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBERED = /^\s*(\d{1,9})[.)]\s+(.*)$/;

export function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) segments.push({ kind: "text", text: text.slice(last, match.index) });
    if (match[1] !== undefined) segments.push({ kind: "code", text: match[1] });
    else if (match[2] !== undefined) segments.push({ kind: "strong", text: match[2] });
    else segments.push({ kind: "emphasis", text: match[3] });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ kind: "text", text: text.slice(last) });
  return segments;
}

export function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];

  function closeParagraph() {
    if (paragraph.length > 0) blocks.push({ kind: "paragraph", content: parseInline(paragraph.join(" ")) });
    paragraph = [];
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fence = FENCE_OPEN.exec(line);
    if (fence) {
      closeParagraph();
      const code: string[] = [];
      // Un bloque sin cerrar llega hasta el final, como en Markdown habitual.
      while (index + 1 < lines.length && !FENCE_CLOSE.test(lines[index + 1])) {
        index += 1;
        code.push(lines[index]);
      }
      index += 1;
      blocks.push({ kind: "code", language: fence[1].toLowerCase(), text: code.join("\n") });
      continue;
    }
    if (line.trim() === "") {
      closeParagraph();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      closeParagraph();
      blocks.push({ kind: "heading", level: (heading[1].length + 1) as 2 | 3 | 4, content: parseInline(heading[2]) });
      continue;
    }
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    if (bullet || numbered) {
      closeParagraph();
      const ordered = numbered !== null;
      const text = bullet ? bullet[1] : numbered![2];
      const previous = blocks.at(-1);
      // Los elementos seguidos del mismo tipo forman una sola lista.
      if (previous?.kind === "list" && previous.ordered === ordered && lines[index - 1]?.trim() !== "") {
        previous.items.push(parseInline(text));
      } else {
        blocks.push({ kind: "list", ordered, start: numbered ? Number(numbered[1]) : 1, items: [parseInline(text)] });
      }
      continue;
    }
    paragraph.push(line.trim());
  }
  closeParagraph();
  return blocks;
}
