/**
 * The member's own Chrome, Chromium or Edge, opened on a profile of its own and driven over the
 * DevTools Protocol with nothing but Node's WebSocket — no Playwright, no automation flag, so the
 * browser is the ordinary one Imperva already lets in. Used by `login --browser`: the member signs
 * in by hand in this window; the CLI only watches the page and reads the cookies afterwards.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

export const BROWSERS = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/microsoft-edge",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].filter((p): p is string => Boolean(p));

export function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

const REPLY_MS = 30_000;
/** Signals on which the CLI closes the browser it opened before going (the browser is in a process group of its own). */
const SIGNALS: { signal: NodeJS.Signals; code: number }[] = [
  { signal: "SIGINT", code: 130 },
  { signal: "SIGTERM", code: 143 },
  { signal: "SIGHUP", code: 129 },
];

type Params = Record<string, unknown>;
type Handler = (params: Params, sessionId?: string) => void;

export interface BrowserPage {
  /** A protocol command on the page's session (or the browser's when `browser` is true). */
  send(method: string, params?: Params, opts?: { browser?: boolean; timeoutMs?: number }): Promise<Params>;
  /** Subscribes to a protocol event (enable its domain first); returns the unsubscribe. */
  on(method: string, handler: Handler): () => void;
  /** Evaluates an expression in the page; a page between documents throws. */
  evaluate<T>(expression: string): Promise<T>;
  navigate(url: string): Promise<void>;
  sessionId: string;
  /** The browser's process id. */
  pid: number | undefined;
  /** Closes the browser. */
  close(): void;
  /**
   * Lets the browser outlive the CLI (`--keep-open`): drops the DevTools socket, the exit and signal
   * hooks that would close the window, and the browser's stderr pipe, and stops holding the process
   * open on the browser's account — so the CLI exits as usual and the window stays until closed by hand.
   */
  detach(): void;
}

export function defaultProfileDir(configDir: string): string {
  return join(configDir, "browser-profile");
}

/**
 * Opens the browser on `startUrl` with `profileDir` as its profile and attaches to the page.
 * `extraArgs` (CLALIT_BROWSER_ARGS, space-separated) go to the browser as given — a test's --headless=new.
 *
 * The browser is started in a process group of its own (except on Windows), so a Ctrl-C in the
 * terminal reaches only the CLI, which then closes the browser itself — unless `detach()` was called.
 * Only its stderr is piped (for the DevTools address); if attaching fails, the browser is closed again.
 */
export async function openBrowser(startUrl: string, profileDir: string, extraArgs: string[] = (process.env.CLALIT_BROWSER_ARGS ?? "").split(" ").filter(Boolean)): Promise<BrowserPage> {
  if (typeof WebSocket === "undefined") {
    throw new Error("login --browser needs Node 22 or newer (its WebSocket).");
  }
  const exe = BROWSERS.find(isFile);
  if (!exe) throw new Error("No Chrome, Chromium or Edge found; set CHROME_PATH to the browser's executable.");
  mkdirSync(profileDir, { recursive: true, mode: 0o700 });
  const browser: ChildProcess = spawn(
    exe,
    [
      "--remote-debugging-port=0",
      "--user-data-dir=" + profileDir,
      "--no-first-run",
      "--no-default-browser-check",
      "--window-size=1100,900",
      ...extraArgs,
      startUrl,
    ],
    { detached: process.platform !== "win32", stdio: ["ignore", "ignore", "pipe"] },
  );
  let done = false;
  const forget = (): void => {
    process.off("exit", close);
    for (const { signal } of SIGNALS) process.off(signal, onSignal);
  };
  const close = (): void => {
    if (done) return;
    done = true;
    forget();
    browser.stderr?.destroy();
    browser.kill();
  };
  const detach = (): void => {
    if (done) return;
    done = true;
    forget();
    browser.stderr?.destroy();
    browser.unref();
  };
  const onSignal = (signal: NodeJS.Signals): void => {
    close();
    process.exit(SIGNALS.find((s) => s.signal === signal)?.code ?? 1);
  };
  process.once("exit", close);
  for (const { signal } of SIGNALS) process.on(signal, onSignal);

  try {
    return await attach(browser, startUrl, profileDir, close, detach);
  } catch (err) {
    close();
    throw err;
  }
}

