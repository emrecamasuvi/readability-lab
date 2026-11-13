# Verification log

All checks were made on 2026-11-12 by `registry-bootstrap-agent`. The tools used
were WebFetch (an HTML/PDF fetch with a model-generated summary), `curl` with
`pdftotext`, the Crossref REST API (`api.crossref.org/works/<doi>`) and the
Europe PMC REST API (search and `fullTextXML`).

The results below mean:

- **confirmed**: the original matched the details used in the claims.
- **discrepancy**: the original differs from the synthesis, or contains results
  the synthesis leaves out.
- **partial**: some details were confirmed and others could not be checked. The
  unchecked details stay marked as secondary in `registry.json`.
- **could not access**: the original could not be reached, so nothing was checked.

A Crossref or Europe PMC abstract counts as the official abstract because the
publisher deposits it. An HTTP 403 from a DOI target or author PDF is recorded as
such.

| Source id | What was checked | URL fetched | Result | Date |
|---|---|---|---|---|
| S-wcag22 | Status and date; levels and wording of 1.3.1, 1.3.2, 1.4.1, 1.4.3, 1.4.4, 1.4.6, 1.4.8, 1.4.10, 1.4.12, 2.1.1, 2.1.2, 2.2.2, 2.3.3, 2.4.7, 2.4.11, 2.4.12; definition of large-scale text | https://www.w3.org/TR/WCAG22/ | confirmed: Recommendation of 12 Dec 2024; all levels as used. The fetch tool read the first ~100k characters, which contain every listed criterion | 2026-11-12 |
| S-wcag22-u-contrast-minimum | 4.5:1, 3:1 for large text; large = 18pt or 14pt bold; px conversion | https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html | confirmed. Minor difference: W3C says 14pt bold ≈ 18.5px, the synthesis says ≈ 18.7px (exact value 18.66px) | 2026-11-12 |
| S-wcag22-u-contrast-enhanced | 7:1, 4.5:1 for large text; ratios not rounded | https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html | confirmed | 2026-11-12 |
| S-wcag22-u-text-spacing | Values 1.5 / 2 / 0.12 / 0.16; no obligation to provide a mechanism or use these as defaults | https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html | confirmed | 2026-11-12 |
| S-wcag22-u-reflow | 320 CSS px wide / 256 CSS px high; 1280px at 400%; exceptions | https://www.w3.org/WAI/WCAG22/Understanding/reflow.html | confirmed | 2026-11-12 |
| S-wcag22-u-resize-text | 200% without assistive technology; exceptions for captions and images of text | https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html | confirmed | 2026-11-12 |
| S-wcag22-u-visual-presentation | User-selected colours; ≤ 80 characters (40 CJK); not justified; space-and-a-half; paragraph spacing ≥ 1.5× line spacing; 200% with no horizontal scrolling | https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html | confirmed | 2026-11-12 |
| S-wcag3-wd-2026 | Maturity and date; whether a contrast algorithm or APCA is adopted; relation to WCAG 2 | https://www.w3.org/TR/wcag3/ (WebFetch, plus a full-page `curl` text search) | confirmed: Working Draft of 10 Sep 2026 (this version: /TR/2026/WD-wcag-3.0-20260910/). The text-contrast requirements say "@@[contrast measure to be determined]" and an editor's note says the algorithm is undecided. "APCA" does not appear anywhere in the page. The draft states it does not replace WCAG 2 | 2026-11-12 |
| S-shaikh-chaparro-2005 | DOI, bibliographic data, abstract | https://doi.org/10.1177/154193120504900514 → SAGE (HTTP 403); https://api.crossref.org/works/10.1177/154193120504900514 | partial: the DOI resolves, and the abstract confirms 20 students, 35/55/75/95 CPL and 95 CPL as fastest. The detailed numbers were checked in the next row | 2026-11-12 |
| S-shaikh-2005-usability-news | WPM means, F, p, η², comprehension, font and spacing | https://researchinuserexperience.wordpress.com/2005/07/13/the-effects-of-line-length-on-reading-online-news/ | confirmed: 167.21/167.38/169.44/178.82 WPM; F(3,57)=3.45, p=.02, η²=.15; no comprehension effect; 10pt Arial with 12pt leading. The "6.8%" figure is derived, not stated in the article | 2026-11-12 |
| S-dyson-haselgrove-2001 | Bibliographic identity; study details | Crossref bibliographic search; https://www.sciencedirect.com/science/article/pii/S1071581901904586 (HTTP 403); the synthesis's link https://journals.uc.edu/index.php/vl/article/view/5671 | could not access the original. **Discrepancy:** the link given in the synthesis is a different paper (Dyson & Kipping 1998). DOI 10.1006/ijhc.2001.0458 was identified through Crossref | 2026-11-12 |
| S-dyson-kipping-1998 | Title, authors, journal, abstract | https://journals.uc.edu/index.php/vl/article/view/5671 | partial: 25/55/100 CPL; 100 read faster than 25; similar comprehension; 55 rated easiest. Sample sizes (48/24) are not stated on the landing page | 2026-11-12 |
| S-bernard-2002 | n, CPL, font, display, reading times, p, preferences | https://researchinuserexperience.wordpress.com/2002/07/11/the-effects-of-line-length-on-children-and-adults-online-reading-performance/ | confirmed for all numbers used. **Discrepancy:** the synthesis gives the year as 2003, but the article is Usability News 4.2 (July 2002) | 2026-11-12 |
| S-baymard-2022 | Recommended range; type of evidence; any quantified 80→65 effect | https://baymard.com/research-articles/line-length-readability | confirmed: 50–75 CPL based on qualitative usability observation; no reading-speed figures; 65 CPL is not mentioned | 2026-11-12 |
| S-rello-2016 | n, display, distance, units, spacing definition, fixation results, p=.978, 224→208 ms | https://doi.org/10.1145/2858036.2858204 → ACM (HTTP 403); Crossref; https://www.pielot.org/pubs/Rello2016-Fontsize.pdf | confirmed: 104/93; 17-inch 1024×768 display at ~60 cm; pt units; 1.0 = Firefox default = 120% of font size; F(3,89)=0.064, p=.978; .224 s → .208 s. **Discrepancy (omission):** spacing significantly affected comprehension (0.8 lower than the other levels, χ²(3)=19.56, p<.001), and 10/12 pt gave lower comprehension than 18 pt. Neither result appears in the synthesis | 2026-11-12 |
| S-chiu-drieghe-2023 | Experiment 2: n, font, display, FFD, TVT, undersweeps, p-values | https://doi.org/10.3758/s13414-023-02787-1 → Springer (login redirect); Crossref; Europe PMC fullTextXML PMC10600290 | confirmed: 36 participants; 19pt Inconsolata; 20-inch display at 65 cm; 230.11→227.74 ms, p=.032; TVT p=.187; undersweeps 36.48%→39.78%, p=.01. Note: TVT is a word-level measure | 2026-11-12 |
| S-legge-bigelow-2011 | Fluent range 0.2°–2° of x-height | Author PDF (HTTP 403 for both WebFetch and curl); Crossref; Europe PMC abstract (PMID 21828237) | partial: the 0.2°–2° range was confirmed in the abstract. Full text not read | 2026-11-12 |
| S-wallace-2022 | 500/352; 16 fonts; normalisation; 314/232/275 WPM; 35%; 20% | https://doi.org/10.1145/3502222 → ACM (HTTP 403); Crossref abstract; https://jeffhuang.com/papers/Readability_TOCHI22.pdf | confirmed | 2026-11-12 |
| S-rudnay-2026 | Date, n, language, x-height matching, null result | https://link.springer.com/article/10.1007/s44402-026-00199-w (login redirect); Crossref abstract | partial: 27 Oct 2026, n=63, native German speakers, x-height-matched printed charts, all reading-speed p > 0.40. The figures 0.124 WPM, CI −1.980 to 2.246 and p=.91 are not in the abstract and were not confirmed. The journal name in Crossref was not resolved | 2026-11-12 |
| S-cai-2022 | n, number of fonts, size, WPM gains | Crossref search; https://research.adobe.com/publication/personalized-font-recommendations-combining-ml-and-typographic-guidelines-to-optimize-readability/ | partial: 252 participants, 8 fonts, 14–25 WPM over defaults. Not confirmed: 16px, 14.4/14.8 WPM vs Georgia/Arial, and apparent size not being equalised | 2026-11-12 |
| S-beier-oderkerk-2019 | Sample sizes; findings on weight extremes | https://typ.dk/wp-content/uploads/2023/07/2019ActaPsych-BeierOderkerk.pdf | confirmed: Exp. 1 n=21 and Exp. 2 n=15 (these are the "21 and 15" in the synthesis); thin and extreme-bold weights reduce recognition at all sizes; CC BY-NC-ND | 2026-11-12 |
| S-minakata-beier-2021 | Identity; n=25; four Univers widths; reading speed | Crossref search; Europe PMC abstract (PMID 34225106) | partial: n=25, four widths, eye-movement changes, no reading-speed difference. "No comprehension difference" is not in the abstract | 2026-11-12 |
| S-zorzi-2012 | Follow-up n, medium, line-spacing control, 1.87/1.64, 6/11.8, p-values | https://pmc.ncbi.nlm.nih.gov/articles/PMC3396504/ | confirmed (also session 2: 2.07 vs 1.72 syllables/s; 4.95 vs 13.5 errors) | 2026-11-12 |
| S-galliussi-2020 | n, language, 4.10/3.96/4.11, t, p, d | Crossref abstract; Europe PMC fullTextXML PMC7188700 | confirmed | 2026-11-12 |
| S-kuster-2018 | n=170 and n=147; results | Crossref; Europe PMC fullTextXML PMC5934461 | **discrepancy (clarification):** the second sample was 102 children with dyslexia and 45 without, reading word lists. All other details confirmed | 2026-11-12 |
| S-schneps-2013 | n=27; 27% gaze-derived rate; page turns; ceiling; licence | Crossref; Europe PMC fullTextXML PMC3734020 | confirmed. The licence is CC0, not CC BY | 2026-11-12 |
| S-palmen-2023 | 459/333; Android; 14px Roboto Flex; F=12.8; partial η²=.038; preferences | https://thereadabilityconsortium.org/wp-content/uploads/2023/07/How-bold-can-we-be-The-impact-of-adjusting-font-grade-on-readability-in-light-and-dark-polarities-1.pdf; Crossref (DOI 10.1145/3544548.3581552) | confirmed. Minor difference: preferences were 34% light, 36% dark and 25% switching, not exact thirds | 2026-11-12 |
| S-piepenbrock-2013 | n=169; German; 10pt Helvetica; 50 cm; η²=.06; reading rate p=.69 | University-hosted PDF linked by the synthesis; Crossref; Europe PMC abstract | confirmed | 2026-11-12 |
| S-piepenbrock-2014 | n=160; glare 1.97 vs 1.68; d=.32; 4-point scale | University-hosted accepted manuscript linked by the synthesis; Crossref; Europe PMC abstract (PMID 25141597) | **discrepancy (omission):** the same table shows dark mode rated as more blurry (2.08 vs 1.44, d=−0.74) and as harder for line jumps (p=.048). The p-values appear one-sided. All other details confirmed. These figures are from the accepted manuscript, not the version of record | 2026-11-12 |
| S-rello-bigham-2017 | n=341 (89 with dyslexia); 10 backgrounds; 18pt Arial; white not tested | https://www.cs.cmu.edu/~jbigham/pubs/pdfs/2017/colors.pdf | confirmed (participants were Spanish native speakers; outcomes were reading time and mouse distance) | 2026-11-12 |
| S-rubin-legge-1989 | 19 low-vision observers; 5 faster with reversed polarity; 4 with cloudy media | Author PDF (HTTP 403); Crossref; Europe PMC abstract (PMID 2788957) | confirmed at abstract level | 2026-11-12 |
| S-wang-2024 | n=44; Chinese; corrective saccades 45%→33%; reading time and comprehension | Crossref abstract; Europe PMC fullTextXML PMC11147972 | confirmed. The exact p-value for the column effect was not located in the extracted text | 2026-11-12 |
| S-nngroup-1998 | 159%; n=21; nature of the changes | https://www.nngroup.com/articles/applying-writing-guidelines-web-pages/ | confirmed: Morkes & Nielsen, 6 Jan 1998. The rewrite bundled several changes, with no typography-only condition | 2026-11-12 |
| S-haverkamp-2022 | Design; direction of effects | Crossref abstract | partial: smartphone/tablet × scroll/page design, Norwegian students, paging tended to be better. Not confirmed: n=145, 9.06 vs 7.86, p=.066 | 2026-11-12 |
| S-krenca-2024 | n=75; conditions; direction of effects | Crossref abstract | partial: confirmed. Not confirmed: 74% vs 67%, p=.007, d=.30 | 2026-11-12 |
| S-vatany-2026 | n=80; outcomes; DOI | https://www.journals.uc.edu/index.php/vl/article/view/8818; Crossref | partial: n=80; no speed or comprehension effects; higher perceived attention. Not confirmed: laptop, 16px, 1.5, 70–80 CPL | 2026-11-12 |
| S-navas-leon-dunabeitia-2026 | n=24; formats; 1.5 spacing; E2R vs control after correction | Europe PMC abstract and fullTextXML PMC13296324; Crossref | confirmed: E2R vs control p=.077 (Bonferroni); all formats used 1.5 line spacing | 2026-11-12 |
| S-spear-2025 | Partial-word bolding costs; preregistration | Crossref; Europe PMC abstract (PMID 40240742) | partial: costs relative to unbolded text confirmed. Preregistration is not stated in the abstract | 2026-11-12 |
| S-segui-2015-cvsq | Workplace validation context | Europe PMC abstract (PMID 25744132); Crossref | confirmed | 2026-11-12 |
| S-synthesis-2026 | — | not public (local attachment; the private chat-service link to the full report was not followed or recorded) | could not access the full 44-reference report | 2026-11-12 |

## Not identified

- The October 2026 EFL study of partial-word bolding cited by the synthesis. There
  was no link or citation for it (`GAP-003`).

## Totals

- Sources: 40. Of these, 8 are `verified-normative`, 18 `verified-full-text`,
  12 `verified-abstract` and 2 `unverified-secondary` (Dyson & Haselgrove 2001 and
  the synthesis).
- Fetches: about 25 WebFetch calls. Batch API lookups (Crossref, Europe PMC) and
  PDF downloads were made with `curl`.
