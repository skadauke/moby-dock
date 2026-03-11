"use client";

import { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Monitor,
  MonitorOff,
  Maximize,
  Minimize,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Dynamic import to avoid SSR issues — react-vnc uses Canvas and WebSocket
const VncScreen = dynamic(
  () => import("react-vnc").then((m) => m.VncScreen),
  { ssr: false }
);

export function RemoteClient() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      // Fetch the file server token from our API
      const res = await fetch("/api/remote/token");
      if (!res.ok) throw new Error("Failed to get connection token");
      const { token } = await res.json();
      setWsUrl(`wss://files.skadauke.dev/vnc?token=${token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setConnecting(false);
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    setConnected(false);
    setConnecting(false);
    setWsUrl(null);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    } else {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    }
  }, []);

  return (
    <div ref={containerRef} className="h-full flex flex-col bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-950 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor className="h-5 w-5 text-zinc-400" />
          <h1 className="text-lg font-semibold text-zinc-100">
            Remote Control
          </h1>
          {connected && (
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
              Connected
            </span>
          )}
          {connecting && !connected && (
            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
              Connecting...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {connected && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullscreen}
                className="text-zinc-400"
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize className="h-4 w-4" />
                ) : (
                  <Maximize className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                className="text-zinc-400 hover:text-red-400"
              >
                <MonitorOff className="h-4 w-4 mr-1" />
                Disconnect
              </Button>
            </>
          )}
          {!connected && !connecting && (
            <Button
              onClick={handleConnect}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Monitor className="h-4 w-4 mr-1" />
              Connect
            </Button>
          )}
        </div>
      </header>

      {/* VNC Display */}
      <div className="flex-1 flex items-center justify-center overflow-hidden bg-black">
        {wsUrl && (connecting || connected) ? (
          <VncScreen
            url={wsUrl}
            scaleViewport
            background="black"
            style={{ width: "100%", height: "100%" }}
            onConnect={() => {
              setConnected(true);
              setConnecting(false);
            }}
            onDisconnect={() => {
              setConnected(false);
              setConnecting(false);
            }}
            onSecurityFailure={(e: CustomEvent) => {
              setError(
                `Security failure: ${(e?.detail as Record<string, string>)?.reason || "Unknown"}`
              );
              setConnecting(false);
            }}
          />
        ) : (
          <div className="text-center">
            {error ? (
              <div className="space-y-4">
                <MonitorOff className="h-12 w-12 text-red-400 mx-auto" />
                <p className="text-red-400">{error}</p>
                <Button
                  onClick={handleConnect}
                  variant="outline"
                  className="border-zinc-700"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Monitor className="h-12 w-12 text-zinc-600 mx-auto" />
                <p className="text-zinc-400">
                  Click Connect to view the Mac mini desktop
                </p>
                <p className="text-zinc-600 text-sm">
                  Requires Screen Sharing to be enabled on the host
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
