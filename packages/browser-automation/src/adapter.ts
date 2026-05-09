import type { JobIngestPayload } from "@jobflow/schema";
import type { AutomationError } from "./errors.js";
import type { AutomationSite, SearchTask } from "./task.js";

export type BlockedPageDetection = AutomationError & {
  action?: string;
};

export type SiteAdapter = {
  site: AutomationSite;
  detectBlockedPage?: (html: string) => BlockedPageDetection | null;
  parseSearchResults(html: string, capturedAt: string, task?: SearchTask): JobIngestPayload[];
};

export type AdapterRegistry = {
  get(site: AutomationSite): SiteAdapter | undefined;
  list(): SiteAdapter[];
};

export function createAdapterRegistry(adapters: SiteAdapter[]): AdapterRegistry {
  const bySite = new Map<AutomationSite, SiteAdapter>();
  for (const adapter of adapters) {
    bySite.set(adapter.site, adapter);
  }

  return {
    get(site) {
      return bySite.get(site);
    },
    list() {
      return [...bySite.values()];
    }
  };
}
