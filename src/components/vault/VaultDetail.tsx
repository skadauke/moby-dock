"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  X,
  Eye,
  EyeOff,
  Copy,
  Check,
  Trash2,
  Save,
  Play,
  Loader2,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Wand2,
  ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CREDENTIAL_TYPES, type FieldSchema } from "@/lib/vault/schemas";
import type { VaultItemType, MaskedVaultItem, TestConfig } from "@/lib/vault/types";
import { getTypeIcon } from "./VaultList";
import {
  ExpiryBadge,
  TestBadge,
  getExpiryStatus,
  getTestStatus,
} from "./VaultStatusBadge";
import { getTestPreset } from "@/lib/vault/test-presets";
import { COUNTRIES } from "@/lib/vault/countries";

// ── Validation Helpers ──────────────────────────────────────────────

function validateEmail(email: string): string | null {
  if (!email) return null;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email) ? null : "Invalid email address";
}

function validatePhone(phone: string): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s\-().]/g, "");
  if (!/^\+?\d+$/.test(cleaned)) return "Invalid phone number";
  if (cleaned.replace(/\D/g, "").length < 7) return "Phone number too short";
  return null;
}

// ── Payment Card Utilities ──────────────────────────────────────────

function detectCardBrand(number: string): string {
  const n = number.replace(/\s/g, "");
  if (/^3[47]/.test(n)) return "Amex";
  if (/^4/.test(n)) return "Visa";
  if (/^5[1-5]/.test(n)) return "Mastercard";
  if (/^6(?:011|5)/.test(n)) return "Discover";
  return "Other";
}

function luhnCheck(number: string): boolean {
  const n = number.replace(/\D/g, "");
  if (n.length < 13) return false;
  let sum = 0;
  let alternate = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let digit = parseInt(n[i], 10);
    if (alternate) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length > 2) {
    return digits.slice(0, 2) + "/" + digits.slice(2);
  }
  return digits;
}

function validateCvv(cvv: string, brand: string): string | null {
  const digits = cvv.replace(/\D/g, "");
  const required = brand === "Amex" ? 4 : 3;
  if (digits.length > 0 && digits.length !== required) {
    return `CVV must be ${required} digits${brand === "Amex" ? " for Amex" : ""}`;
  }
  return null;
}

interface Props {
  item: MaskedVaultItem | null;
  /** When set, we're in create mode for this type */
  createType: VaultItemType | null;
  onClose: () => void;
  onSaved: () => void;
  /** Refresh items without closing panel (used after test) */
  onRefresh?: () => void;
  onDeleted: () => void;
}

