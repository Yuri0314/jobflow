export type AutomationSiteCapabilityStatus = "enabled" | "fixture_only" | "not_enabled";

export type AutomationSiteCapability = {
  site: "fixture" | "boss" | "liepin" | "lagou" | "linkedin";
  status: AutomationSiteCapabilityStatus;
  requires_fixture: boolean;
  supports_process_results: boolean;
};

const automationSites: AutomationSiteCapability[] = [
  {
    site: "fixture",
    status: "enabled",
    requires_fixture: false,
    supports_process_results: true
  },
  {
    site: "boss",
    status: "fixture_only",
    requires_fixture: true,
    supports_process_results: true
  },
  {
    site: "liepin",
    status: "not_enabled",
    requires_fixture: true,
    supports_process_results: false
  },
  {
    site: "lagou",
    status: "not_enabled",
    requires_fixture: true,
    supports_process_results: false
  },
  {
    site: "linkedin",
    status: "not_enabled",
    requires_fixture: true,
    supports_process_results: false
  }
];

export function listAutomationSites(): AutomationSiteCapability[] {
  return automationSites.map((site) => ({ ...site }));
}
