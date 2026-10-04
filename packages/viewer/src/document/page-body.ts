// The static skeleton of the page: the bar, the three sections, and the
// elements the viewer script fills. Every id here is looked up by `byId`.

const SECTIONS_BAR = `<div id="app" class="app" data-mode="heat">
  <nav class="topbar" aria-label="Sections of this report">
    <a class="brand" href="#hero">codeheat</a>
    <span id="repository" class="topbar-repository"></span>
    <span class="topbar-links">
      <a href="#start">Where to start</a>
      <a href="#heat">Where the heat is</a>
      <a href="#map">Map</a>
    </span>
  </nav>
  <main>`;

const HERO = `    <section id="hero" class="hero" aria-labelledby="hero-question">
      <div class="hero-intro">
        <p class="eyebrow">Design fit</p>
        <h1 id="hero-question">Does your design hold up to the way your code actually changes?</h1>
        <p class="hero-define">A territory is an area of the code; its boundary holds when changes stay inside it.</p>
        <div id="verdict" class="verdict"></div>
      </div>
      <figure id="fit-figure" class="fit-figure">
        <div id="fit-map" class="fit-map" role="list" aria-label="The parts of the repository: area is the share of the change effort, color is how many of a part's changes stay inside it"></div>
        <div id="fit-legend" class="fit-legend"></div>
        <details id="fit-list" class="fit-list"></details>
      </figure>
      <div class="hero-top">
        <h2 class="hero-top-title">Where to start first</h2>
        <ol id="top-three" class="top-three"></ol>
      </div>
      <p id="summary" class="hero-meta"></p>
    </section>`;

const WHERE_TO_START = `    <section id="start" class="section" aria-labelledby="start-title">
      <header class="section-head">
        <p class="eyebrow">Where to start</p>
        <h2 id="start-title">The places where the design strains most</h2>
        <p class="section-intro">Best first: the share of the change effort at stake, times how clearly the design fails there. Each says what is wrong and what to do about it.</p>
      </header>
      <div id="start-body"></div>
    </section>`;

const WHERE_THE_HEAT_IS = `    <section id="heat" class="section" aria-labelledby="heat-title">
      <header class="section-head">
        <p class="eyebrow">Where the heat is</p>
        <h2 id="heat-title">The areas of the code, hottest first</h2>
        <p class="section-intro">Each card is one territory at the detail you choose: how much of the change effort it holds, how many of its changes stay inside, and what stands out about it.</p>
      </header>
      <div id="heat-body"></div>
    </section>`;

const MAP = `    <section id="map" class="section map-section" aria-labelledby="map-title">
      <header class="section-head">
        <p class="eyebrow">Map</p>
        <h2 id="map-title">Every file, by size and heat</h2>
        <p class="section-intro">Select a tile to see why it is hot and which files change together with it.</p>
      </header>
      <div id="legend" class="legend"></div>
      <div class="toolbar">
        <fieldset id="mode-switch" class="mode-switch">
          <legend>Color by</legend>
          <label><input type="radio" name="color-mode" value="heat" checked><span>Heat</span></label>
          <label><input type="radio" name="color-mode" value="cohesion"><span>Cohesion</span></label>
          <label><input type="radio" name="color-mode" value="change"><span>Change</span></label>
        </fieldset>
        <input id="filter" type="search" autocomplete="off" spellcheck="false" aria-label="Filter files" placeholder="Filter by path or glob, e.g. billing or src/**/*.ts">
        <span id="filter-count" class="filter-count"></span>
      </div>
      <div class="content">
        <div id="stage" class="stage">
          <svg id="treemap" role="img" aria-label="Treemap of files: area is lines of code, color is hotspot score, module cohesion, or change since the previous window"></svg>
          <div id="tooltip" class="tooltip" hidden></div>
        </div>
        <aside id="panel" class="panel" aria-live="polite"></aside>
      </div>
    </section>`;

/** The markup inside `<body>`, before the embedded report and the script. */
export const PAGE_BODY = `${SECTIONS_BAR}
${HERO}
${WHERE_TO_START}
${WHERE_THE_HEAT_IS}
${MAP}
  </main>
</div>
`;
