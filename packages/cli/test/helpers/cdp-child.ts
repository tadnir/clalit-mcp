/**
 * Run by cdp.test.ts in a Node of its own: opens a headless browser on the given profile, prints
 * its pid, then either closes it or detaches from it — and must exit on its own either way.
 */
import { openBrowser } from "../../src/cdp.js";

const [profileDir, mode] = process.argv.slice(2);
const page = await openBrowser("about:blank", profileDir!, ["--headless=new"]);
process.stdout.write(`pid ${page.pid}\n`);
if (mode === "detach") page.detach();
else page.close();
