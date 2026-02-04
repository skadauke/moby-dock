/**
 * AI Module
 * 
 * Provides AI-assisted features using the Vercel AI SDK.
 */

// Core functionality
export { aiAssist, isAiConfigured } from "./assist";
export type { AiAssistOptions, AiAssistResult, AiAssistSuccess, AiAssistFailure } from "./assist";

// Schemas
export { TestScriptSchema, TestResultSchema } from "./schemas/test-script";
export type { TestScript, TestResult } from "./schemas/test-script";
export { RotationInfoSchema } from "./schemas/rotation-url";
export type { RotationInfo } from "./schemas/rotation-url";
export { TestConfigSchema, validateTestConfigPlaceholder } from "./schemas/test-config";
export type { GeneratedTestConfig } from "./schemas/test-config";

// Prompts
export { testScriptPrompt, TEST_SCRIPT_SYSTEM_PROMPT } from "./prompts/test-script";
export { rotationUrlPrompt, ROTATION_URL_SYSTEM_PROMPT } from "./prompts/rotation-url";
export { testConfigPrompt, TEST_CONFIG_SYSTEM_PROMPT } from "./prompts/test-config";
export type { CredentialInfo } from "./prompts/test-config";

// Client
export { getOpenAI, DEFAULT_MODEL } from "./client";