async function attach(browser: ChildProcess, startUrl: string, profileDir: string, close: () => void, detach: () => void): Promise<BrowserPage> {
  const wsUrl = await new Promise<string>((resolve, reject) => {
    let log = "";
    let found = false;
    const timer = setTimeout(
      () => reject(new Error(`The browser did not start. Is a window on ${profileDir} already open? Close it and run again.\n${log}`)),
      30_000,
    );
    // The pipe is drained for as long as it is open; the log is kept only until the address is found.
    browser.stderr?.on("data", (d: Buffer) => {
      if (found) return;
      log += d.toString();
      const m = log.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        found = true;
        clearTimeout(timer);
        resolve(m[1]!);
      }
    });
    browser.once("exit", () => {
      clearTimeout(timer);
      reject(new Error("The browser exited before it could be reached.\n" + log));
    });
  });

  const ws = new WebSocket(wsUrl);
  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new Error("Could not connect to the browser's DevTools socket."));
  });
  let lastId = 0;
  const pending = new Map<number, { resolve: (v: Params) => void; reject: (e: Error) => void }>();
  const listeners = new Map<string, Set<Handler>>();
  ws.onmessage = (e: MessageEvent) => {
    const m = JSON.parse(String(e.data)) as { id?: number; method?: string; params?: Params; sessionId?: string; error?: { message: string }; result?: Params };
    if (m.method) {
      for (const f of listeners.get(m.method) ?? []) f(m.params ?? {}, m.sessionId);
      return;
    }
    const p = m.id !== undefined ? pending.get(m.id) : undefined;
    if (!p || m.id === undefined) return;
    pending.delete(m.id);
    if (m.error) p.reject(new Error(m.error.message));
    else p.resolve(m.result ?? {});
  };
  ws.onclose = () => {
    for (const p of pending.values()) p.reject(new Error("The browser's DevTools socket closed."));
    pending.clear();
  };
  const raw = (method: string, params: Params = {}, sessionId?: string, timeoutMs = REPLY_MS): Promise<Params> => {
    const id = ++lastId;
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise<Params>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method}: no reply in ${timeoutMs / 1000} s`));
      }, timeoutMs);
      pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
    });
  };

  // The first page target, once the browser has one on `startUrl`.
  let target: { targetId: string } | undefined;
  for (let i = 0; !target; i += 1) {
    const { targetInfos } = (await raw("Target.getTargets")) as { targetInfos: { type: string; url: string; targetId: string }[] };
    target = targetInfos.find((t) => t.type === "page" && t.url.startsWith(startUrl)) ?? (i > 20 ? targetInfos.find((t) => t.type === "page") : undefined);
    if (!target) await new Promise((r) => setTimeout(r, 500));
  }
  const { sessionId } = (await raw("Target.attachToTarget", { targetId: target.targetId, flatten: true })) as { sessionId: string };

  const closeSocket = (): void => {
    try {
      ws.close();
    } catch {
      /* closing anyway */
    }
  };
  const page: BrowserPage = {
    send: (method, params = {}, opts = {}) => raw(method, params, opts.browser ? undefined : sessionId, opts.timeoutMs),
    on(method, handler) {
      if (!listeners.has(method)) listeners.set(method, new Set());
      listeners.get(method)!.add(handler);
      return () => listeners.get(method)!.delete(handler);
    },
    async evaluate<T>(expression: string): Promise<T> {
      const { result, exceptionDetails } = (await raw("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId)) as {
        result: { value: T };
        exceptionDetails?: { text: string; exception?: { description?: string } };
      };
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
      return result.value;
    },
    async navigate(url) {
      await raw("Page.navigate", { url }, sessionId);
    },
    sessionId,
    pid: browser.pid,
    close() {
      closeSocket();
      close();
    },
    detach() {
      closeSocket();
      detach();
    },
  };
  return page;
}
