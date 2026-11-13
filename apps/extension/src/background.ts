import { resolvePresentation, getPreset } from "@emrecamasuvi/readability-lab-core";
import { AUTO_HOSTS_KEY, ext, getAutoHosts, hostOf, loadProfile } from "./shared.js";
import { send } from "./tabs.js";

const AUTO_ID = "rl-auto";

/** Register the content script for sites the reader set to apply automatically (and granted). */
async function syncAutoScripts() {
  const hosts: string[] = await getAutoHosts();
  const matches: string[] = [];
  for (const h of hosts) {
    for (const scheme of ["https", "http"]) {
      const pattern = `${scheme}://${h}/*`;
      if (await ext.permissions.contains({ origins: [pattern] })) matches.push(pattern);
    }
  }
  try {
    await ext.scripting.unregisterContentScripts({ ids: [AUTO_ID] });
  } catch {
    /* not registered */
  }
  if (matches.length) await ext.scripting.registerContentScripts([{ id: AUTO_ID, matches, js: ["content.js"], runAt: "document_idle", persistAcrossSessions: true }]);
}

ext.runtime.onInstalled.addListener(() => void syncAutoScripts());
ext.runtime.onStartup?.addListener(() => void syncAutoScripts());
ext.storage.onChanged.addListener((changes) => {
  if (AUTO_HOSTS_KEY in changes) void syncAutoScripts();
});
ext.permissions.onRemoved?.addListener(() => void syncAutoScripts());

ext.commands.onCommand.addListener(async (command, tab) => {
  const t = tab ?? (await ext.tabs.query({ active: true, currentWindow: true }))[0];
  if (!t?.id) return;
  const profile = await loadProfile();
  const host = hostOf(t.url);
  const r = resolvePresentation({ profile, host });
  const status0 = await send<{ applied: boolean }>(t.id, { type: "status" });
  // "Never adjust this site": shortcuts may only turn things off.
  if (!r.readerEnabled) {
    if (status0.applied || command === "toggle-reader") await send(t.id, { type: command === "toggle-reader" ? "reader" : "reset", open: false, settings: {} } as never);
    return;
  }
  const settings = Object.keys(r.settings).length ? r.settings : { ...getPreset("balanced")!.settings };
  const status = await send<{ applied: boolean; showingOriginal: boolean; readerOpen: boolean }>(t.id, { type: "status" });
  if (command === "toggle-styles") {
    if (status.applied) await send(t.id, { type: "reset" });
    else await send(t.id, { type: "apply", settings, regionSelector: host ? profile.sites[host]?.regionSelector ?? null : null });
  } else if (command === "toggle-reader") {
    await send(t.id, { type: "reader", settings });
  } else if (command === "compare") {
    await send(t.id, { type: "compare" });
  }
});
