export { createAdapterRegistry, type AdapterRegistry, type SiteAdapter } from "./adapter.js";
export { bossAdapter, detectBossBlockedPage, parseBossSearchResults } from "./adapters/boss.js";
export { fixtureAdapter, parseFixtureSearchResults } from "./adapters/fixture.js";
export {
  buildChromiumLaunchArgs,
  createChromiumPageSession,
  findChromiumExecutable,
  type ChromiumLaunchArgsOptions,
  type ChromiumPageSession,
  type ChromiumPageSessionOptions
} from "./chromium-page-session.js";
export { executeSearchTask, type ExecuteSearchTaskOptions } from "./controller.js";
export {
  automationErrorCodeSchema,
  automationErrorSchema,
  type AutomationError,
  type AutomationErrorCode
} from "./errors.js";
export {
  fetchPageSession,
  type AutomationPage,
  type AutomationPageSession
} from "./page-session.js";
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
