#!/usr/bin/env node
import { main } from "../dist/cli.js";
main(process.argv.slice(2)).then((code) => process.exit(code ?? 0), (err) => {
  // Usage and validation errors exit 2; operational failures (browser, navigation) carry exitCode 3.
  console.error(err?.exitCode ? `Error: ${err.message}` : (err?.stack ?? String(err)));
  process.exit(err?.exitCode ?? 2);
});
