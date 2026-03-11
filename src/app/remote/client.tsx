"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Monitor,
  MonitorOff,
  Maximize,
  Minimize,
  RefreshCw,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Dynamic import to avoid SSR issues — react-vnc uses Canvas and WebSocket
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const VncScreen = dynamic(
  () => import("react-vnc").then((m) => m.VncScreen),
  { ssr: false }
) as any; // ref forwarding types lost through dynamic()

export function RemoteClient() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [needsCredentials, setNeedsCredentials] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vncRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    setNeedsCredentials(false);
    try {
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
    setNeedsCredentials(false);
    setPassword("");
    setUsername("");
  }, []);

  const handleCredentialsSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (vncRef.current && password) {
      // macOS uses ARD auth which needs username + password
      vncRef.current.sendCredentials({ username, password });
      setNeedsCredentials(false);
      setPassword("");
      setUsername("");
    }
  }, [username, password]);

  // Patch noVNC dot cursor to be larger (default is 3x3, invisible on Retina)
  useEffect(() => {
    if (!connected) return;
    try {
      const rfb = vncRef.current?.rfb;
      if (!rfb) return;
      const RFB = rfb.constructor;
      if (RFB?.cursors?.dot) {
        // 9x9 circle cursor: white outline, black fill
        const size = 9;
        const pixels = new Uint8Array(size * size * 4);
        const cx = 4, cy = 4, r = 4;
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const dx = x - cx, dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const i = (y * size + x) * 4;
            if (dist <= r - 1) {
              // Black fill
              pixels[i] = 0; pixels[i+1] = 0; pixels[i+2] = 0; pixels[i+3] = 200;
            } else if (dist <= r) {
              // White border
              pixels[i] = 255; pixels[i+1] = 255; pixels[i+2] = 255; pixels[i+3] = 255;
            }
          }
        }
        RFB.cursors.dot = { rgbaPixels: pixels, w: size, h: size, hotx: cx, hoty: cy };
      }
    } catch {
      // Non-critical — fall back to default cursor
    }
  }, [connected]);

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
          {connecting && !connected && !needsCredentials && (
            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
              Connecting...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(connected || connecting) && (
            <>
              {connected && (
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
              )}
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
      <div className="flex-1 flex items-center justify-center overflow-hidden bg-black relative">
        {wsUrl && (connecting || connected) && (
          <VncScreen
            ref={vncRef}
            url={wsUrl}
            scaleViewport
            showDotCursor
            background="black"
            style={{ width: "100%", height: "100%" }}
            onConnect={() => {
              setConnected(true);
              setConnecting(false);
              setNeedsCredentials(false);
            }}
            onDisconnect={() => {
              setConnected(false);
              setConnecting(false);
              setWsUrl(null);
            }}
            onCredentialsRequired={() => {
              setNeedsCredentials(true);
            }}
            onSecurityFailure={(e: CustomEvent) => {
              setError(
                `Security failure: ${(e?.detail as Record<string, string>)?.reason || "Authentication or authorization failure"}`
              );
              setConnecting(false);
              setWsUrl(null);
            }}
          />
        )}

        {/* Credentials prompt overlay */}
        {needsCredentials && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
            <form onSubmit={handleCredentialsSubmit} className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-80 space-y-4">
              <div className="flex items-center gap-2 text-zinc-100">
                <Lock className="h-5 w-5" />
                <h2 className="font-semibold">Screen Sharing Login</h2>
              </div>
              <p className="text-zinc-400 text-sm">
                Enter your macOS username and password.
              </p>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                autoFocus
                autoComplete="username"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-md text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-md text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button
                type="submit"
                disabled={!username || !password}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Connect
              </Button>
            </form>
          </div>
        )}

        {/* Disconnected state */}
        {!wsUrl && !connecting && (
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
