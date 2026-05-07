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

const captureButton = getElement<HTMLButtonElement>("capture");
const copyButton = getElement<HTMLButtonElement>("copy");
const downloadButton = getElement<HTMLButtonElement>("download");
const envelopeOutput = getElement<HTMLTextAreaElement>("envelope");
const statusLabel = getElement<HTMLElement>("status");

captureButton.addEventListener("click", () => {
  void captureActiveTab();
});

copyButton.addEventListener("click", () => {
  void navigator.clipboard.writeText(envelopeOutput.value).then(() => setStatus("Copied"));
});

downloadButton.addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([envelopeOutput.value], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `jobflow-ingest-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus("Downloaded");
});

async function captureActiveTab(): Promise<void> {
  setStatus("Capturing");
  captureButton.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error("No active tab");
    }

    const pageCapture = await chrome.tabs.sendMessage(tab.id, { type: "JOBFLOW_CAPTURE_PAGE" });
    const envelope = createIngestJobEnvelope({
      pageUrl: pageCapture.pageUrl || tab.url || "",
      tabTitle: pageCapture.tabTitle || tab.title || "",
      selectionText: pageCapture.selectionText,
      bodyText: pageCapture.bodyText
    });

    envelopeOutput.value = JSON.stringify(envelope, null, 2);
    copyButton.disabled = false;
    downloadButton.disabled = false;
    setStatus("Captured");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Capture failed");
  } finally {
    captureButton.disabled = false;
  }
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id}`);
  }
  return element as T;
}

function setStatus(value: string): void {
  statusLabel.textContent = value;
}
