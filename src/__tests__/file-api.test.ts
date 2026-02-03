import { describe, it, expect } from "vitest";
import { getLanguage, QUICK_ACCESS_FILES, BASE_PATHS } from "@/lib/file-api";

describe("getLanguage", () => {
  describe("markdown files", () => {
    it("returns markdown for .md files", () => {
      expect(getLanguage("README.md")).toBe("markdown");
      expect(getLanguage("SOUL.md")).toBe("markdown");
      expect(getLanguage("docs/guide.md")).toBe("markdown");
    });
  });

  describe("JSON files", () => {
    it("returns json for .json files", () => {
      expect(getLanguage("package.json")).toBe("json");
      expect(getLanguage("config.json")).toBe("json");
      expect(getLanguage("tsconfig.json")).toBe("json");
    });
  });

  describe("YAML files", () => {
    it("returns yaml for .yaml files", () => {
      expect(getLanguage("config.yaml")).toBe("yaml");
      expect(getLanguage("docker-compose.yaml")).toBe("yaml");
    });

    it("returns yaml for .yml files", () => {
      expect(getLanguage("config.yml")).toBe("yaml");
      expect(getLanguage(".github/workflows/ci.yml")).toBe("yaml");
    });
  });

  describe("TypeScript files", () => {
    it("returns typescript for .ts files", () => {
      expect(getLanguage("index.ts")).toBe("typescript");
      expect(getLanguage("utils.ts")).toBe("typescript");
    });

    it("returns typescript for .tsx files", () => {
      expect(getLanguage("App.tsx")).toBe("typescript");
      expect(getLanguage("components/Button.tsx")).toBe("typescript");
    });
  });

  describe("JavaScript files", () => {
    it("returns javascript for .js files", () => {
      expect(getLanguage("index.js")).toBe("javascript");
      expect(getLanguage("config.js")).toBe("javascript");
    });

    it("returns javascript for .jsx files", () => {
      expect(getLanguage("App.jsx")).toBe("javascript");
      expect(getLanguage("components/Card.jsx")).toBe("javascript");
    });
  });

  describe("CSS files", () => {
    it("returns css for .css files", () => {
      expect(getLanguage("styles.css")).toBe("css");
      expect(getLanguage("globals.css")).toBe("css");
    });
  });

  describe("HTML files", () => {
    it("returns html for .html files", () => {
      expect(getLanguage("index.html")).toBe("html");
      expect(getLanguage("template.html")).toBe("html");
    });
  });

  describe("Shell files", () => {
    it("returns shell for .sh files", () => {
      expect(getLanguage("build.sh")).toBe("shell");
      expect(getLanguage("scripts/deploy.sh")).toBe("shell");
    });

    it("returns shell for .bash files", () => {
      expect(getLanguage("setup.bash")).toBe("shell");
    });
  });

  describe("unknown/default files", () => {
    it("returns plaintext for unknown extensions", () => {
      expect(getLanguage("file.xyz")).toBe("plaintext");
      expect(getLanguage("data.csv")).toBe("plaintext");
      expect(getLanguage("notes.txt")).toBe("plaintext");
    });

    it("returns plaintext for files without extension", () => {
      expect(getLanguage("Makefile")).toBe("plaintext");
      expect(getLanguage("Dockerfile")).toBe("plaintext");
      expect(getLanguage("README")).toBe("plaintext");
    });
  });

  describe("case insensitivity", () => {
    it("handles uppercase extensions", () => {
      expect(getLanguage("README.MD")).toBe("markdown");
      expect(getLanguage("CONFIG.JSON")).toBe("json");
      expect(getLanguage("STYLE.CSS")).toBe("css");
    });

    it("handles mixed case extensions", () => {
      expect(getLanguage("file.Ts")).toBe("typescript");
      expect(getLanguage("file.TsX")).toBe("typescript");
    });
  });
});

describe("QUICK_ACCESS_FILES", () => {
  it("contains expected workspace files", () => {
    const fileNames = QUICK_ACCESS_FILES.map(f => f.name);
    
    expect(fileNames).toContain("SOUL.md");
    expect(fileNames).toContain("AGENTS.md");
    expect(fileNames).toContain("HEARTBEAT.md");
    expect(fileNames).toContain("TOOLS.md");
    expect(fileNames).toContain("USER.md");
    expect(fileNames).toContain("IDENTITY.md");
    expect(fileNames).toContain("MEMORY.md");
    expect(fileNames).toContain("openclaw.json");
  });

  it("all files have required properties", () => {
    QUICK_ACCESS_FILES.forEach(file => {
      expect(file).toHaveProperty("name");
      expect(file).toHaveProperty("path");
      expect(file).toHaveProperty("description");
      expect(typeof file.name).toBe("string");
      expect(typeof file.path).toBe("string");
      expect(typeof file.description).toBe("string");
    });
  });

  it("paths contain clawd or openclaw directories", () => {
    QUICK_ACCESS_FILES.forEach(file => {
      expect(file.path).toMatch(/clawd|openclaw/);
    });
  });
});

describe("BASE_PATHS", () => {
  it("contains expected base paths", () => {
    const pathNames = BASE_PATHS.map(p => p.name);
    
    expect(pathNames).toContain("Workspace");
    expect(pathNames).toContain("Clawdbot");
    expect(pathNames).toContain("Config");
  });

  it("all paths have required properties", () => {
    BASE_PATHS.forEach(basePath => {
      expect(basePath).toHaveProperty("name");
      expect(basePath).toHaveProperty("path");
      expect(typeof basePath.name).toBe("string");
      expect(typeof basePath.path).toBe("string");
    });
  });

  it("has 3 base paths", () => {
    expect(BASE_PATHS).toHaveLength(3);
  });
});
