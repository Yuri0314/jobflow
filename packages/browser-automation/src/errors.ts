import { z } from "zod";

export const automationErrorCodeSchema = z.enum([
  "BROWSER_NOT_FOUND",
  "BROWSER_LAUNCH_FAILED",
  "EXTENSION_BUILD_MISSING",
  "PAGE_NAVIGATION_FAILED",
  "ADAPTER_NOT_FOUND",
  "ADAPTER_UNSUPPORTED_PAGE",
  "RESULTS_NOT_FOUND",
  "LOGIN_REQUIRED",
  "CAPTCHA_REQUIRED",
  "PLATFORM_BLOCKED",
  "PAGE_STRUCTURE_CHANGED",
  "TASK_TIMEOUT"
]);

export const automationErrorSchema = z.object({
  code: automationErrorCodeSchema,
  message: z.string().min(1),
  details: z.record(z.unknown()).optional()
});

export type AutomationErrorCode = z.infer<typeof automationErrorCodeSchema>;
export type AutomationError = z.infer<typeof automationErrorSchema>;
