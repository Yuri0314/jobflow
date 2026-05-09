export type AutomationPage = {
  url: string;
  html: string;
};

export type AutomationPageSession = {
  open(url: string): Promise<AutomationPage>;
};

export const fetchPageSession: AutomationPageSession = {
  async open(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Could not open page ${url}: ${response.status}`);
    }

    return {
      url: response.url || url,
      html: await response.text()
    };
  }
};
