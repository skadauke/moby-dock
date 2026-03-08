"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, AlertTriangle, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { MaskedVaultItem, VaultItemType } from "@/lib/vault/types";
import { CREDENTIAL_TYPES } from "@/lib/vault/schemas";
import { VaultSidebar, type SidebarFilter } from "./VaultSidebar";
import { VaultList } from "./VaultList";
import { VaultDetail } from "./VaultDetail";

export function VaultLayout() {
  const [allItems, setAllItems] = useState<MaskedVaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sidebar filter
  const [filter, setFilter] = useState<SidebarFilter>({ kind: "all" });

  // Detail panel
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createType, setCreateType] = useState<VaultItemType | null>(null);

  const fetchItems = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/vault/items");
      if (!res.ok) throw new Error("Failed to fetch vault items");
      const data = await res.json();
      setAllItems(data.items ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vault");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Apply sidebar filter
  const filteredItems = (() => {
    if (filter.kind === "all") return allItems;
    if (filter.kind === "type") return allItems.filter((i) => i.type === filter.type);
    // category
    const typesInCat = (Object.keys(CREDENTIAL_TYPES) as VaultItemType[]).filter(
      (t) => CREDENTIAL_TYPES[t].category === filter.category,
    );
    return allItems.filter((i) => typesInCat.includes(i.type));
  })();

  const selectedItem = selectedId ? allItems.find((i) => i.id === selectedId) ?? null : null;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setCreateType(null);
  };

  const handleAdd = (type: VaultItemType) => {
    setCreateType(type);
    setSelectedId(null);
  };

  const handleClose = () => {
    setSelectedId(null);
    setCreateType(null);
  };

  const handleSaved = () => {
    handleClose();
    fetchItems();
  };

  const handleDeleted = () => {
    handleClose();
    fetchItems();
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-950">
        <RefreshCw className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-zinc-950 gap-4">
        <AlertTriangle className="h-12 w-12 text-red-400" />
        <p className="text-zinc-400">{error}</p>
        <Button onClick={fetchItems}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-950 shrink-0">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-zinc-400" />
          <h1 className="text-lg font-semibold text-zinc-100">Vault</h1>
          <Badge variant="secondary" className="ml-1 text-xs">
            {allItems.length} items
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={fetchItems}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      </header>

      {/* Main area */}
      <div className="flex-1 flex min-h-0">
        <VaultSidebar items={allItems} filter={filter} onFilterChange={setFilter} />
        <VaultList
          items={filteredItems}
          selectedId={selectedId}
          onSelect={handleSelect}
          onAdd={handleAdd}
        />
      </div>

      {/* Detail panel (slide-out) */}
      <VaultDetail
        item={selectedItem}
        createType={createType}
        onClose={handleClose}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
