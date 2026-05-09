export { createAdapterRegistry, type AdapterRegistry, type SiteAdapter } from "./adapter.js";
export { fixtureAdapter, parseFixtureSearchResults } from "./adapters/fixture.js";
export {
  automationErrorCodeSchema,
  automationErrorSchema,
  type AutomationError,
  type AutomationErrorCode
} from "./errors.js";
export {
  automationActionLogSchema,
  automationActionStatusSchema,
  automationResultSchema,
  type AutomationActionLog,
  type AutomationResult
} from "./result.js";
export {
  automationSiteSchema,
  searchTaskSchema,
  type AutomationSite,
  type SearchTask
} from "./task.js";