export function VaultDetail({ item, createType, onClose, onSaved, onRefresh, onDeleted }: Props) {
  const isCreate = !!createType;
  const type = createType ?? item?.type ?? "api_key";
  const schema = CREDENTIAL_TYPES[type];
  const Icon = getTypeIcon(type);

  // Form state — all field values keyed by field key
  const [values, setValues] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // Payment card validation
  const [cardErrors, setCardErrors] = useState<Record<string, string | null>>({});

  // Field validation errors (email, phone)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  // Test config state
  const [testConfig, setTestConfig] = useState<Partial<TestConfig>>({});
  const [testConfigOpen, setTestConfigOpen] = useState(false);

  // UI state
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // #6: Clear all state when selected item changes
  useEffect(() => {
    setError(null);
    setTestResult(null);
    setCardErrors({});
    setFieldErrors({});
    setCopiedKey(null);
  }, [item?.id, createType]);

  // Populate form when item changes
  useEffect(() => {
    if (isCreate) {
      setValues({});
      setName("");
      setTags([]);
      setTestConfig({});
      setTestConfigOpen(false);
      setRevealed({});
      setRevealedKeys(new Set());
      return;
    }
    if (!item) return;

    const vals: Record<string, string> = {};
    // Map item fields into the form
    for (const f of schema.fields) {
      const k = f.key;
      // Check top-level item keys first
      if (k === "service" && item.service) vals[k] = item.service;
      else if (k === "username" && item.username) vals[k] = item.username;
      else if (k === "url" && item.url) vals[k] = item.url;
      else if (k === "expires" && item.expires) vals[k] = item.expires;
      else if (k === "notes" && item.notes) vals[k] = item.notes;
      else if (k === "usedBy" && item.usedBy) vals[k] = item.usedBy.join(", ");
      // Then check fields object
      else if (item.fields && item.fields[k] !== undefined && item.fields[k] !== null) {
        const v = item.fields[k];
        vals[k] = Array.isArray(v) ? v.join(", ") : String(v);
      }
      // Secret fields show nothing — they need to be revealed
    }

    setValues(vals);
    setName(item.name);
    setTags(item.tags ?? []);
    setTestConfig(item.test ?? {});
    setTestConfigOpen(false);
    setRevealed({});
    setRevealedKeys(new Set());
  }, [item, isCreate, schema, type]);

  const setField = (key: string, value: string) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };

      // Payment card auto-detection and formatting
      if (type === "payment_card") {
        if (key === "number") {
          const brand = detectCardBrand(value);
          next.brand = brand;
        }
        if (key === "expiry") {
          next[key] = formatExpiry(value);
          return next;
        }
      }

      return next;
    });
  };

  const handleCardBlur = (key: string) => {
    if (type !== "payment_card") return;
    if (key === "number") {
      const num = values.number ?? "";
      const digits = num.replace(/\D/g, "");
      if (digits.length > 0 && !luhnCheck(digits)) {
        setCardErrors((prev) => ({ ...prev, number: "Invalid card number" }));
      } else {
        setCardErrors((prev) => ({ ...prev, number: null }));
      }
    }
    if (key === "cvv") {
      const brand = values.brand || detectCardBrand(values.number ?? "");
      const err = validateCvv(values.cvv ?? "", brand);
      setCardErrors((prev) => ({ ...prev, cvv: err }));
    }
  };

  // Field validation on blur (#11)
  const handleFieldBlur = (field: FieldSchema) => {
    if (field.validation === "email") {
      const err = validateEmail(values[field.key] ?? "");
      setFieldErrors((prev) => ({ ...prev, [field.key]: err }));
    } else if (field.validation === "phone") {
      const err = validatePhone(values[field.key] ?? "");
      setFieldErrors((prev) => ({ ...prev, [field.key]: err }));
    }
  };

  // Reveal secrets
  const revealSecrets = useCallback(async () => {
    if (!item) return;
    try {
      const res = await fetch(`/api/vault/items/${item.id}/reveal`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to reveal");
      const data = await res.json();
      setRevealed(data.secrets ?? {});
      setRevealedKeys(new Set(Object.keys(data.secrets ?? {})));
    } catch {
      setError("Failed to reveal secrets");
    }
  }, [item]);

  const toggleReveal = (key: string) => {
    if (revealedKeys.has(key)) {
      setRevealedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } else if (revealed[key]) {
      setRevealedKeys((prev) => new Set(prev).add(key));
    } else {
      // Need to fetch all secrets first
      revealSecrets();
    }
  };

  // #7: Copy without reveal — fetch from API but don't show on screen
  const copyValue = async (key: string) => {
    // If already revealed or it's a create form, copy directly
    const directVal = revealed[key] || (isCreate ? values[key] : undefined);
    if (directVal) {
      try {
        await navigator.clipboard.writeText(directVal);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
      } catch { /* silent */ }
      return;
    }

    // For secret fields on existing items: fetch via reveal API but don't show
    if (item) {
      try {
        const res = await fetch(`/api/vault/items/${item.id}/reveal`, { method: "POST" });
        if (!res.ok) throw new Error("Failed to reveal for copy");
        const data = await res.json();
        const secrets = data.secrets ?? {};
        const val = secrets[key];
        if (val) {
          await navigator.clipboard.writeText(val);
          setCopiedKey(key);
          setTimeout(() => setCopiedKey(null), 2000);
        }
      } catch {
        setError("Failed to copy secret");
      }
      return;
    }

    // Fall back to visible value
    const val = values[key];
    if (!val) return;
    try {
      await navigator.clipboard.writeText(val);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch { /* silent */ }
  };

  // Save
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Validate name
      if (!name.trim()) {
        setError("Name is required");
        setSaving(false);
        return;
      }

      // Use the current type's schema for validation
      const currentSchema = CREDENTIAL_TYPES[type];

      // Build body from form values
      const body: Record<string, unknown> = { name: name.trim(), tags };

      // Top-level mapped keys
      const topLevelMap: Record<string, string> = {
        service: "service",
        username: "username",
        url: "url",
        expires: "expires",
        notes: "notes",
      };

      const fields: Record<string, string | string[]> = {};

      for (const f of currentSchema.fields) {
        const v = values[f.key]?.trim();
        const isSecretField = f.type === "secret";
        const serverHasValue = !isCreate && item?.secretFieldKeys?.includes(f.key);

        // Skip validation for secret fields that already have a value on the server
        // and the user hasn't entered a new value
        if (!v && f.required) {
          if (isSecretField && serverHasValue) {
            // Server already has this secret — skip validation and omit from body
            continue;
          }
          setError(`${f.label} is required`);
          setSaving(false);
          return;
        }

        // For secret fields on existing items: if unrevealed and unchanged, omit from body
        // so the server keeps existing values
        if (isSecretField && !isCreate && !v && serverHasValue) {
          continue;
        }

        if (!v) continue;

        if (f.key === "value") body.value = v;
        else if (f.key === "password") body.password = v;
        else if (f.key === "usedBy") body.usedBy = v.split(",").map((s) => s.trim()).filter(Boolean);
        else if (f.key === "tags") {
          // handled via tags state
        } else if (topLevelMap[f.key]) body[topLevelMap[f.key]] = v;
        else fields[f.key] = v;
      }

      if (Object.keys(fields).length > 0) body.fields = fields;

      // Include test config if this type is testable and config is filled
      if (schema.testable && testConfig.url && testConfig.method && testConfig.expectStatus) {
        body.test = testConfig;
      }

      if (isCreate) {
        body.type = type;
        const res = await fetch("/api/vault/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Failed to create");
        }
      } else if (item) {
        const res = await fetch(`/api/vault/items/${item.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Failed to update");
        }
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!item) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/vault/items/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setDeleteOpen(false);
      onDeleted();
    } catch {
      setError("Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  // #1 & #2: Test — show result inline, don't close panel
  const handleTest = async () => {
    if (!item) return;
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const res = await fetch(`/api/vault/items/${item.id}/test`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Test failed");
      const success = data.result?.success ?? false;
      setTestResult({
        success,
        message: success ? "Test passed" : (data.result?.message || "Test failed"),
      });
      // Refresh items in background (updates badges) but DON'T close panel
      onRefresh?.();
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Test failed",
      });
    } finally {
      setTesting(false);
    }
  };

  // Add tag
  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
  };

  const isOpen = !!item || isCreate;

  return (
    <>
      {/* Slide-out panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 w-[400px] bg-zinc-900 border-l border-zinc-800 z-40 transform transition-transform duration-200 ease-out flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-zinc-800 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-zinc-400" />
            </div>
            <span className="text-sm font-medium text-zinc-300">{schema.label}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Status bar */}
        {!isCreate && item && (
          <div className="flex flex-col border-b border-zinc-800/50">
            <div className="flex items-center gap-2 px-4 py-2">
              <ExpiryBadge status={getExpiryStatus(item.expires)} />
              {schema.testable && (
                <>
                  <TestBadge status={getTestStatus(item.lastTestResult)} timestamp={item.lastTested} />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs gap-1 ml-auto"
                    onClick={handleTest}
                    disabled={testing}
                  >
                    {testing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    Test now
                  </Button>
                </>
              )}
            </div>
            {/* #1: Inline test result */}
            {testResult && (
              <div
                className={cn(
                  "px-4 py-1.5 text-xs flex items-center gap-1.5",
                  testResult.success
                    ? "text-emerald-400 bg-emerald-950/30"
                    : "text-red-400 bg-red-950/30",
                )}
              >
                {testResult.success ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <X className="h-3 w-3" />
                )}
                {testResult.message}
              </div>
            )}
            {/* #10: OAuth test note */}
            {type === "oauth_credential" && schema.testable && (
              <div className="px-4 py-1 text-[10px] text-zinc-500">
                Testing uses the Access Token.
              </div>
            )}
          </div>
        )}

        {/* Fields */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Name field — prominent with label */}
          <div className="space-y-1">
            <Label className="text-xs text-zinc-400">
              Name<span className="text-red-400 ml-0.5">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Item name…"
              className={cn(
                "bg-zinc-800 border-zinc-700 h-8 text-sm font-medium",
                error === "Name is required" && "border-red-500/50",
              )}
            />
          </div>

          {/* Auto-fill test config button */}
          {schema.testable && (() => {
            const serviceVal = values.service?.toLowerCase().replace(/\s+/g, "_") ?? "";
            const preset = serviceVal ? getTestPreset(serviceVal) : null;
            if (!preset) return null;
            return (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-xs border-zinc-700 text-zinc-400 hover:text-zinc-200"
                onClick={() => {
                  setTestConfig(preset.test);
                  setTestConfigOpen(true);
                }}
              >
                <Wand2 className="h-3.5 w-3.5" />
                Auto-fill test config for {preset.label}
              </Button>
            );
          })()}

          {schema.fields.map((field) => (
            <FieldRow
              key={field.key}
              field={field}
              value={values[field.key] ?? ""}
              revealedValue={revealed[field.key]}
              isRevealed={revealedKeys.has(field.key)}
              isCopied={copiedKey === field.key}
              onChange={(v) => setField(field.key, v)}
              onToggleReveal={() => toggleReveal(field.key)}
              onCopy={() => copyValue(field.key)}
              isCreate={isCreate}
              hasSecretValue={item?.secretFieldKeys?.includes(field.key) ?? false}
              onBlur={() => {
                handleCardBlur(field.key);
                handleFieldBlur(field);
              }}
              error={cardErrors[field.key] ?? fieldErrors[field.key] ?? undefined}
              readOnlyOverride={type === "payment_card" && field.key === "brand" ? true : undefined}
            />
          ))}

          {/* Test Configuration (for testable types) */}
          {schema.testable && (
            <div className="space-y-2 border border-zinc-800 rounded-md">
              <button
                type="button"
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
                onClick={() => setTestConfigOpen(!testConfigOpen)}
              >
                {testConfigOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                <FlaskConical className="h-3.5 w-3.5" />
                Test Configuration
                {testConfig.url && (
                  <Badge variant="secondary" className="text-[10px] bg-zinc-800 ml-auto">
                    Configured
                  </Badge>
                )}
              </button>
              {testConfigOpen && (
                <div className="px-3 pb-3 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-zinc-400">Test URL</Label>
                    <Input
                      value={testConfig.url ?? ""}
                      onChange={(e) =>
                        setTestConfig((prev) => ({ ...prev, url: e.target.value }))
                      }
                      placeholder="https://api.example.com/v1/me"
                      className="bg-zinc-800 border-zinc-700 h-8 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-zinc-400">Method</Label>
                      <Select
                        value={testConfig.method ?? "GET"}
                        onValueChange={(v) =>
                          setTestConfig((prev) => ({
                            ...prev,
                            method: v as TestConfig["method"],
                          }))
                        }
                      >
                        <SelectTrigger className="bg-zinc-800 border-zinc-700 h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-800 border-zinc-700">
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="POST">POST</SelectItem>
                          <SelectItem value="PUT">PUT</SelectItem>
                          <SelectItem value="HEAD">HEAD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-zinc-400">Expected Status</Label>
                      <Input
                        value={
                          testConfig.expectStatus
                            ? Array.isArray(testConfig.expectStatus)
                              ? testConfig.expectStatus.join(", ")
                              : String(testConfig.expectStatus)
                            : ""
                        }
                        onChange={(e) => {
                          const nums = e.target.value
                            .split(",")
                            .map((s) => parseInt(s.trim(), 10))
                            .filter((n) => !isNaN(n));
                          setTestConfig((prev) => ({
                            ...prev,
                            expectStatus: nums.length === 1 ? nums[0] : nums.length > 1 ? nums : undefined,
                          }));
                        }}
                        placeholder="200"
                        className="bg-zinc-800 border-zinc-700 h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-zinc-400">
                      Headers <span className="text-zinc-600">(one per line, Key: Value)</span>
                    </Label>
                    <Textarea
                      value={
                        testConfig.headers
                          ? Object.entries(testConfig.headers)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join("\n")
                          : ""
                      }
                      onChange={(e) => {
                        const headers: Record<string, string> = {};
                        for (const line of e.target.value.split("\n")) {
                          const idx = line.indexOf(":");
                          if (idx > 0) {
                            headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
                          }
                        }
                        setTestConfig((prev) => ({
                          ...prev,
                          headers: Object.keys(headers).length > 0 ? headers : undefined,
                        }));
                      }}
                      placeholder={"Authorization: Bearer $VALUE"}
                      className="bg-zinc-800 border-zinc-700 text-sm min-h-[48px] font-mono"
                    />
                    <p className="text-[10px] text-zinc-600">
                      Use <code className="bg-zinc-800 px-1 rounded">$VALUE</code> as placeholder for the credential value
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tags (if not a schema field) */}
          {!schema.fields.some((f) => f.key === "tags") && (
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Tags</Label>
              <div className="flex flex-wrap gap-1 mb-1">
                {tags.map((t) => (
                  <Badge
                    key={t}
                    variant="secondary"
                    className="text-xs bg-zinc-800 gap-1 cursor-pointer hover:bg-zinc-700"
                    onClick={() => setTags(tags.filter((x) => x !== t))}
                  >
                    {t} ×
                  </Badge>
                ))}
              </div>
              <div className="flex gap-1">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  placeholder="Add tag…"
                  className="bg-zinc-800 border-zinc-700 h-7 text-xs"
                />
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addTag}>
                  Add
                </Button>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-zinc-800">
          {!isCreate && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-400 hover:text-red-300 gap-1"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 gap-1"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {isCreate ? "Create" : "Save"}
          </Button>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30"
          onClick={onClose}
        />
      )}

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{item?.name}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Country Combobox ─────────────────────────────────────────────────
function CountryCombobox({
  value,
  onChange,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const selectedCountry = useMemo(
    () => COUNTRIES.find((c) => c.code === value || c.name === value),
    [value],
  );

  return (
    <div className="space-y-1">
      <Label className="text-xs text-zinc-400">
        Country
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-zinc-800 border-zinc-700 h-8 text-sm font-normal hover:bg-zinc-750"
          >
            {selectedCountry ? selectedCountry.name : "Select country…"}
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0 bg-zinc-800 border-zinc-700" align="start">
          <Command className="bg-zinc-800">
            <CommandInput placeholder="Search country…" className="text-sm" />
            <CommandList>
              <CommandEmpty>No country found.</CommandEmpty>
              <CommandGroup>
                {COUNTRIES.map((c) => (
                  <CommandItem
                    key={c.code}
                    value={c.name}
                    onSelect={() => {
                      onChange(c.name);
                      setOpen(false);
                    }}
                    className="text-sm"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-3.5 w-3.5",
                        (value === c.code || value === c.name) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {c.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ── Individual Field Row ───────────────────────────────────────────
function FieldRow({
  field,
  value,
  revealedValue,
  isRevealed,
  isCopied,
  onChange,
  onToggleReveal,
  onCopy,
  isCreate,
  hasSecretValue,
  onBlur,
  error,
  readOnlyOverride,
}: {
  field: FieldSchema;
  value: string;
  revealedValue?: string;
  isRevealed: boolean;
  isCopied: boolean;
  onChange: (v: string) => void;
  onToggleReveal: () => void;
  onCopy: () => void;
  isCreate: boolean;
  hasSecretValue: boolean;
  onBlur?: () => void;
  error?: string;
  readOnlyOverride?: boolean;
}) {
  const isSecret = field.type === "secret";

  // Country combobox
  if (field.type === "country") {
    return (
      <CountryCombobox
        value={value}
        onChange={onChange}
        required={field.required}
      />
    );
  }

  // For tags-type fields (#13: match styling with other inputs)
  if (field.type === "tags") {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-zinc-400">
          {field.label}
          {field.required && <span className="text-red-400 ml-0.5">*</span>}
        </Label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "comma-separated values"}
          className="bg-zinc-800 border-zinc-700 h-8 text-sm"
        />
        {field.description && (
          <p className="text-[10px] text-zinc-500">{field.description}</p>
        )}
      </div>
    );
  }

  // Select
  if (field.type === "select" && field.options) {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-zinc-400">
          {field.label}
          {field.required && <span className="text-red-400 ml-0.5">*</span>}
        </Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="bg-zinc-800 border-zinc-700 h-8 text-sm">
            <SelectValue placeholder={`Select ${field.label.toLowerCase()}…`} />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700">
            {field.options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {field.description && (
          <p className="text-[10px] text-zinc-500">{field.description}</p>
        )}
      </div>
    );
  }

  // Textarea
  if (field.type === "textarea") {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-zinc-400">
          {field.label}
          {field.required && <span className="text-red-400 ml-0.5">*</span>}
        </Label>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="bg-zinc-800 border-zinc-700 text-sm min-h-[60px]"
        />
        {field.description && (
          <p className="text-[10px] text-zinc-500">{field.description}</p>
        )}
      </div>
    );
  }

  // Secret field
  if (isSecret) {
    const showMasked = !isCreate && !isRevealed && hasSecretValue;

    return (
      <div className="space-y-1">
        <Label className="text-xs text-zinc-400">
          {field.label}
          {field.required && <span className="text-red-400 ml-0.5">*</span>}
        </Label>
        <div className="flex items-center gap-1">
          <Input
            type={isCreate || isRevealed ? "text" : "password"}
            value={
              isCreate
                ? value
                : isRevealed
                  ? revealedValue ?? ""
                  : showMasked
                    ? "••••••••••••"
                    : ""
            }
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={isCreate ? field.placeholder || "Enter value…" : ""}
            readOnly={!isCreate && !isRevealed}
            className={cn(
              "bg-zinc-800 border-zinc-700 h-8 text-sm font-mono flex-1",
              showMasked && "text-zinc-500",
              error && "border-red-500/50",
            )}
          />
          {!isCreate && (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onToggleReveal}>
                {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onCopy}>
                {isCopied ? (
                  <Check className="h-3.5 w-3.5 text-green-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </>
          )}
        </div>
        {field.description && (
          <p className="text-[10px] text-zinc-500">{field.description}</p>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  // Regular text / date
  const isDate = field.type === "date";
  return (
    <div className="space-y-1">
      <Label className="text-xs text-zinc-400">
        {field.label}
        {field.required && <span className="text-red-400 ml-0.5">*</span>}
      </Label>
      <Input
        type={isDate ? "date" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={isDate ? "MM/DD/YYYY" : field.placeholder}
        readOnly={readOnlyOverride}
        className={cn(
          "bg-zinc-800 border-zinc-700 h-8 text-sm",
          isDate && !value && "text-zinc-500 uppercase [&::-webkit-datetime-edit-text]:text-zinc-500 [&::-webkit-datetime-edit-month-field]:text-zinc-500 [&::-webkit-datetime-edit-day-field]:text-zinc-500 [&::-webkit-datetime-edit-year-field]:text-zinc-500",
          readOnlyOverride && "text-zinc-500",
          error && "border-red-500/50",
        )}
      />
      {field.description && (
        <p className="text-[10px] text-zinc-500">{field.description}</p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
