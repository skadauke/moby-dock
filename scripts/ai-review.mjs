#!/usr/bin/env node

/**
 * AI Code Review Script using GPT-5.2-Codex (Responses API)
 * 
 * Packages the codebase and diff, sends to Codex for review,
 * outputs structured findings for PR comments.
 */

import { execSync } from 'child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.AI_REVIEW_MODEL || 'gpt-5.2-codex';
const MAX_FILE_SIZE = 50000;
const MAX_TOTAL_CHARS = 120000;

// File patterns to include
const INCLUDE_PATTERNS = [
  /\.tsx?$/,
  /\.jsx?$/,
  /\.json$/,
  /\.md$/,
  /\.yml$/,
  /\.yaml$/,
];

// Paths to exclude
const EXCLUDE_PATHS = [
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  'coverage',
  '.vercel',
  'package-lock.json',
];

function shouldIncludeFile(filePath) {
  for (const exclude of EXCLUDE_PATHS) {
    if (filePath.includes(exclude)) return false;
  }
  return INCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
}

function getAllFiles(dir, baseDir = dir) {
  const files = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const relativePath = relative(baseDir, fullPath);
      if (EXCLUDE_PATHS.some(ex => relativePath.startsWith(ex))) continue;
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        files.push(...getAllFiles(fullPath, baseDir));
      } else if (shouldIncludeFile(relativePath) && stat.size < MAX_FILE_SIZE) {
        files.push({ path: relativePath, size: stat.size });
      }
    }
  } catch (e) {}
  return files;
}

function getFileContents(files, baseDir) {
  let totalChars = 0;
  const contents = [];
  
  files.sort((a, b) => {
    const aIsSrc = a.path.startsWith('src/');
    const bIsSrc = b.path.startsWith('src/');
    if (aIsSrc && !bIsSrc) return -1;
    if (!aIsSrc && bIsSrc) return 1;
    return a.path.localeCompare(b.path);
  });
  
  for (const file of files) {
    if (totalChars >= MAX_TOTAL_CHARS) {
      contents.push(`\n... (truncated, ${files.length - contents.length} more files)`);
      break;
    }
    try {
      const content = readFileSync(join(baseDir, file.path), 'utf-8');
      contents.push(`\n=== ${file.path} ===\n${content}`);
      totalChars += content.length;
    } catch (e) {}
  }
  return contents.join('\n');
}

function getDiff() {
  try {
    const baseBranch = process.env.GITHUB_BASE_REF || 'main';
    return execSync(`git diff origin/${baseBranch}...HEAD`, { encoding: 'utf-8', maxBuffer: 1024 * 1024 });
  } catch (e) {
    try {
      return execSync('git diff HEAD~1', { encoding: 'utf-8', maxBuffer: 1024 * 1024 });
    } catch (e2) {
      return '(Unable to generate diff)';
    }
  }
}

function getPackageJson(baseDir) {
  try {
    return readFileSync(join(baseDir, 'package.json'), 'utf-8');
  } catch (e) {
    return '{}';
  }
}

function getPrChecklist(baseDir) {
  try {
    return readFileSync(join(baseDir, '.github/PULL_REQUEST_TEMPLATE.md'), 'utf-8');
  } catch (e) {
    return '';
  }
}

function getSpec(baseDir) {
  try {
    return readFileSync(join(baseDir, 'SPEC.md'), 'utf-8');
  } catch (e) {
    return '';
  }
}

