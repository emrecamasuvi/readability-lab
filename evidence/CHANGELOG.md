# Evidence registry changelog

## 2026.11.0 — 2026-11-12

Initial bootstrap of `evidence/registry.json`.

### Input

- A secondary synthesis, "Evidence-based typography for sustained digital reading"
  (research cutoff 11 Nov 2026), available only as a text summary with about 30
  linked sources. The full report (44 references, detailed tables) was **not**
  available, so about 14 references and its detailed assessments are missing
  (see `GAP-001`).
- Tracking query parameters added by the chat tool that produced the synthesis
  were removed from all URLs. Its private file link to the full report was not
  included. DOI URLs are used wherever
  a DOI could be identified.

### Extracted

- **40 sources**: 1 secondary synthesis, 8 W3C documents (WCAG 2.2
  Recommendation, 6 Understanding pages, WCAG 3.0 Working Draft), 27 journal
  articles, conference papers and reviews, and 4 industry or lab articles
  (Usability News ×2, Baymard, NN/G).
- **69 claims**: 13 normative, 30 empirical, 20 heuristic, 6 hypothesis. All 62
  required claim IDs are present. Seven extra claims were added:
  `C-ADAPT-002`, `C-CPL-008`, `C-LH-005`, `C-SIZE-004`, `C-WCAG-008`,
  `C-WCAG-009`, `C-METH-003`.
- **7 claims** carry `noReliableQuantitativeImprovement: true` and the exact
  sentence "No reliable quantitative improvement established.":
  `C-BASE-003`, `C-CPL-006`, `C-LH-003`, `C-SIZE-002`, `C-FONT-004`,
  `C-CONTRAST-003`, `C-THEME-004`.
- Contrary findings are linked symmetrically with `conflictsWith`:
  Shaikh & Chaparro vs Dyson & Haselgrove (`C-CPL-001` / `C-CPL-002`),
  Zorzi vs Galliussi (`C-SPACE-001` / `C-SPACE-002`), and Palmén and
  Piepenbrock 2013 vs Rubin & Legge (`C-THEME-001`, `C-THEME-002` / `C-THEME-005`).
- **11 gaps** recorded (`GAP-001` … `GAP-011`).
- All summaries are original wording. Bibliographic data and numbers come from the
  synthesis or from originals that were checked. Statistics that were not available
  have `value: null` with a `missingReason`.

### Verified (2026-11-12)

- **W3C (8 sources, `verified-normative`)**: WCAG 2.2 Recommendation (12 Dec
  2024) and the Understanding pages for 1.4.3, 1.4.4, 1.4.6, 1.4.8, 1.4.10 and
  1.4.12. All thresholds used in claims were confirmed. WCAG 3.0 is a Working
  Draft dated 10 Sep 2026. Its contrast measure is "to be determined", APCA is not
  mentioned in it, and it states that it does not replace WCAG 2. The WCAG claims
  (`C-CONTRAST-001/002/004`, `C-WCAG-001`…`009`, `C-APCA-001`) are marked
  `reviewed`.
- **Primary studies**: 18 checked against full text and 12 against official
  abstracts or landing pages. See `VERIFICATION.md`.
- **Not verified (`unverified-secondary`)**: Dyson & Haselgrove (2001) and the
  synthesis itself.

### Discrepancies found between the synthesis and the originals

1. The synthesis links Dyson & Haselgrove (2001) to a Visible Language page that is
   actually **Dyson & Kipping (1998)**. Both are now separate sources, and
   Dyson & Haselgrove remains unverified.
2. **Bernard et al.** is dated 2003 in the synthesis. The linked article is
   Usability News 4.2, **July 2002**.
3. **Rello, Pielot & Marcos 2016**: the synthesis leaves out that line spacing
   significantly affected comprehension. The tightest spacing (0.8× default) scored
   lower than 1.0, 1.4 and 1.8. It also leaves out that comprehension was lower at
   10 and 12 pt than at 18 pt. These findings were added as `C-LH-005` and
   `C-SIZE-004`. The synthesis's conversion to 0.96/1.20/1.68/2.16 is correct,
   because the paper states that the default equals 120% of font size.
4. **Piepenbrock et al. 2014**: the synthesis reports only that light mode was
   rated as more glaring. The same table shows dark mode rated as much more
   **blurry** (2.08 vs 1.44, d = −0.74) and as harder for jumping to the next line.
   The reported p-values appear one-sided (t = 2.00, df = 157 gives a two-sided
   p of about .047, but .024 was reported).
5. **Kuster et al. 2018**: the "second sample of 147 children" was 102 children
   with dyslexia and 45 without, reading word lists.
6. **Chiu & Drieghe 2023**: "total viewing duration" (p = .187) is a word-level
   eye-movement measure, not whole-passage reading time.
7. **Palmén et al. 2023**: the preferences were 34% light, 36% dark and 25%
   switching modes. The synthesis rounds these to thirds.
8. **Large-text px equivalent**: W3C gives about 18.5px for 14pt bold, and the
   synthesis gives 18.7px. The exact value is 18.66px.
9. **Beier & Oderkerk**: the "samples of 21 and 15" are the two experiments of a
   single 2019 paper.
10. **Schneps et al. 2013** is licensed CC0, not CC BY.
