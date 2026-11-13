// Generates the static fixture pages from shared original text.
// Text in this directory was written for Readability Lab. License: CC BY 4.0.
// Run: node fixtures/generate.mjs  (outputs are committed so tests do not depend on this script)
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const PARAS = [
  "Most of what we read now arrives in a rectangle of light. The rectangle changes size from one moment to the next: a phone held in one hand on a train, a laptop balanced on a kitchen table, a large monitor at work. Text has to survive all of these, and the people reading it bring their own eyes, habits, and patience to each one.",
  "Typographers have argued about line length for longer than screens have existed. A line that is too short forces the eye back to the left margin so often that the rhythm of a sentence breaks apart. A line that is too long makes the return journey difficult, and readers sometimes land on the wrong line and have to search for their place.",
  "That uncertainty is not a failure of research. Experiments measure different things. One study times how long people take to read a short news item; another asks questions afterwards to see what they understood; a third simply asks which version they liked. These outcomes do not always agree.",
  "Line spacing has a similar story. Extra space between lines can make each line easier to pick out, but it also spreads a paragraph over more of the screen, which means more scrolling and fewer lines visible at once. Whether that trade is worth making depends on the text, the reader, and the size of the type.",
  "Size matters too, though not in the way a number in a style sheet suggests. Two fonts set at the same nominal size can look quite different, because one has tall lowercase letters and the other short ones. What the reader actually sees depends on the shape of the letters, the distance to the screen, and how well the display draws thin strokes.",
  "All of this points toward a modest conclusion. Start from a sensible default, make it easy for each reader to change, and check the result in a real browser rather than trusting a specification. The goal is not to find the perfect page, but to make sure nobody is stuck with a page that does not work for them.",
];
const LICENSE = "<!-- Original text written for Readability Lab fixtures. License: CC BY 4.0. -->";

