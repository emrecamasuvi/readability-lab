#!/usr/bin/env node
import { main } from "../dist/server.js";
main().catch((err) => {
  console.error(err?.stack ?? String(err));
  process.exit(1);
});
