/**
 * Quick Access Local Storage
 *
 * Simple localStorage-based storage for quick access items.
 * No backend needed - perfect for single-user local dashboard.
 *
 * @module quick-access-local
 */

export interface QuickAccessItem {
  id: string;
  filePath: string;
  fileName: string;
  description: string | null;
  position: number;
}

const STORAGE_KEY = "moby-dock-quick-access";

/**
 * Generate a simple unique ID
 */
function generateId(): string {
  return `qa-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Get default quick access items for a fresh installation
 */
function getDefaultItems(homeDir: string): QuickAccessItem[] {
  const defaults = [
    { name: "SOUL.md", path: `${homeDir}/clawd/SOUL.md`, description: "Personality & persona" },
    { name: "AGENTS.md", path: `${homeDir}/clawd/AGENTS.md`, description: "Workspace rules" },
    { name: "HEARTBEAT.md", path: `${homeDir}/clawd/HEARTBEAT.md`, description: "Periodic checks" },
    { name: "TOOLS.md", path: `${homeDir}/clawd/TOOLS.md`, description: "Tool settings" },
    { name: "USER.md", path: `${homeDir}/clawd/USER.md`, description: "User info" },
    { name: "IDENTITY.md", path: `${homeDir}/clawd/IDENTITY.md`, description: "Name & avatar" },
    { name: "MEMORY.md", path: `${homeDir}/clawd/MEMORY.md`, description: "Long-term memory" },
    { name: "openclaw.json", path: `${homeDir}/.openclaw/openclaw.json`, description: "Gateway config" },
  ];

  return defaults.map((item, index) => ({
    id: generateId(),
    filePath: item.path,
    fileName: item.name,
    description: item.description,
    position: index,
  }));
}

/**
 * Load items from localStorage
 */
export function loadQuickAccessItems(): QuickAccessItem[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const items = JSON.parse(stored) as QuickAccessItem[];
      // Ensure items are sorted by position
      return items.sort((a, b) => a.position - b.position);
    }
  } catch (e) {
    console.error("Failed to load quick access items:", e);
  }

  return [];
}

/**
 * Save items to localStorage
 */
export function saveQuickAccessItems(items: QuickAccessItem[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error("Failed to save quick access items:", e);
  }
}

/**
 * Initialize with default items if empty
 */
export function initializeQuickAccessIfEmpty(homeDir: string): QuickAccessItem[] {
  const existing = loadQuickAccessItems();
  if (existing.length > 0) {
    return existing;
  }

  const defaults = getDefaultItems(homeDir);
  saveQuickAccessItems(defaults);
  return defaults;
}

/**
 * Add a new item
 */
export function addQuickAccessItem(
  filePath: string,
  fileName: string,
  description?: string
): QuickAccessItem | null {
  const items = loadQuickAccessItems();

  // Check for duplicates
  if (items.some((i) => i.filePath === filePath)) {
    return null; // Already exists
  }

  const maxPosition = items.length > 0 ? Math.max(...items.map((i) => i.position)) : -1;

  const newItem: QuickAccessItem = {
    id: generateId(),
    filePath,
    fileName,
    description: description || null,
    position: maxPosition + 1,
  };

  items.push(newItem);
  saveQuickAccessItems(items);
  return newItem;
}

/**
 * Remove an item by ID
 */
export function removeQuickAccessItem(id: string): boolean {
  const items = loadQuickAccessItems();
  const filtered = items.filter((i) => i.id !== id);

  if (filtered.length === items.length) {
    return false; // Item not found
  }

  saveQuickAccessItems(filtered);
  return true;
}

/**
 * Reorder items by providing new ID order
 */
export function reorderQuickAccessItems(itemIds: string[]): void {
  const items = loadQuickAccessItems();
  const reordered = itemIds
    .map((id, index) => {
      const item = items.find((i) => i.id === id);
      if (item) {
        return { ...item, position: index };
      }
      return null;
    })
    .filter((i): i is QuickAccessItem => i !== null);

  saveQuickAccessItems(reordered);
}
