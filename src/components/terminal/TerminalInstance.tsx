"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { useTerminalStore } from "@/stores/terminal-store";

interface TerminalInstanceProps {
  sessionId: string;
  isVisible: boolean;
}

export function TerminalInstance({ sessionId, isVisible }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [disconnected, setDisconnected] = useState(false);
  const setConnected = useTerminalStore((s) => s.setConnected);

  const connect = useCallback(async () => {
    setDisconnected(false);

    // Fetch token from our API
    let token: string;
    let url: string;
    try {
      const res = await fetch("/api/terminal/token");
      if (!res.ok) throw new Error("Failed to get token");
      const data = await res.json();
      token = data.token;
      url = data.url;
    } catch {
      setDisconnected(true);
      return;
    }

    const term = terminalRef.current;
    if (!term) return;

    const cols = term.cols;
    const rows = term.rows;

    const ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}&cols=${cols}&rows=${rows}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(sessionId, true);
      setDisconnected(false);
      // Client-side keepalive: send empty data every 30s to prevent idle timeout
      const keepalive = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        } else {
          clearInterval(keepalive);
        }
      }, 30000);
      (ws as unknown as Record<string, unknown>)._keepalive = keepalive;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "data") {
          term.write(msg.data);
        } else if (msg.type === "exit") {
          term.writeln(`\r\n\x1b[90m[Process exited with code ${msg.code}]\x1b[0m`);
          setConnected(sessionId, false);
          setDisconnected(true);
        } else if (msg.type === "error") {
          term.writeln(`\r\n\x1b[31m[Error: ${msg.error}]\x1b[0m`);
          setDisconnected(true);
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      clearInterval((ws as unknown as Record<string, unknown>)._keepalive as number);
      setConnected(sessionId, false);
      setDisconnected(true);
    };

    ws.onerror = () => {
      setConnected(sessionId, false);
      setDisconnected(true);
    };

    // Send input to server
    term.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "data", data }));
      }
    });
  }, [sessionId, setConnected]);

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      theme: {
        background: "#09090b",
        foreground: "#e4e4e7",
        cursor: "#a1a1aa",
        selectionBackground: "#3f3f46",
        black: "#18181b",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#eab308",
        blue: "#3b82f6",
        magenta: "#a855f7",
        cyan: "#06b6d4",
        white: "#e4e4e7",
        brightBlack: "#71717a",
        brightRed: "#f87171",
        brightGreen: "#4ade80",
        brightYellow: "#facc15",
        brightBlue: "#60a5fa",
        brightMagenta: "#c084fc",
        brightCyan: "#22d3ee",
        brightWhite: "#fafafa",
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    term.open(containerRef.current);

    // Small delay to let the container size settle before fitting
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch {
        // container may not be visible yet
      }
      connect();
    });

    return () => {
      wsRef.current?.close();
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle resize
  useEffect(() => {
    if (!isVisible) return;

    const handleResize = () => {
      try {
        fitAddonRef.current?.fit();
        const term = terminalRef.current;
        const ws = wsRef.current;
        if (term && ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        }
      } catch {
        // ignore
      }
    };

    // Fit when becoming visible
    requestAnimationFrame(handleResize);

    window.addEventListener("resize", handleResize);
    // Also listen for panel resize via a ResizeObserver on the container
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
    };
  }, [isVisible]);

  const handleReconnect = () => {
    wsRef.current?.close();
    terminalRef.current?.clear();
    connect();
  };

  return (
    <div
      className="relative h-full w-full"
      style={{ display: isVisible ? "block" : "none" }}
    >
      <div ref={containerRef} className="h-full w-full" />
      {disconnected && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80">
          <button
            onClick={handleReconnect}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            Reconnect
          </button>
        </div>
      )}
    </div>
  );
}
