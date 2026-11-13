import { FIELD_LABELS, SETTING_FIELDS, type SettingField } from "@camasuvi/readability-lab-core";
import { AUTO_HOSTS_KEY, ext, getAutoHosts, loadOptions, loadProfile, saveOptions, saveProfile } from "./shared.js";

const $ = (id: string) => document.getElementById(id)!;

async function render() {
  const profile = await loadProfile();
  const opts = await loadOptions();
  const needs = $("needs");
  needs.replaceChildren();
  for (const f of SETTING_FIELDS as readonly SettingField[]) {
    const l = document.createElement("label");
    const c = document.createElement("input");
    c.type = "checkbox";
    c.checked = profile.needs.includes(f);
    c.addEventListener("change", async () => {
      const p = await loadProfile();
      const set = new Set(p.needs);
      c.checked ? set.add(f) : set.delete(f);
      await saveProfile({ ...p, needs: [...set] });
      void render();
    });
    l.append(c, ` ${FIELD_LABELS[f]}`);
    needs.append(l);
  }
  const auto: string[] = await getAutoHosts();
  const ul = $("sites");
  ul.replaceChildren();
  const hosts = Object.keys(profile.sites);
  if (!hosts.length) ul.append(Object.assign(document.createElement("li"), { textContent: "No site-specific settings." }));
  for (const h of hosts) {
    const s = profile.sites[h]!;
    const li = document.createElement("li");
    li.textContent = `${h}: ${s.mode === "off" ? "never adjust" : "adjust"}${auto.includes(h) ? ", automatic" : ""}${s.regionSelector ? `, region ${s.regionSelector}` : ""}${Object.keys(s.settings).length ? `, ${Object.keys(s.settings).length} site setting(s)` : ""} `;
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = "Forget";
    b.setAttribute("aria-label", `Forget settings for ${h}`);
    b.addEventListener("click", async () => {
      const p = await loadProfile();
      const sites = { ...p.sites };
      delete sites[h];
      await saveProfile({ ...p, sites });
      await ext.storage.local.set({ [AUTO_HOSTS_KEY]: auto.filter((x) => x !== h) });
      await ext.permissions.remove({ origins: [`https://${h}/*`, `http://${h}/*`] }).catch(() => undefined);
      void render();
    });
    li.append(b);
    ul.append(li);
  }
  ($("share") as HTMLInputElement).checked = opts.shareWithPageControls;
  ($("privacy") as HTMLInputElement).checked = opts.privacy;
  $("profile").textContent = JSON.stringify({ ...profile, sites: `${hosts.length} site(s), kept local` }, null, 2);
}

$("share").addEventListener("change", async (e) => saveOptions({ ...(await loadOptions()), shareWithPageControls: (e.target as HTMLInputElement).checked }));
$("privacy").addEventListener("change", async (e) => saveOptions({ ...(await loadOptions()), privacy: (e.target as HTMLInputElement).checked }));
$("wipe").addEventListener("click", async () => {
  if (!confirm("Delete your reading profile, site list and options from this browser?")) return;
  await ext.storage.local.clear();
  $("status").textContent = "All Readability Lab data deleted.";
  void render();
});
void render();
