import { ext, type Msg } from "./shared.js";

/** Inject the content script if needed (activeTab or granted host permission), then message it. */
export async function send<T = unknown>(tabId: number, msg: Msg): Promise<T> {
  const trySend = async () => (await ext.tabs.sendMessage(tabId, msg)) as { ok: boolean; result?: T; error?: string } | undefined;
  let res: Awaited<ReturnType<typeof trySend>> | undefined;
  try {
    res = await trySend();
  } catch {
    res = undefined;
  }
  if (!res) {
    await ext.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    res = await trySend();
  }
  if (!res?.ok) throw new Error(res?.error ?? "No response from the page");
  return res.result as T;
}

export async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const forced = new URLSearchParams(location.search).get("tabId");
  if (forced) return ext.tabs.get(Number(forced));
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  return tab;
}
