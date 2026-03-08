"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  Plus,
  Key,
  ShieldCheck,
  Lock,
  LogIn,
  User,
  CreditCard,
  Landmark,
  FileText,
  BookOpen,
  Car,
  Hash,
  Play,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CREDENTIAL_TYPES, SIDEBAR_GROUPS } from "@/lib/vault/schemas";
import type { MaskedVaultItem, VaultItemType } from "@/lib/vault/types";
import {
  ExpiryBadge,
  TestBadge,
  getExpiryStatus,
  getTestStatus,
} from "./VaultStatusBadge";

// ── Icon map ───────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Key,
  ShieldCheck,
  Lock,
  LogIn,
  User,
  CreditCard,
  Landmark,
  FileText,
  BookOpen,
  Car,
  Hash,
};

export function getTypeIcon(type: VaultItemType) {
  const schema = CREDENTIAL_TYPES[type];
  return ICON_MAP[schema?.icon ?? "Key"] ?? Key;
}

type SortKey = "name" | "type" | "created" | "expiry";

interface Props {
  items: MaskedVaultItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (type: VaultItemType) => void;
  onRefresh?: () => void;
}

export function VaultList({ items, selectedId, onSelect, onAdd, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  // Track inline test results per item
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, "pass" | "fail">>({});

  const filtered = useMemo(() => {
    let list = items;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.service && i.service.toLowerCase().includes(q)) ||
          (i.notes && i.notes.toLowerCase().includes(q)),
      );
    }

    list = [...list].sort((a, b) => {
      switch (sort) {
        case "name":
          return a.name.localeCompare(b.name);
        case "type":
          return a.type.localeCompare(b.type);
        case "created":
          return (b.created ?? "").localeCompare(a.created ?? "");
        case "expiry":
          return (a.expires ?? "9999").localeCompare(b.expires ?? "9999");
        default:
          return 0;
      }
    });

    return list;
  }, [items, search, sort]);

  // #3: Test from list view
  const handleListTest = async (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation(); // Don't open detail panel
    setTestingId(itemId);
    try {
      const res = await fetch(`/api/vault/items/${itemId}/test`, { method: "POST" });
      const data = await res.json();
      const success = res.ok && data.result?.success;
      setTestResults((prev) => ({ ...prev, [itemId]: success ? "pass" : "fail" }));
      // Clear result after 3s
      setTimeout(() => {
        setTestResults((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
      }, 3000);
      onRefresh?.();
    } catch {
      setTestResults((prev) => ({ ...prev, [itemId]: "fail" }));
      setTimeout(() => {
        setTestResults((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
      }, 3000);
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b border-zinc-800">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Search vault…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 bg-zinc-900 border-zinc-700 h-8 text-sm"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-28 bg-zinc-900 border-zinc-700 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700">
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="type">Type</SelectItem>
            <SelectItem value="created">Created</SelectItem>
            <SelectItem value="expiry">Expiry</SelectItem>
          </SelectContent>
        </Select>

        {/* Add dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700 gap-1">
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-zinc-800 border-zinc-700 w-48"
          >
            <DropdownMenuLabel className="text-zinc-500 text-[10px]">
              Secrets
            </DropdownMenuLabel>
            {SIDEBAR_GROUPS.secrets.map((g) => {
              const Icon = getTypeIcon(g.type);
              return (
                <DropdownMenuItem
                  key={g.type}
                  onClick={() => onAdd(g.type)}
                  className="gap-2 text-sm"
                >
                  <Icon className="h-3.5 w-3.5 text-zinc-400" />
                  {g.label}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator className="bg-zinc-700" />
            <DropdownMenuLabel className="text-zinc-500 text-[10px]">
              Personal
            </DropdownMenuLabel>
            {SIDEBAR_GROUPS.personal.map((g) => {
              const Icon = getTypeIcon(g.type);
              return (
                <DropdownMenuItem
                  key={g.type}
                  onClick={() => onAdd(g.type)}
                  className="gap-2 text-sm"
                >
                  <Icon className="h-3.5 w-3.5 text-zinc-400" />
                  {g.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-sm">
            <Key className="h-8 w-8 mb-3 text-zinc-600" />
            {search ? "No matching items" : "No items yet"}
          </div>
        )}

        {filtered.map((item) => {
          const Icon = getTypeIcon(item.type);
          const schema = CREDENTIAL_TYPES[item.type];
          const expiryStatus = getExpiryStatus(item.expires);
          const testStatus = getTestStatus(item.lastTestResult);

          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 border-b border-zinc-800/50 text-left transition-colors",
                selectedId === item.id
                  ? "bg-zinc-800"
                  : "hover:bg-zinc-900/80",
              )}
            >
              <div className="shrink-0 h-8 w-8 rounded-md bg-zinc-800 flex items-center justify-center">
                <Icon className="h-4 w-4 text-zinc-400" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-100 truncate">
                    {item.name}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 truncate">
                  {item.service || schema.label}
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1.5">
                {/* Inline test button for testable items */}
                {schema.testable && item.test && item.hasValue && (
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => handleListTest(e, item.id)}
                          disabled={testingId === item.id}
                          className={cn(
                            "h-6 w-6 rounded flex items-center justify-center transition-colors",
                            testResults[item.id] === "pass"
                              ? "text-emerald-400"
                              : testResults[item.id] === "fail"
                                ? "text-red-400"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50",
                          )}
                        >
                          {testingId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : testResults[item.id] === "pass" ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : testResults[item.id] === "fail" ? (
                            <X className="h-3.5 w-3.5" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="text-xs">
                        Test credential
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <div className="flex flex-col items-end gap-1">
                  <ExpiryBadge status={expiryStatus} />
                  {schema.testable && <TestBadge status={testStatus} timestamp={item.lastTested} />}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