function page({ title, lang = "en", dir = "ltr", css, body }) {
  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${LICENSE}
<style>
${css.trim()}
</style>
</head>
<body>
${body.trim()}
</body>
</html>
`;
}

const files = {};

/* Scenario 5: heuristic deviations only (wide, small, tight; contrast passes AA). */
files["wide-measure.html"] = page({
  title: "Fixture: wide measure (heuristic deviations only)",
  css: `
body { margin: 0; background: #fff; color: #595959; font-family: Arial, Helvetica, sans-serif; }
main { padding: 24px 40px; font-size: 14px; line-height: 1.2; }
main p { margin: 0 0 4px; max-width: none; }
h1 { font-size: 24px; color: #222; }`,
  body: `<main><h1>Notes on reading surfaces</h1>${PARAS.map((p) => `<p>${p} ${p}</p>`).join("\n")}</main>`,
});

/* Scenario 4: broken contrast. */
files["broken-contrast.html"] = page({
  title: "Fixture: broken contrast",
  css: `
body { margin: 0; background: #ffffff; font-family: Georgia, serif; }
article { max-width: 36em; margin: 32px auto; padding: 0 20px; font-size: 18px; line-height: 1.5; color: #999999; }
article .ok { color: #1b1b1b; }
article a { color: #a0b4d0; }
article .large { font-size: 26px; color: #8a8a8a; }
article .callout { background: #fff3b0; color: #b8a600; padding: 8px; }`,
  body: `<article id="story">
<h1 class="ok">Contrast fixture</h1>
<p id="low">${PARAS[0]}</p>
<p class="ok">${PARAS[1]} <a href="#">A pale link</a> sits inside dark text.</p>
<p class="large" id="large">Large text at 26px in mid grey on white.</p>
<p class="callout" id="callout">Yellow text on a pale yellow callout box is hard to see.</p>
<p class="ok">${PARAS[2]}</p>
</article>`,
});

/* Scenario 4: clipping, text-spacing and reflow failures. */
files["broken-clipping.html"] = page({
  title: "Fixture: clipping and reflow",
  css: `
body { margin: 0; background: #fff; color: #1b1b1b; font-family: Arial, sans-serif; }
main { max-width: 40em; margin: 24px auto; padding: 0 16px; font-size: 17px; line-height: 1.45; }
.card { height: 96px; overflow: hidden; border: 1px solid #ccc; padding: 8px; margin: 12px 0; }
.spill { height: 72px; border: 1px dashed #999; padding: 6px; margin: 12px 0 40px; }
.chip { display: inline-block; width: 90px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border: 1px solid #888; padding: 2px 6px; }
.nowrap { white-space: nowrap; }
.wide { width: 760px; background: #f2f2f2; }
.imgbox { height: 40px; overflow: hidden; }`,
  body: `<main id="content">
<h1>Clipping fixture</h1>
<p>${PARAS[0]}</p>
<div class="card" id="card"><p>${PARAS[3]}</p></div>
<div class="spill" id="spill"><p>${PARAS[4].slice(0, 200)}</p></div>
<p>Tags: <span class="chip" id="chip">Typography and reading research</span></p>
<p class="nowrap" id="nowrap">This sentence is set with white-space nowrap so it can never wrap onto a second line on small screens.</p>
<div class="wide" id="wide"><p>This box has a fixed width of 760 pixels, wider than a phone screen.</p></div>
<div class="imgbox" id="imgbox"><p>Caption above a tall image.</p><svg width="40" height="200" aria-hidden="true"><rect width="40" height="200" fill="#ccc"/></svg></div>
<p>${PARAS[5]}</p>
</main>`,
});

/* Scenario 4: unresolved backgrounds. */
files["unresolved-background.html"] = page({
  title: "Fixture: unresolved backgrounds",
  css: `
body { margin: 0; background: #fff; color: #1b1b1b; font-family: Georgia, serif; }
main { max-width: 36em; margin: 24px auto; padding: 0 20px; font-size: 18px; line-height: 1.5; }
.hero { background: #ffffff linear-gradient(90deg, #111 0%, #eee 100%); color: #000; padding: 16px; }
.faded { opacity: 0.7; }
.stack { position: relative; height: 120px; }
.stack .photo { position: absolute; inset: 0; background: #222; }
.stack p { position: relative; color: #333; margin: 0; padding: 12px; }`,
  body: `<main id="content">
<h1>Unresolved backgrounds</h1>
<p>${PARAS[0]}</p>
<div class="hero" id="hero"><p>Black text over a dark-to-light gradient: the contrast varies along the line.</p></div>
<div class="faded" id="faded"><p>Text inside a container with opacity 0.7.</p></div>
<div class="stack" id="stack"><div class="photo"></div><p id="overlay-text">Dark grey text positioned over a dark sibling layer that is not its ancestor.</p></div>
<p>${PARAS[1]}</p>
</main>`,
});

/* Scenario 4: content the inspector cannot measure. */
files["canvas-frame-shadow.html"] = page({
  title: "Fixture: canvas, frames and closed shadow roots",
  css: `
body { margin: 0; font-family: Arial, sans-serif; color: #1b1b1b; background: #fff; }
main { max-width: 38em; margin: 24px auto; padding: 0 16px; font-size: 18px; line-height: 1.5; }
canvas, iframe { display: block; margin: 12px 0; border: 1px solid #ccc; }`,
  body: `<main id="content">
<h1>Unmeasurable content</h1>
<p>${PARAS[0]}</p>
<canvas id="cv" width="480" height="80"></canvas>
<iframe id="xframe" title="Opaque-origin frame" src="data:text/html,<p>Text inside an opaque-origin frame.</p>" width="480" height="80"></iframe>
<closed-note id="closed"></closed-note>
<p>${PARAS[2]}</p>
</main>
<script>
const c = document.getElementById("cv").getContext("2d");
c.font = "18px Arial"; c.fillText("This sentence is drawn on a canvas.", 10, 45);
customElements.define("closed-note", class extends HTMLElement {
  constructor() { super(); const r = this.attachShadow({ mode: "closed" }); r.innerHTML = '<p style="margin:0;padding:8px;background:#eee">Text in a closed shadow root.</p>'; }
});
</script>`,
});

/* Documentation page: prose + inline code + code blocks + table + footnote. */
files["docs-page.html"] = page({
  title: "Fixture: documentation page",
  css: `
body { margin: 0; background: #fafafa; color: #222; font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
.layout { display: grid; grid-template-columns: 240px 1fr; }
nav.sidebar { padding: 16px; font-size: 14px; border-right: 1px solid #e3e3e3; }
nav.sidebar a { display: block; color: #0b57d0; padding: 4px 0; }
.doc-content { padding: 24px 48px; font-size: 15px; line-height: 1.6; }
.doc-content code { font-family: ui-monospace, Menlo, monospace; font-size: 0.9em; background: #eee; padding: 1px 4px; }
.doc-content pre { background: #1e1e1e; color: #e6e6e6; padding: 12px; overflow-x: auto; }
.doc-content pre code { background: none; color: inherit; }
.doc-content table { border-collapse: collapse; }
.doc-content td, .doc-content th { border: 1px solid #ccc; padding: 4px 8px; }
@media (max-width: 700px) { .layout { grid-template-columns: 1fr; } nav.sidebar { display: none; } .doc-content { padding: 16px; } }`,
  body: `<div class="layout">
<nav class="sidebar" aria-label="Docs"><a href="#">Getting started</a><a href="#">Configuration</a><a href="#">Recipes</a><a href="#">CLI reference</a></nav>
<main class="doc-content" id="doc">
<h1>Configuring reading styles</h1>
<p>Reading styles are applied to a region of the page that you choose with a CSS selector such as <code>main article</code>. Each style is stored in a recipe file, so the same settings can be reviewed in a pull request and reproduced later on another machine.</p>
<p>To create a recipe, start from one of the starting presets and adjust it. The command below writes the generated CSS to standard output so you can inspect it before adding it to your stylesheet. Nothing is uploaded; the command runs entirely on your machine.</p>
<pre><code>rlab recipe css recipes/docs.json --scope ".doc-content"</code></pre>
<p>The table lists the fields that a recipe can contain. Every field is optional: leaving a field out keeps whatever the page already does, which makes it easy to change one thing at a time and measure the result.</p>
<table><thead><tr><th>Field</th><th>Meaning</th></tr></thead><tbody><tr><td><code>fontSizePx</code></td><td>Nominal body size in CSS pixels</td></tr><tr><td><code>lineHeight</code></td><td>Baseline distance divided by font size</td></tr><tr><td><code>measure</code></td><td>Target characters per line, calibrated in a browser</td></tr></tbody></table>
<p>When you change a recipe, run the inspector again and compare the two reports. The comparison lists which measurements changed and which findings were resolved, so reviewers can see the effect of the change without reading the CSS line by line.<sup><a href="#fn-docs">1</a></sup></p>
<p id="fn-docs"><small>1. Comparisons are only meaningful when the content, viewport and browser are the same in both reports.</small></p>
</main>
</div>`,
});

/* Newsletter: centred table-based email layout. */
files["newsletter.html"] = page({
  title: "Fixture: newsletter",
  css: `
body { margin: 0; background: #eef1f4; font-family: Helvetica, Arial, sans-serif; }
table.outer { width: 100%; }
td.container { max-width: 600px; width: 600px; background: #ffffff; padding: 24px; font-size: 16px; line-height: 1.5; color: #2a2a2a; }
td.container h2 { font-size: 20px; }
.footer { font-size: 12px; color: #6b6b6b; }`,
  body: `<table class="outer" role="presentation"><tr><td align="center">
<table role="presentation"><tr><td class="container" id="letter">
<h2>The weekly margin — issue 12</h2>
<p>${PARAS[0]}</p>
<p>${PARAS[5]}</p>
<p>Links this week: <a href="#">a long essay on paper and screens</a>, <a href="#">a short note on dark themes</a>, and <a href="#">an interview with a type designer</a>.</p>
<p class="footer">You are receiving this because you subscribed. <a href="#">Unsubscribe</a>.</p>
</td></tr></table>
</td></tr></table>`,
});

/* Turkish diacritics (Latin script, different language). */
files["turkish.html"] = page({
  title: "Fixture: Turkish text (Latin script with diacritics)",
  lang: "tr",
  css: `
body { margin: 0; background: #fff; color: #1b1b1b; font-family: Georgia, serif; }
article { max-width: 34em; margin: 32px auto; padding: 0 20px; font-size: 18px; line-height: 1.5; }`,
  body: `<article id="makale">
<h1>Ekranda okumak üzerine</h1>
<p>Bugün okuduğumuz metinlerin çoğu küçük ya da büyük bir ışık dikdörtgeninde karşımıza çıkıyor. Trende tek elle tutulan bir telefon, mutfak masasındaki bir dizüstü bilgisayar ya da iş yerindeki geniş bir ekran: yazı bunların hepsinde okunabilir kalmak zorunda.</p>
<p>Satır uzunluğu konusundaki tartışma ekranlardan çok daha eskidir. Çok kısa satırlar gözü sık sık başa döndürür ve cümlenin ritmini böler. Çok uzun satırlarda ise okur bir sonraki satırın başını bulmakta zorlanabilir. İğne, ığdır, şöyle, çağdaş, Göğüş, İstanbul ve ılık gibi sözcüklerdeki harfler de doğru ölçülmelidir.</p>
<p>Bu belirsizlik araştırmanın başarısızlığı değildir. Deneyler farklı şeyleri ölçer: biri okuma hızını, biri anlamayı, bir diğeri yalnızca tercihi. Bu sonuçlar her zaman örtüşmez ve rahat görünen bir düzen, en hızlı okunan düzen olmak zorunda değildir.</p>
</article>`,
});

/* RTL: Arabic. */
files["rtl-arabic.html"] = page({
  title: "Fixture: Arabic right-to-left text",
  lang: "ar",
  dir: "rtl",
  css: `
body { margin: 0; background: #fff; color: #1b1b1b; font-family: "Noto Naskh Arabic", "Geeza Pro", Tahoma, sans-serif; }
article { max-width: 34em; margin: 32px auto; padding: 0 20px; font-size: 20px; line-height: 1.7; }`,
  body: `<article id="maqal">
<h1>القراءة على الشاشة</h1>
<p>معظم ما نقرؤه اليوم يصل إلينا عبر مستطيل من الضوء. يتغير حجم هذا المستطيل من لحظة إلى أخرى: هاتف في اليد أثناء السفر، أو حاسوب محمول على طاولة المطبخ، أو شاشة كبيرة في العمل. على النص أن يبقى واضحاً في كل هذه الحالات.</p>
<p>طول السطر موضوع نقاش قديم بين مصممي الحروف. السطر القصير جداً يعيد العين إلى بداية السطر كثيراً، والسطر الطويل جداً يجعل العثور على بداية السطر التالي أصعب. ولا توجد نقطة مثالية واحدة تناسب جميع القراء وجميع النصوص.</p>
<p>لذلك من الأفضل أن نبدأ بإعداد معقول، وأن نسمح لكل قارئ بتغييره بسهولة، وأن نتحقق من النتيجة في متصفح حقيقي بدلاً من الاعتماد على المواصفات وحدها.</p>
</article>`,
});

/* CJK: Japanese. */
files["cjk-japanese.html"] = page({
  title: "Fixture: Japanese text",
  lang: "ja",
  css: `
body { margin: 0; background: #fff; color: #1b1b1b; font-family: "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif; }
article { max-width: 36em; margin: 32px auto; padding: 0 20px; font-size: 17px; line-height: 1.8; }`,
  body: `<article id="kiji">
<h1>画面で読むということ</h1>
<p>私たちが今日読む文章の多くは、光でできた四角形の中に現れます。電車の中で片手に持つスマートフォン、台所のテーブルに置いたノートパソコン、職場の大きなモニター。文字はそのどれでも読みやすくなければなりません。</p>
<p>一行の長さについての議論は、画面が登場するずっと前から続いています。行が短すぎると目が頻繁に行頭へ戻り、文のリズムが途切れます。行が長すぎると、次の行の始まりを見失いやすくなります。すべての読者に合う一つの最適な値は見つかっていません。</p>
<p>だからこそ、妥当な初期設定から始め、読者が簡単に変えられるようにし、仕様書だけを信じるのではなく実際のブラウザで結果を確かめることが大切です。</p>
</article>`,
});

/* A second article with different markup (no <article>/<main>), for profile reuse. */
files["blog-post.html"] = page({
  title: "Fixture: blog post with div markup",
  css: `
body { margin: 0; background: #fdfdfd; color: #262626; font-family: Verdana, Geneva, sans-serif; }
.topbar { background: #263238; color: #fff; padding: 10px 20px; font-size: 14px; }
.topbar a { color: #cfe3ff; }
.wrap { display: flex; gap: 32px; padding: 24px; }
.post-content { flex: 1; font-size: 15px; line-height: 1.35; }
.sidebar { width: 220px; font-size: 13px; color: #444; }`,
  body: `<div class="topbar"><a href="#">Field notes</a></div>
<div class="wrap">
<div class="post-content" id="post">
<h1>Paper, screens and patience</h1>
${PARAS.slice(1).map((p) => `<p>${p}</p>`).join("\n")}
<ul><li>Keep the start edge stable.</li><li>Let readers enlarge text without breaking the page.</li><li>Check the result in a browser.</li></ul>
</div>
<aside class="sidebar"><h2>Related</h2><p><a href="#">On margins</a></p><p><a href="#">On contrast</a></p></aside>
</div>`,
});

for (const [name, html] of Object.entries(files)) writeFileSync(join(here, name), html);
console.log(`wrote ${Object.keys(files).length} fixtures`);
