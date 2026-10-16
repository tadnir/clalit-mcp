import { PATHS, PORTAL_ORIGIN } from "./constants.js";
import { ReauthenticationRequired } from "./errors.js";
import { ClalitAuth, type LoginOptions, type LoginPrompts } from "./auth.js";
import { ClalitReaders } from "./readers.js";
import type { ClalitSession } from "./session.js";
import { ClalitTransport } from "./transport.js";

export type ClalitClient = ClalitReaders & {
  exportSession(): Promise<ClalitSession>;
  refreshSession(): Promise<void>;
  /**
   * Opens the labs list, a page only a signed-in session gets, and throws
   * ReauthenticationRequired when the portal sends it to sign-in instead.
   */
  checkSession(): Promise<void>;
};

function wrapClient(transport: ClalitTransport, auth: ClalitAuth): ClalitClient {
  const readers = new ClalitReaders(transport);
  return Object.assign(readers, {
    exportSession: () => transport.exportSession(),
    refreshSession: () => auth.refreshSession(),
    checkSession: async () => {
      const res = await transport.request(PORTAL_ORIGIN + PATHS.labsList);
      await res.arrayBuffer();
      if (!res.ok) throw new ReauthenticationRequired(res.status);
    },
  });
}

async function open(session: ClalitSession): Promise<ClalitClient> {
  const transport = new ClalitTransport({ session });
  // Cookie restore runs on the transport queue; wait before handing out a client
  // so exportSession / reads never observe a half-restored jar.
  await transport.whenReady();
  const auth = new ClalitAuth(transport);
  return wrapClient(transport, auth);
}

/** Interactive CAPTCHA + SMS OTP login on the caller's machine. */
export async function login(
  idNumber: string,
  prompts: LoginPrompts,
  options: LoginOptions = {},
): Promise<ClalitClient> {
  // Keep the authenticated transport — avoid serialize→deserialize round-trip
  // that raced with async cookie restore and truncated session.json.
  const transport = new ClalitTransport();
  const auth = new ClalitAuth(transport);
  await auth.loginInteractive(idNumber, prompts, options);
  return wrapClient(transport, auth);
}

/** Opens a session previously returned by `client.exportSession()`. */
export function connect(session: ClalitSession): Promise<ClalitClient> {
  return open(session);
}
