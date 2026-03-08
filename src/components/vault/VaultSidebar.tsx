"use client";

import { cn } from "@/lib/utils";
import { SIDEBAR_GROUPS, CREDENTIAL_TYPES } from "@/lib/vault/schemas";
import type { VaultItemType, MaskedVaultItem } from "@/lib/vault/types";

export type SidebarFilter =
  | { kind: "all" }
  | { kind: "category"; category: "secrets" | "personal" }
  | { kind: "type"; type: VaultItemType };

interface Props {
  items: MaskedVaultItem[];
  filter: SidebarFilter;
  onFilterChange: (f: SidebarFilter) => void;
}

export function VaultSidebar({ items, filter, onFilterChange }: Props) {
  const total = items.length;

  const isActive = (f: SidebarFilter) => {
    if (f.kind === "all" && filter.kind === "all") return true;
    if (f.kind === "type" && filter.kind === "type" && f.type === filter.type) return true;
    return false;
  };

  const countByType = (type: VaultItemType) =>
    items.filter((i) => i.type === type).length;

  const countByCategory = (cat: "secrets" | "personal") => {
    const types = Object.keys(CREDENTIAL_TYPES).filter(
      (t) => CREDENTIAL_TYPES[t as VaultItemType].category === cat,
    );
    return items.filter((i) => types.includes(i.type)).length;
  };

  return (
    <aside className="w-60 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-y-auto">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Vault
        </h2>
      </div>

      {/* All Items */}
      <SidebarItem
        label="All Items"
        count={total}
        active={isActive({ kind: "all" })}
        onClick={() => onFilterChange({ kind: "all" })}
      />

      {/* Secrets */}
      <SectionHeader label="Secrets" count={countByCategory("secrets")} />
      {SIDEBAR_GROUPS.secrets.map((g) => (
        <SidebarItem
          key={g.type}
          label={g.label}
          count={countByType(g.type)}
          active={isActive({ kind: "type", type: g.type })}
          onClick={() => onFilterChange({ kind: "type", type: g.type })}
          indent
        />
      ))}

      {/* Personal */}
      <SectionHeader label="Personal" count={countByCategory("personal")} />
      {SIDEBAR_GROUPS.personal.map((g) => (
        <SidebarItem
          key={g.type}
          label={g.label}
          count={countByType(g.type)}
          active={isActive({ kind: "type", type: g.type })}
          onClick={() => onFilterChange({ kind: "type", type: g.type })}
          indent
        />
      ))}

      <div className="flex-1" />
    </aside>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <span className="text-[10px] text-zinc-600">{count}</span>
    </div>
  );
}

function SidebarItem({
  label,
  count,
  active,
  onClick,
  indent,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  indent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between px-4 py-1.5 text-sm transition-colors",
        indent && "pl-6",
        active
          ? "bg-zinc-800 text-zinc-100"
          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50",
      )}
    >
      <span className="truncate">{label}</span>
      <span className="text-xs text-zinc-500 tabular-nums">{count}</span>
    </button>
  );
}
