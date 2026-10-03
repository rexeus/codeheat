---
"codeheat": minor
---

Show whether the design holds up over time. `analyze` cuts its window into windows of about a quarter of a year (at most 12, from the same read of the history) and reports:

- `series`: the change radius and propagation cost of each window, and whether it has enough changes (10) to count. The window is cut only when it is about 4.5 months (20 weeks) long or longer; windows are about a quarter each, at most 12.
- `erosion`: a verdict on the repository (`eroding`, `improving`, `holding`, or `unknown` with fewer than 3 active windows), judged over the active windows with a robust (Theil–Sen) line through the share of changes that stay in one module. It says eroding or improving only when the line moved by at least 10 points and 2 standard errors of the shift, so a flat design reads `holding`. A series that ends quiet says so in `inactiveSince`, the start of the trailing run of inactive windows, which are left out of the verdict. Each module gets `erosion` too: the same line through its cohesion per window (windows with at least 10 of its changes), with its own `verdict`.
- `FileStats.heat`: `chronic` for a file that was among the hottest in at least half of at least three windows before the last two (a design problem; needs a series of five windows, `--since 18m`), `acute` for one that was hot in both of the last two and in fewer than half of the windows before them (current work).
- `fixDensity`: the share of changes whose commit subjects say they fix something (`fix`, `hotfix`, `bugfix`, or `revert` types, `Revert "`, or `fix`/`bug` as the first word, but not `bug` followed by a ticket number), per module with the fixes that also touched another module. When fewer than 5 % of the subjects match a fix rule or a Conventional Commits type it is unknown (`known: false`, no share), never 0; a team that writes free text and often starts with "Fix" does get a share.

The terminal gains an "Over time" section with the verdict, the three modules whose cohesion fell most, the number of chronic and acute hotspots, and the share of fixes; `inspect` marks a chronic or acute file. There are no new flags: the window length is automatic, and a longer `--since` gives more windows.
