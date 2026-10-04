// The static skeleton of the page: the bar, the answers, the map, and the
// elements the viewer script fills. Every id here is looked up by `byId`.

/** Line icons on a 24-unit grid, drawn with the text color; `answers/icon.ts` names them. */
const ICONS: Readonly<Record<string, string>> = {
  flame:
    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  leak: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  target:
    '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  shield:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  scale: '<path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 5-6"/>',
  worse: '<path d="M22 17l-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
  better: '<path d="M22 7l-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  steady: '<path d="M3 12h16"/><path d="M15 8l4 4-4 4"/>',
  hub: '<path d="M12 9V3"/><path d="M12 21v-6"/><path d="M9 12H3"/><path d="M21 12h-6"/><circle cx="12" cy="12" r="3"/>',
  copies:
    '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/><rect x="9" y="9" width="13" height="13" rx="2"/>',
  unit: '<path d="M10.7 7.3 6.3 15.7"/><path d="M13.3 7.3l4.4 8.4"/><path d="M7.6 18.5h8.8"/><circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18.5" r="2.5"/><circle cx="19" cy="18.5" r="2.5"/>',
};

const ICON_SPRITE = `<svg id="icons" class="icon-sprite" aria-hidden="true">${Object.entries(
  ICONS,
)
  .map(
    ([name, shapes]) =>
      `<symbol id="icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${shapes}</symbol>`,
  )
  .join("")}</svg>`;

const BAR = `<div id="app" class="app" data-mode="heat">
  ${ICON_SPRITE}
  <nav class="topbar" aria-label="This report">
    <a class="brand" href="#answers"><span class="brand-logo"><svg class="icon" aria-hidden="true"><use href="#icon-flame"></use></svg></span>codeheat</a>
    <span id="repository" class="topbar-repository"></span>
    <span id="summary" class="topbar-summary"></span>
    <a class="topbar-link" href="#map">Map</a>
  </nav>
  <main>`;

const ANSWERS = `    <section id="answers" class="answers" aria-labelledby="answers-question">
      <header class="answers-head">
        <p class="answers-eyebrow"><svg class="icon" aria-hidden="true"><use href="#icon-target"></use></svg>Design fit</p>
        <h1 id="answers-question">Does your design hold up to the way your code actually changes?</h1>
        <p id="verdict" class="verdict-badge"></p>
        <p id="trend" class="trend"></p>
        <p id="verdict-reason" class="verdict-reason" hidden></p>
      </header>
      <div id="answer-cards" class="answer-cards"></div>
    </section>`;

const MAP = `    <section id="map" class="section map-section" aria-labelledby="map-title">
      <header class="section-head">
        <p class="eyebrow">Map</p>
        <h2 id="map-title">Every file, by size and heat</h2>
        <p class="section-intro">Files grouped by the territory that holds them, or by folder; select a tile to see why it is hot and which files change together with it.</p>
      </header>
      <div id="legend" class="legend"></div>
      <div class="toolbar">
        <fieldset id="grouping-switch" class="mode-switch">
          <legend>Group by</legend>
          <label><input type="radio" name="grouping" value="territories" checked><span>Territories</span></label>
          <label><input type="radio" name="grouping" value="folders"><span>Folders</span></label>
        </fieldset>
        <label id="detail-pick" class="detail-pick"><span>Detail</span><select id="detail-select"></select></label>
        <fieldset id="mode-switch" class="mode-switch">
          <legend>Color by</legend>
          <label><input type="radio" name="color-mode" value="heat" checked><span>Heat</span></label>
          <label><input type="radio" name="color-mode" value="cohesion"><span>Cohesion</span></label>
          <label><input type="radio" name="color-mode" value="change"><span>Change</span></label>
        </fieldset>
        <input id="filter" type="search" autocomplete="off" spellcheck="false" aria-label="Filter files" placeholder="Filter by path or glob, e.g. billing or src/**/*.ts">
        <span id="filter-count" class="filter-count"></span>
      </div>
      <div id="zoom-bar" class="zoom-bar" hidden></div>
      <div class="content">
        <div id="stage" class="stage">
          <svg id="treemap" role="img" aria-label="Treemap of files: area is lines of code, color is hotspot score, module cohesion, or change since the previous window"></svg>
          <div id="tooltip" class="tooltip" hidden></div>
        </div>
        <aside id="panel" class="panel" aria-live="polite"></aside>
      </div>
    </section>`;

/** The markup inside `<body>`, before the embedded report and the script. */
export const PAGE_BODY = `${BAR}
${ANSWERS}
${MAP}
  </main>
</div>
`;
