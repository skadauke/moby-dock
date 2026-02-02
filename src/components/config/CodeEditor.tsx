"use client";

import { useRef, useCallback } from "react";
import Editor, { OnMount, OnChange } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { getLanguage } from "@/lib/file-api";

interface CodeEditorProps {
  value: string;
  filename: string;
  onChange: (value: string) => void;
  onSave: () => void;
  readOnly?: boolean;
}

export function CodeEditor({ value, filename, onChange, onSave, readOnly }: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Add save command (Cmd/Ctrl+S)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave();
    });

    // Focus editor
    editor.focus();
  }, [onSave]);

  const handleChange: OnChange = useCallback((value) => {
    if (value !== undefined) {
      onChange(value);
    }
  }, [onChange]);

  const language = getLanguage(filename);

  return (
    <Editor
      height="100%"
      language={language}
      value={value}
      onChange={handleChange}
      onMount={handleEditorMount}
      theme="vs-dark"
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', Monaco, Consolas, monospace",
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        wordWrap: language === "markdown" ? "on" : "off",
        automaticLayout: true,
        tabSize: 2,
        padding: { top: 16 },
        renderWhitespace: "selection",
        smoothScrolling: true,
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
      }}
    />
  );
}
