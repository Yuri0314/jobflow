export type SourceSite = "boss" | "liepin" | "lagou" | "linkedin" | "unknown";

export type ExtensionSiteAdapter = {
  id: string;
  site: SourceSite;
  matchesUrl: (url: URL) => boolean;
};

export const extensionSiteAdapters: ExtensionSiteAdapter[] = [
  {
    id: "boss",
    site: "boss",
    matchesUrl: (url) => endsWithAny(url.hostname, ["zhipin.com", "kanzhun.com"])
  },
  {
    id: "liepin",
    site: "liepin",
    matchesUrl: (url) => endsWithAny(url.hostname, ["liepin.com"])
  },
  {
    id: "lagou",
    site: "lagou",
    matchesUrl: (url) => endsWithAny(url.hostname, ["lagou.com"])
  },
  {
    id: "linkedin",
    site: "linkedin",
    matchesUrl: (url) => endsWithAny(url.hostname, ["linkedin.com"])
  }
];

export const genericExtensionSiteAdapter: ExtensionSiteAdapter = {
  id: "generic",
  site: "unknown",
  matchesUrl: () => true
};

export function resolveExtensionSiteAdapter(url: string): ExtensionSiteAdapter {
  const parsedUrl = parseHttpUrl(url);
  if (!parsedUrl) return genericExtensionSiteAdapter;

  return (
    extensionSiteAdapters.find((adapter) => adapter.matchesUrl(parsedUrl)) ??
    genericExtensionSiteAdapter
  );
}

export function detectSourceSite(url: string): SourceSite {
  return resolveExtensionSiteAdapter(url).site;
}

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function endsWithAny(hostname: string, domains: string[]): boolean {
  const normalized = hostname.toLowerCase();
  return domains.some((domain) => normalized === domain || normalized.endsWith(`.${domain}`));
}
