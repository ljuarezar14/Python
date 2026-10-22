"use client";

import { useEffect, useRef, useState } from "react";
import type { EditorView as CodeMirrorView } from "@codemirror/view";

type PythonCodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onRun?: () => void;
};

export default function PythonCodeEditor({ value, onChange, onRun }: PythonCodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<CodeMirrorView | null>(null);
  const currentValueRef = useRef(value);
  const changeHandlerRef = useRef(onChange);
  const runHandlerRef = useRef(onRun);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    currentValueRef.current = value;
    const view = viewRef.current;
    if (view && view.state.doc.toString() !== value) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
    }
  }, [value]);

  useEffect(() => {
    changeHandlerRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    runHandlerRef.current = onRun;
  }, [onRun]);

  useEffect(() => {
    let disposed = false;
    async function loadEditor() {
      try {
        const [
          { python },
          { HighlightStyle, syntaxHighlighting },
          { tags },
          { EditorState, Prec },
          { EditorView, keymap },
          { basicSetup },
        ] = await Promise.all([
          import("@codemirror/lang-python"),
          import("@codemirror/language"),
          import("@lezer/highlight"),
          import("@codemirror/state"),
          import("@codemirror/view"),
          import("codemirror"),
        ]);
        if (disposed || !hostRef.current) return;
        // Colores del resaltado por defecto de CodeMirror, salvo tres que no llegaban a 4,5:1
        // sobre el fondo del editor y la línea activa (WCAG AA). Sustituye al de basicSetup.
        const highlightStyle = HighlightStyle.define([
          { tag: tags.keyword, color: "#708" },
          { tag: [tags.atom, tags.bool, tags.url, tags.contentSeparator, tags.labelName], color: "#219" },
          { tag: [tags.literal, tags.inserted], color: "#164" },
          { tag: [tags.string, tags.deleted], color: "#a11" },
          { tag: [tags.regexp, tags.escape, tags.special(tags.string)], color: "#a33500" },
          { tag: tags.definition(tags.variableName), color: "#00f" },
          { tag: tags.local(tags.variableName), color: "#30a" },
          { tag: [tags.typeName, tags.namespace], color: "#06603e" },
          { tag: tags.className, color: "#167" },
          { tag: [tags.special(tags.variableName), tags.macroName], color: "#256" },
          { tag: tags.definition(tags.propertyName), color: "#00c" },
          { tag: tags.comment, color: "#940" },
          { tag: tags.invalid, color: "#b00" },
        ]);
        const editorTheme = EditorView.theme({
          "&": {
            minHeight: "20rem",
            maxHeight: "34rem",
            backgroundColor: "#f7faf7",
            color: "#14271e",
            fontSize: "14px",
          },
          "&.cm-focused": { outline: "3px solid #b7562b", outlineOffset: "-3px" },
          ".cm-scroller": {
            minHeight: "20rem",
            maxHeight: "34rem",
            overflow: "auto",
            fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
          },
          ".cm-content": { padding: "1rem 0" },
          ".cm-gutters": {
            backgroundColor: "#edf3ed",
            color: "#43584c",
            borderRight: "1px solid #cbd8cb",
          },
          ".cm-activeLine": { backgroundColor: "#e6f0e8" },
          ".cm-cursor": { borderLeftColor: "#14271e" },
        });
        viewRef.current = new EditorView({
          doc: currentValueRef.current,
          extensions: [
            Prec.highest(
              keymap.of([
                {
                  key: "Mod-Enter",
                  run: () => {
                    if (!runHandlerRef.current) return false;
                    runHandlerRef.current();
                    return true;
                  },
                },
              ]),
            ),
            basicSetup,
            python(),
            syntaxHighlighting(highlightStyle),
            EditorState.tabSize.of(4),
            EditorView.lineWrapping,
            EditorView.contentAttributes.of({ "aria-label": "Editor de código Python" }),
            editorTheme,
            EditorView.updateListener.of((update) => {
              if (update.docChanged) changeHandlerRef.current(update.state.doc.toString());
            }),
          ],
          parent: hostRef.current,
        });
      } catch {
        if (!disposed) setFailed(true);
      }
    }
    void loadEditor();
    return () => {
      disposed = true;
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, []);

  if (failed) {
    return (
      <div>
        <p className="p-3 text-sm" role="alert">El editor avanzado no pudo cargarse. Puedes seguir escribiendo en este campo.</p>
        <textarea
          aria-label="Código Python"
          className="min-h-80 w-full resize-y border-0 bg-[#f7faf7] p-4 font-mono text-sm text-[#14271e] focus:outline-3 focus:outline-[#b7562b]"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (onRun && event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              onRun();
            }
          }}
          spellCheck={false}
          value={value}
        />
      </div>
    );
  }
  return <div ref={hostRef} />;
}
