"use client";

import { useState, useEffect, useCallback } from "react";
import { useLogger } from "next-axiom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Eye,
  EyeOff,
  Copy,
  Plus,
  Trash2,
  AlertTriangle,
  Check,
  RefreshCw,
  KeyRound,
  Play,
  Sparkles,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TestResult {
  success: boolean;
  status: number;
  message: string;
  testedAt: string;
  durationMs: number;
}

interface MaskedCredential {
  id: string;
  type: string;
  service: string;
  account?: string;
  email?: string;
  project?: string;
  expires: string | null;
  created: string;
  used_by: string[];
  notes?: string;
  hasValue: boolean;
  hasClientId: boolean;
  hasClientSecret: boolean;
  hasUrl: boolean;
  hasAnonKey: boolean;
  hasServiceRoleKey: boolean;
  hasAuthToken: boolean;
  hasTest: boolean;
  lastTestResult?: TestResult;
}

interface FullCredential extends MaskedCredential {
  value?: string;
  client_id?: string;
  client_secret?: string;
  url?: string;
  anon_key?: string;
  service_role_key?: string;
  auth_token?: string;
}

const CREDENTIAL_TYPES = [
  "api_key",
  "pat",
  "oauth_app",
  "bot_token",
  "app_password",
  "database_token",
  "secret",
  "api_token",
  "access_token",
];

