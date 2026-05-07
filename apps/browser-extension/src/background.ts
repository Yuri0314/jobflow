import { createIngestJobEnvelope, type PageCapture } from "./envelope";

type ChromeTab = {
  id?: number;
  url?: string;
  title?: string;
};

type ChromeApi = {
  tabs: {
    query: (queryInfo: { active: boolean; currentWindow: boolean }) => Promise<ChromeTab[]>;
    sendMessage: (tabId: number, message: { type: "JOBFLOW_CAPTURE_PAGE" }) => Promise<PageCapture>;
  };
};

declare const chrome: ChromeApi;

async function captureActiveTabForSmoke() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("No active tab");
  }

  const pageCapture = await chrome.tabs.sendMessage(tab.id, { type: "JOBFLOW_CAPTURE_PAGE" });
  return createIngestJobEnvelope({
    pageUrl: pageCapture.pageUrl || tab.url || "",
    tabTitle: pageCapture.tabTitle || tab.title || "",
    selectionText: pageCapture.selectionText,
    bodyText: pageCapture.bodyText
  });
}

Object.assign(globalThis, {
  jobflowSmokeCaptureActiveTab: captureActiveTabForSmoke
});
