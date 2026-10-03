---
"codeheat": minor
---

Show whether the design holds up over time. `analyze` cuts its window into windows of about a quarter of a year (at most 12, from the same read of the history) and reports:

- `series`: the change radius and propagation cost of each window, and whether it has enough changes (10) to count.
- `erosion`: a verdict on the repository (`eroding`, `improving`, `holding`, or `unknown` with fewer than 3 active windows), judged over the active windows with the line through the share of changes that stay in one module that it rests on. A series that ends quiet says so in `inactiveSince`, the start of the trailing run of inactive windows, which are left out of the verdict. Each module gets `erosion` too: a line through its cohesion per window.
- `FileStats.heat`: `chronic` for a file that is among the hottest in at least half of the windows it has existed in (a design problem), `acute` for one that became hot only in the last two (current work).
- `fixDensity`: the share of changes whose commit subjects say they fix something (`fix`, `hotfix`, `bugfix`, a revert, or fix or bug as the first word), per module with the fixes that also touched another module. A team without commit conventions gets `known: false` and no share, never 0.

The terminal gains an "Over time" section with the verdict, the three modules whose cohesion fell most, the number of chronic and acute hotspots, and the share of fixes; `inspect` marks a chronic or acute file. There are no new flags: the window length is automatic, and a longer `--since` gives more windows.
