type CaptureRequest = {
  type: "JOBFLOW_CAPTURE_PAGE";
};

type CaptureResponse = {
  pageUrl: string;
  tabTitle: string;
  selectionText: string;
  bodyText: string;
};

const MAX_BODY_TEXT_LENGTH = 12000;

declare const chrome:
  | {
      runtime?: {
        onMessage?: {
          addListener: (
            callback: (
              message: CaptureRequest,
              sender: unknown,
              sendResponse: (response: CaptureResponse) => void
            ) => boolean | void
          ) => void;
        };
      };
    }
  | undefined;

chrome?.runtime?.onMessage?.addListener((message, _sender, sendResponse) => {
  if (message.type !== "JOBFLOW_CAPTURE_PAGE") {
    return;
  }

  sendResponse({
    pageUrl: window.location.href,
    tabTitle: document.title,
    selectionText: window.getSelection()?.toString() ?? "",
    bodyText: (document.body?.innerText ?? "").slice(0, MAX_BODY_TEXT_LENGTH)
  });
});
