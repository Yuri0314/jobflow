import { z } from "zod";

export const automationSiteSchema = z.enum(["fixture", "boss", "liepin", "lagou", "linkedin"]);

export const searchTaskSchema = z.object({
  task_id: z.string().min(1),
  site: automationSiteSchema,
  keyword: z.string().min(1),
  city: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(50).optional(),
  created_at: z.string().datetime()
});

export type AutomationSite = z.infer<typeof automationSiteSchema>;
export type SearchTask = z.infer<typeof searchTaskSchema>;
