/**
 * Rotation URL Schema
 * 
 * Defines the structure for AI-generated credential rotation information.
 */

import { z } from "zod";

/**
 * Schema for credential rotation information
 */
export const RotationInfoSchema = z.object({
  /** Direct URL to the credential management page */
  rotationUrl: z
    .string()
    .url()
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          return ["http:", "https:"].includes(parsed.protocol);
        } catch {
          return false;
        }
      },
      { message: "URL must use http or https protocol (no javascript:, data:, etc.)" }
    )
    .describe("Direct URL to the page where the credential can be rotated/regenerated"),
  
  /** Name of the page/section where the credential is managed */
  pageName: z
    .string()
    .describe("Name of the settings page or section (e.g., 'API Keys', 'Personal Access Tokens')"),
  
  /** Step-by-step instructions for rotating the credential */
  instructions: z
    .array(z.string())
    .describe("Step-by-step instructions for rotating the credential"),
  
  /** Whether the old credential is immediately invalidated on rotation */
  immediateInvalidation: z
    .boolean()
    .describe("Whether rotating invalidates the old credential immediately"),
  
  /** Any warnings or considerations when rotating */
  warnings: z
    .array(z.string())
    .optional()
    .describe("Warnings or considerations when rotating this credential"),
});

export type RotationInfo = z.infer<typeof RotationInfoSchema>;
