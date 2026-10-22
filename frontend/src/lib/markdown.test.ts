import assert from "node:assert/strict";
import { test } from "node:test";
import { parseInline, parseMarkdown } from "./markdown.ts";

test("interpreta código, negrita y énfasis dentro de una línea", () => {
  assert.deepEqual(parseInline("Usa `print()` para **mostrar** _texto_."), [
    { kind: "text", text: "Usa " },
    { kind: "code", text: "print()" },
    { kind: "text", text: " para " },
    { kind: "strong", text: "mostrar" },
    { kind: "text", text: " " },
    { kind: "emphasis", text: "texto" },
    { kind: "text", text: "." },
  ]);
  assert.deepEqual(parseInline("mi_variable_larga y `a_b`"), [
    { kind: "text", text: "mi_variable_larga y " },
    { kind: "code", text: "a_b" },
  ]);
  assert.deepEqual(parseInline(""), []);
});

test("reconoce títulos, párrafos, listas y bloques de código", () => {
  const markdown = [
    "# Tu primer programa",
    "",
    "Python lee el código",
    "de arriba abajo.",
    "",
    "- Escribe",
    "* Ejecuta",
    "3. Revisa",
    "4. Corrige",
    "",
    "```python",
    "def saludar():",
    "    print(\"Hola\")",
    "",
    "```",
    "#### No es un título",
  ].join("\r\n");
  assert.deepEqual(parseMarkdown(markdown), [
    { kind: "heading", level: 2, content: [{ kind: "text", text: "Tu primer programa" }] },
    { kind: "paragraph", content: [{ kind: "text", text: "Python lee el código de arriba abajo." }] },
    {
      kind: "list",
      ordered: false,
      start: 1,
      items: [[{ kind: "text", text: "Escribe" }], [{ kind: "text", text: "Ejecuta" }]],
    },
    {
      kind: "list",
      ordered: true,
      start: 3,
      items: [[{ kind: "text", text: "Revisa" }], [{ kind: "text", text: "Corrige" }]],
    },
    { kind: "code", language: "python", text: 'def saludar():\n    print("Hola")\n' },
    { kind: "paragraph", content: [{ kind: "text", text: "#### No es un título" }] },
  ]);
});

test("conserva el código de un bloque sin cerrar y no interpreta marcas dentro", () => {
  assert.deepEqual(parseMarkdown("```\n# comentario\n- no es lista"), [
    { kind: "code", language: "", text: "# comentario\n- no es lista" },
  ]);
});

test("muestra el HTML y los enlaces como texto", () => {
  const html = '<img src=x onerror="alert(1)"> [enlace](javascript:alert(1))';
  assert.deepEqual(parseMarkdown(html), [{ kind: "paragraph", content: [{ kind: "text", text: html }] }]);
  assert.deepEqual(parseMarkdown("\r\n\r\n"), []);
});