async function callCodexResponses(context) {
  const prompt = `You are an expert code reviewer doing an EXHAUSTIVE, COMPREHENSIVE review. 

## CRITICAL INSTRUCTION
**List ALL issues you find in a SINGLE pass.** Do not hold back, prioritize, or limit the number of findings. We want the complete picture upfront — not spread across multiple review iterations. If you find 20 issues, list all 20. If you find 50, list all 50.

Be thorough but avoid duplicates. Each issue should be actionable and specific.

Focus on things that automated tools and linters would MISS.

## Your Review Focus

### 1. Logic & Correctness
- **Off-by-one errors** in loops, array indexing, pagination
- **Boundary conditions** and edge cases
- **Race conditions** in async code
- **Null/undefined handling** that could cause runtime errors

### 2. Data Validation
- **Input validation** - are all user inputs validated strictly?
- **Type coercion issues** - implicit conversions that could cause bugs
- **API request/response validation** - are schemas enforced?

### 3. Test Quality
- **Coverage gaps** - target >90% coverage; flag untested code paths
- **Missing edge cases** - empty arrays, null values, boundary values
- **Test assertions** - are tests actually testing the right things?
- **Mocking issues** - are mocks hiding real bugs?

### 4. Spec vs Implementation
- Compare against SPEC.md if present - does implementation match?
- Feature completeness - are all specified features implemented?
- Behavior discrepancies between spec and code

### 5. Documentation & Readability
- **Code clarity** - would a new developer understand this?
- **Comment quality** - do comments explain WHY, not just WHAT?
- **README accuracy** - does it reflect current state?
- **API documentation** - are endpoints/functions documented?

### 6. Security Vulnerabilities
- **Auth/authz gaps** - missing or inconsistent access control
- **Injection risks** - SQL, XSS, command injection
- **Secrets exposure** - hardcoded credentials, logged secrets
- **CSRF/CORS issues** - misconfigured security headers

### 7. Stale/Dead Code
- Files not imported anywhere
- Unused dependencies in package.json
- Outdated documentation referencing removed features
- Commented-out code that should be deleted

### 8. Semantic Versioning
- Does this change warrant a version bump? (patch/minor/major)
- Breaking changes that need documentation?
- CHANGELOG update needed?

## Product Specification (SPEC.md)
${context.spec || '(No SPEC.md found)'}

## PR Checklist (for reference)
${context.prChecklist}

## Package.json
\`\`\`json
${context.packageJson}
\`\`\`

## Git Diff (what changed)
\`\`\`diff
${context.diff.slice(0, 30000)}
\`\`\`

## Codebase
${context.codebase}

---

Review this code thoroughly.

## Output Format Requirements
Use EXACTLY these severity prefixes at the start of each finding line:
- "🔴 Critical:" - Security vulnerabilities, data loss risks, breaking bugs
- "🟠 Warning:" - Logic errors, missing validation, race conditions, test gaps
- "🟡 Suggestion:" - Style, readability, minor improvements

Format each finding as:
🔴 Critical: path/to/file.ts - Description of the issue
   Suggested fix: How to resolve it

Be specific and actionable. Skip obvious linter-catchable issues.

**REMINDER: List ALL issues you find. Do not limit yourself to a certain number or hold back "minor" issues for later. Complete exhaustive review in one pass.**

End with:
1. Total count of issues found by severity (Critical/Warning/Suggestion)
2. Brief summary
3. Version bump recommendation`;

  // Submit request in background mode for long-running reviews
  const submitResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: prompt,
      reasoning: {
        effort: 'medium',
      },
      background: true,
    }),
  });

  if (!submitResponse.ok) {
    const error = await submitResponse.text();
    throw new Error(`OpenAI API error: ${submitResponse.status} ${error}`);
  }

  const submitData = await submitResponse.json();
  const responseId = submitData.id;
  console.error(`   Request submitted (ID: ${responseId}), polling for completion...`);

  // Poll for completion (up to 10 minutes)
  const maxWaitMs = 10 * 60 * 1000;
  const pollIntervalMs = 5000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    
    const pollResponse = await fetch(`https://api.openai.com/v1/responses/${responseId}`, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
    });

    if (!pollResponse.ok) {
      const error = await pollResponse.text();
      throw new Error(`Poll error: ${pollResponse.status} ${error}`);
    }

    const data = await pollResponse.json();
    
    if (data.status === 'completed') {
      // Extract text from responses API output (message content only)
      if (data.output && data.output.length > 0) {
        for (const output of data.output) {
          if (output.type === 'message' && output.content) {
            const texts = output.content
              .filter(c => c.type === 'output_text')
              .map(c => c.text || '');
            if (texts.length > 0) {
              return texts.join('\n');
            }
          }
        }
      }
      return 'No review output generated.';
    } else if (data.status === 'failed') {
      throw new Error(`Review failed: ${JSON.stringify(data.error)}`);
    }
    
    // Still in progress
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.error(`   Still processing... (${elapsed}s)`);
  }

  throw new Error('Review timed out after 10 minutes');
}

async function main() {
  if (!OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  const baseDir = process.cwd();
  console.error('🔍 Gathering codebase...');
  
  const files = getAllFiles(baseDir);
  console.error(`   Found ${files.length} files`);
  
  const codebase = getFileContents(files, baseDir);
  console.error(`   Codebase: ${codebase.length} characters`);
  
  const diff = getDiff();
  console.error(`   Diff: ${diff.length} characters`);
  
  const packageJson = getPackageJson(baseDir);
  const prChecklist = getPrChecklist(baseDir);
  const spec = getSpec(baseDir);
  
  console.error(`🤖 Sending to ${MODEL} for review...`);
  
  try {
    const review = await callCodexResponses({ codebase, diff, packageJson, prChecklist, spec });
    console.log(review);
  } catch (error) {
    console.error('Error during review:', error.message);
    process.exit(1);
  }
}

main();