export function VaultClient() {
  const [credentials, setCredentials] = useState<MaskedCredential[]>([]);
  const [expiryWarningDays, setExpiryWarningDays] = useState(30); // Default, updated from meta
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, FullCredential>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [testingCredential, setTestingCredential] = useState<string | null>(null);
  const [generatingTest, setGeneratingTest] = useState<string | null>(null);
  const [testError, setTestError] = useState<{ id: string; message: string } | null>(null);
  const log = useLogger();

  // Fetch credentials
  const fetchCredentials = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/vault/secrets");
      if (!res.ok) throw new Error("Failed to fetch secrets");
      const data = await res.json();
      setCredentials(data.credentials);
      // Use expiry warning days from secrets file meta if available
      if (data.meta?.check_expiry_days_before) {
        setExpiryWarningDays(data.meta.check_expiry_days_before);
      }
      // Clear revealed secrets on refresh to avoid stale cached values
      setRevealedSecrets({});
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load secrets");
      log.error("Failed to fetch secrets", { error: err instanceof Error ? err.message : "Unknown" });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [log]);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  // Reveal a secret
  const revealSecret = async (id: string) => {
    if (revealedSecrets[id]) {
      // Already revealed, hide it - use functional update
      setRevealedSecrets(prev => {
        const newRevealed = { ...prev };
        delete newRevealed[id];
        return newRevealed;
      });
      return;
    }

    try {
      setActionError(null);
      const res = await fetch(`/api/vault/secrets/${encodeURIComponent(id)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch secret");
      }
      const data = await res.json();
      // Use functional update to avoid stale closure
      setRevealedSecrets(prev => ({ ...prev, [id]: data }));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to reveal secret";
      log.error("Failed to reveal secret", { id, error: errorMsg });
      setActionError(errorMsg);
      setTimeout(() => setActionError(null), 3000);
    }
  };

  // Copy to clipboard with error handling
  const copyToClipboard = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      log.error("Failed to copy to clipboard", { 
        error: err instanceof Error ? err.message : "Unknown" 
      });
      // Fallback: select text for manual copy (if in a text field)
      // For now, just log the error silently
    }
  };

  // Delete credential
  const deleteCredential = async (id: string) => {
    try {
      setActionError(null);
      const res = await fetch(`/api/vault/secrets/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete");
      }
      // Use functional updates to avoid stale closures
      setCredentials(prev => prev.filter((c) => c.id !== id));
      // Clear revealed secret for deleted credential
      setRevealedSecrets(prev => {
        const newRevealed = { ...prev };
        delete newRevealed[id];
        return newRevealed;
      });
      setDeleteConfirm(null);
      log.info("Credential deleted", { id });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to delete credential";
      log.error("Failed to delete credential", { id, error: errorMsg });
      setActionError(errorMsg);
      setDeleteConfirm(null);
      setTimeout(() => setActionError(null), 3000);
    }
  };

  // Test a credential
  const testCredential = async (id: string) => {
    try {
      setTestingCredential(id);
      setTestError(null);
      const res = await fetch("/api/vault/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        // Check if we need to generate a test config
        if (data.needsGeneration) {
          // Automatically generate test config
          await generateTestConfig(id);
          return;
        }
        throw new Error(data.message || data.error || "Test failed");
      }
      
      // Update credential with test result
      setCredentials(prev => prev.map(c => 
        c.id === id ? { ...c, lastTestResult: data.result, hasTest: true } : c
      ));
      log.info("Credential test completed", { id, success: data.result.success });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Test failed";
      log.error("Credential test failed", { id, error: errorMsg });
      setTestError({ id, message: errorMsg });
      setTimeout(() => setTestError(null), 5000);
    } finally {
      setTestingCredential(null);
    }
  };

  // Generate test config via AI
  const generateTestConfig = async (id: string) => {
    try {
      setGeneratingTest(id);
      setTestError(null);
      const res = await fetch("/api/ai/generate-test-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, save: true }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to generate test");
      }
      
      // Update credential to show it has a test now
      setCredentials(prev => prev.map(c => 
        c.id === id ? { ...c, hasTest: true } : c
      ));
      log.info("Test config generated", { id });
      
      // Now run the test
      await testCredential(id);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to generate test";
      log.error("Failed to generate test config", { id, error: errorMsg });
      setTestError({ id, message: errorMsg });
      setTimeout(() => setTestError(null), 5000);
    } finally {
      setGeneratingTest(null);
    }
  };

  // Check if credential is expiring soon (uses configurable threshold from meta)
  const isExpiringSoon = useCallback((expires: string | null) => {
    if (!expires) return false;
    const expiryDate = new Date(expires);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= expiryWarningDays && daysUntilExpiry > 0;
  }, [expiryWarningDays]);

  const isExpired = (expires: string | null) => {
    if (!expires) return false;
    return new Date(expires) < new Date();
  };

  // Render secret value field
  const renderSecretField = (
    label: string,
    value: string | undefined,
    fieldId: string,
    isRevealed: boolean
  ) => {
    if (!value) return null;

    return (
      <div className="flex items-center gap-2 mt-2">
        <span className="text-xs text-zinc-500 w-24">{label}:</span>
        <code className="flex-1 bg-zinc-900 px-2 py-1 rounded text-xs font-mono overflow-hidden">
          {isRevealed ? value : "••••••••••••••••"}
        </code>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => copyToClipboard(value, fieldId)}
        >
          {copiedField === fieldId ? (
            <Check className="h-3 w-3 text-green-400" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertTriangle className="h-12 w-12 text-red-400" />
        <p className="text-zinc-400">{error}</p>
        <Button onClick={fetchCredentials}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-zinc-950 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-zinc-400" />
          <h1 className="text-lg font-semibold text-zinc-100">Vault</h1>
          <Badge variant="secondary" className="ml-2">
            {credentials.length} secrets
          </Badge>
          {actionError && (
            <Badge variant="destructive" className="ml-2">
              {actionError}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchCredentials}
            disabled={isRefreshing}
            className="h-8 w-8"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Secret
          </Button>
        </div>
      </header>

      {/* Credentials Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {credentials.map((cred) => {
            const revealed = revealedSecrets[cred.id];
            const expiringSoon = isExpiringSoon(cred.expires);
            const expired = isExpired(cred.expires);

            return (
              <Card
                key={cred.id}
                className={`bg-zinc-900 border-zinc-800 ${
                  expired
                    ? "border-red-500/50"
                    : expiringSoon
                    ? "border-amber-500/50"
                    : ""
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-medium text-zinc-100">
                        {cred.service}
                      </CardTitle>
                      <CardDescription className="text-xs text-zinc-500">
                        {cred.id}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      <Badge
                        variant="outline"
                        className="text-xs bg-zinc-800 border-zinc-700"
                      >
                        {cred.type}
                      </Badge>
                      {expired && (
                        <Badge variant="destructive" className="text-xs">
                          Expired
                        </Badge>
                      )}
                      {expiringSoon && !expired && (
                        <Badge className="text-xs bg-amber-500/20 text-amber-300 border-amber-500/50">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Expiring
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {/* Account/Email/Project info */}
                  {(cred.account || cred.email || cred.project) && (
                    <p className="text-xs text-zinc-400 mb-2">
                      {cred.account || cred.email || cred.project}
                    </p>
                  )}

                  {/* Secret values */}
                  {cred.hasValue &&
                    renderSecretField("Value", revealed?.value, `${cred.id}-value`, !!revealed)}
                  {cred.hasClientId &&
                    renderSecretField("Client ID", revealed?.client_id, `${cred.id}-client_id`, !!revealed)}
                  {cred.hasClientSecret &&
                    renderSecretField("Client Secret", revealed?.client_secret, `${cred.id}-client_secret`, !!revealed)}
                  {cred.hasUrl &&
                    renderSecretField("URL", revealed?.url, `${cred.id}-url`, !!revealed)}
                  {cred.hasAnonKey &&
                    renderSecretField("Anon Key", revealed?.anon_key, `${cred.id}-anon_key`, !!revealed)}
                  {cred.hasServiceRoleKey &&
                    renderSecretField("Service Role", revealed?.service_role_key, `${cred.id}-service_role_key`, !!revealed)}
                  {cred.hasAuthToken &&
                    renderSecretField("Auth Token", revealed?.auth_token, `${cred.id}-auth_token`, !!revealed)}

                  {/* Notes */}
                  {cred.notes && (
                    <p className="text-xs text-zinc-500 mt-3 italic">{cred.notes}</p>
                  )}

                  {/* Used by */}
                  {cred.used_by && cred.used_by.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {cred.used_by.map((use, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="text-xs bg-zinc-800/50 border-zinc-700 text-zinc-400"
                        >
                          {use}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-zinc-800">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revealSecret(cred.id)}
                      className="h-7 text-xs"
                    >
                      {revealed ? (
                        <>
                          <EyeOff className="h-3 w-3 mr-1" />
                          Hide
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3 mr-1" />
                          Reveal
                        </>
                      )}
                    </Button>
                    
                    {/* Test button - icon only with tooltip */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => testCredential(cred.id)}
                            disabled={testingCredential === cred.id || generatingTest === cred.id}
                            className={cn(
                              "h-7 w-7 transition-colors",
                              cred.lastTestResult?.success && "text-green-400 hover:text-green-300",
                              cred.lastTestResult && !cred.lastTestResult.success && "text-red-400 hover:text-red-300",
                              !cred.lastTestResult && !cred.hasTest && "text-zinc-400 hover:text-amber-300"
                            )}
                          >
                            {testingCredential === cred.id || generatingTest === cred.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : cred.lastTestResult?.success ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : cred.lastTestResult ? (
                              <XCircle className="h-4 w-4" />
                            ) : cred.hasTest ? (
                              <Play className="h-4 w-4" />
                            ) : (
                              <Sparkles className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-zinc-800 border-zinc-700">
                          {testingCredential === cred.id ? (
                            <p>Testing credential...</p>
                          ) : generatingTest === cred.id ? (
                            <p>AI generating test config...</p>
                          ) : cred.lastTestResult?.success ? (
                            <p>Valid • Click to re-test</p>
                          ) : cred.lastTestResult ? (
                            <p>Invalid • Click to re-test</p>
                          ) : cred.hasTest ? (
                            <p>Run test</p>
                          ) : (
                            <p>Generate test with AI</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Inline test status/error */}
                    {testError?.id === cred.id && (
                      <span className="text-xs text-red-400 animate-in fade-in slide-in-from-left-2">
                        {testError.message}
                      </span>
                    )}
                    {cred.lastTestResult && testError?.id !== cred.id && (
                      <span className={cn(
                        "text-xs transition-opacity",
                        cred.lastTestResult.success ? "text-green-400/70" : "text-red-400/70"
                      )}>
                        {cred.lastTestResult.success ? "Valid" : cred.lastTestResult.message}
                      </span>
                    )}

                    <div className="flex-1" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-zinc-500 hover:text-red-400"
                      onClick={() => setDeleteConfirm(cred.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Dates */}
                  <div className="flex items-center justify-between mt-2 text-xs text-zinc-600">
                    <span>Created: {cred.created}</span>
                    {cred.expires && <span>Expires: {cred.expires}</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {credentials.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
            <KeyRound className="h-12 w-12 mb-4" />
            <p>No secrets found</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setIsAddModalOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add your first secret
            </Button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Delete Credential</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteConfirm}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteCredential(deleteConfirm)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Secret Modal */}
      <AddSecretModal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onCreated={(newCred) => {
          setCredentials([...credentials, newCred]);
          setIsAddModalOpen(false);
        }}
      />
    </div>
  );
}

// Add Secret Modal Component
function AddSecretModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (cred: MaskedCredential) => void;
}) {
  const [formData, setFormData] = useState({
    id: "",
    type: "api_key",
    service: "",
    value: "",
    expires: "",
    notes: "",
    used_by: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const log = useLogger();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/vault/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: formData.id,
          type: formData.type,
          service: formData.service,
          value: formData.value,
          expires: formData.expires || null,
          notes: formData.notes || undefined,
          used_by: formData.used_by
            ? formData.used_by.split(",").map((s) => s.trim())
            : [],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create secret");
      }

      const data = await res.json();
      log.info("Secret created", { id: formData.id });

      onCreated({
        id: formData.id,
        type: formData.type,
        service: formData.service,
        expires: formData.expires || null,
        created: new Date().toISOString().split("T")[0],
        used_by: formData.used_by
          ? formData.used_by.split(",").map((s) => s.trim())
          : [],
        notes: formData.notes || undefined,
        hasValue: true,
        hasClientId: false,
        hasClientSecret: false,
        hasUrl: false,
        hasAnonKey: false,
        hasServiceRoleKey: false,
        hasAuthToken: false,
        hasTest: false,
      });

      // Reset form
      setFormData({
        id: "",
        type: "api_key",
        service: "",
        value: "",
        expires: "",
        notes: "",
        used_by: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create secret");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Secret</DialogTitle>
          <DialogDescription>
            Add a new credential to the vault.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="id">ID (key name)</Label>
            <Input
              id="id"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              placeholder="e.g., github_token"
              required
              className="bg-zinc-800 border-zinc-700"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="service">Service</Label>
            <Input
              id="service"
              value={formData.service}
              onChange={(e) => setFormData({ ...formData, service: e.target.value })}
              placeholder="e.g., GitHub"
              required
              className="bg-zinc-800 border-zinc-700"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger className="bg-zinc-800 border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                {CREDENTIAL_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">Value (secret)</Label>
            <Input
              id="value"
              type="password"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              placeholder="Enter secret value"
              required
              className="bg-zinc-800 border-zinc-700"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expires">Expires (optional)</Label>
            <Input
              id="expires"
              type="date"
              value={formData.expires}
              onChange={(e) => setFormData({ ...formData, expires: e.target.value })}
              className="bg-zinc-800 border-zinc-700"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="used_by">Used by (comma-separated)</Label>
            <Input
              id="used_by"
              value={formData.used_by}
              onChange={(e) => setFormData({ ...formData, used_by: e.target.value })}
              placeholder="e.g., moby-dock, scripts/deploy.sh"
              className="bg-zinc-800 border-zinc-700"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional notes..."
              className="bg-zinc-800 border-zinc-700"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Secret"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
