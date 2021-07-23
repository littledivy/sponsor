export type BrowserIdentifier = "chrome" | "firefox";

export interface BrowseOptions {
  url?: string;
  browser: BrowserIdentifier;
  browserPath?: string;
  browserArgs?: string[];
  headless?: boolean;
  driver?: string;
}

export async function browse(options: BrowseOptions): Promise<Function> {
  const cmd = options.driver ? [options.driver] : [
    browserPath(options),
    ...browserArgs(options),
  ];

  const handle = Deno.run({
    cmd,
    stdout: "null",
    stderr: "null",
  });

  let sessionId = "";
  // https://www.w3.org/TR/webdriver/#new-session
  if (options.driver) {
    const response = await fetch("http://localhost:4444/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        capabilities: {
          alwaysMatch: {
            // Tell Chrome's webdriver to follow W3C spec
            "goog:chromeOptions": {
              w3c: true,
            },
          },
        },
      }),
    });

    const { value } = await response.json();
    if (!value) {
      throw new TypeError("WebDriver session could not start");
    }
    sessionId = value.sessionId;
    // https://www.w3.org/TR/webdriver/#navigate-to
    if (options.url) {
      // Don't await!
      fetch(`http://localhost:4444/session/${sessionId}/url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: options.url,
        }),
      });
    }
  }

  return async () => {
    // TODO(littledivy): Should we close the session too?
    if (options.driver) {
      setTimeout(() => handle.close(), 100);
      // https://www.w3.org/TR/webdriver/#close-window
      // Don't await. This blocks forever (on geckodriver).
      fetch(`http://localhost:4444/session/${sessionId}/window`, {
        method: "DELETE",
      }).catch(() => {
        // Ignore error. Probably caused because driver process exited.
      });
    } else {
      handle.close();
    }
  };
}

function browserPath(options: BrowseOptions): string {
  switch (options.browser) {
    case "chrome":
      return chromePath(options);

    case "firefox":
      return firefoxPath(options);
  }
}

function browserArgs(options: BrowseOptions): string[] {
  switch (options.browser) {
    case "chrome":
      return chromeArgs(options);

    case "firefox":
      return firefoxArgs(options);
  }
}

function chromePath(options: BrowseOptions): string {
  if (options.browserPath) {
    return options.browserPath;
  }

  switch (Deno.build.os) {
    case "darwin":
      return "/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome";

    case "linux":
      return "/usr/bin/google-chrome";

    case "windows":
      return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  }
}

function chromeArgs(options: BrowseOptions): string[] {
  const args = [];

  args.push(
    "--disable-features=TranslateUI",
    "--disable-extensions",
    "--disable-component-extensions-with-background-pages",
    "--disable-background-networking",
    "--disable-sync",
    "--metrics-recording-only",
    "--disable-default-apps",
    "--mute-audio",
    "--no-default-browser-check",
    "--no-first-run",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-background-timer-throttling",
    "--force-fieldtrials=*BackgroundTracing/default/",
  );

  if (options.headless) {
    args.push(
      "--headless",
      "--remote-debugging-port=9292",
    );
  }

  if (options.url) {
    args.push(options.url);
  }

  return args;
}

function firefoxPath(options: BrowseOptions): string {
  if (options.browserPath) {
    return options.browserPath;
  }

  switch (Deno.build.os) {
    case "darwin":
      return "/Applications/Firefox.app/Contents/MacOS/firefox";

    case "linux":
      return "/usr/bin/firefox";

    case "windows":
      return "C:\\Program Files\\Mozilla Firefox\\firefox.exe";
  }
}

function firefoxArgs(options: BrowseOptions): string[] {
  const args = [];

  if (options.headless) {
    args.push(
      "--headless",
    );
  }

  if (options.url) {
    args.push(options.url);
  }

  return args;
}
