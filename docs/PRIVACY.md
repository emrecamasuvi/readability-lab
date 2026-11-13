# Privacy

Readability Lab is designed so that core reading features never send reading content anywhere.

| Surface | What stays local | Network |
|---|---|---|
| Extension | Profile, per-site preferences and options live in `storage.local`. Inspection and reader view run in the page. | The extension sends nothing. Extension pages use CSP `connect-src 'none'`, and no remote code is loaded. Reader view copies same-origin images the page has already decoded from memory, as data URLs. Cross-origin, unloaded or lazy images, video and audio become links, so opening reader view makes no new requests. An e2e test covers this, including a `Cache-Control: no-store` image. Links you click navigate as usual. |
| Workbench | Pasted text and local files are sanitized: scripts, forms, form controls, frames and media are removed. They render in sandboxed previews (`allow-same-origin allow-scripts` only, so no forms, popups or top-level navigation) with CSP `default-src 'none'; form-action 'none'`. Preferences are kept in `localStorage`. | Static assets from the same origin only. Share links contain settings, toggles and a sample id, never pasted or local content. An e2e test checks that a pasted form cannot submit. |
| Controls | The profile lives in the publisher page's `localStorage`. | None. The component makes no requests except an optional `recipe-src` that the publisher sets. |
| CLI / MCP | Reports, screenshots and calibration are written to local files. | Only the pages you ask it to open. No telemetry. |

**Sharing**
- Saved profile files and share codes contain settings only. The extension's export drops the site list unless you choose otherwise in code.
- The extension does not send your profile to page-embedded controls unless you enable that option, because pages could use your settings to recognise you. When enabled, a page receives only the settings that apply on that site: no site list, no region selectors, no stable identifier and no timestamps. An e2e test covers this.

**Personal experiments:** results stay in the browser unless you export them. Nothing is uploaded and nothing is used to infer a diagnosis.

**Reports:** text samples (80 characters per element) are omitted in privacy mode. Privacy mode is the default in the extension and the MCP server, and `--privacy` turns it on in the CLI.
