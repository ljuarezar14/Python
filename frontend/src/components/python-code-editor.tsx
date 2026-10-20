"use client";

import { useEffect, useRef, useState } from "react";
import type { EditorView as CodeMirrorView } from "@codemirror/view";

type PythonCodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function PythonCodeEditor({ value, onChange }: PythonCodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<CodeMirrorView | null>(null);
  const currentValueRef = useRef(value);
  const changeHandlerRef = useRef(onChange);
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
    let disposed = false;
    async function loadEditor() {
      try {
        const [{ python }, { EditorState }, { EditorView }, { basicSetup }] = await Promise.all([
          import("@codemirror/lang-python"),
          import("@codemirror/state"),
          import("@codemirror/view"),
          import("codemirror"),
        ]);
        if (disposed || !hostRef.current) return;
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
            basicSetup,
            python(),
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
          spellCheck={false}
          value={value}
        />
      </div>
    );
  }
  return <div ref={hostRef} />;
}
