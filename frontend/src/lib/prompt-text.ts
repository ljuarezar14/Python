// Subconjunto mínimo de Markdown para enunciados: párrafos, `código` y _énfasis_.
// Devuelve datos, no HTML: el componente los convierte en elementos de React y
// cualquier otra marca se muestra como texto. El renderizador completo llegará
// con la pantalla de lección.

export type PromptSegment = { kind: "text" | "code" | "emphasis"; text: string };

const INLINE = /`([^`\n]+)`|_([^_\n]+)_/g;

export function parsePrompt(markdown: string): PromptSegment[][] {
  return markdown
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => {
      const segments: PromptSegment[] = [];
      let last = 0;
      for (const match of paragraph.matchAll(INLINE)) {
        if (match.index > last) segments.push({ kind: "text", text: paragraph.slice(last, match.index) });
        segments.push(match[1] !== undefined ? { kind: "code", text: match[1] } : { kind: "emphasis", text: match[2] });
        last = match.index + match[0].length;
      }
      if (last < paragraph.length) segments.push({ kind: "text", text: paragraph.slice(last) });
      return segments;
    });
}
