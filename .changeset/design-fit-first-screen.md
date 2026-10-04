---
"codeheat": minor
---

Open the HTML report on the answer. `codeheat analyze --html` now starts with the question "does your design hold up to the way your code actually changes?" (with one line saying what a territory and its boundary are) and, without scrolling at 1440 × 900, a one-sentence verdict for the repository, a fit map of all territories, and the top three places to start as one-liners.

- The verdict names how much of the change effort sits in territories that keep reaching into their neighbors, with the numbers behind it: how many of the territories with enough changes leak (at most 75% of their changes stay inside), how much of the effort the top three places hold, the trend of the share of changes that stay in one module, and the propagation cost.
- The fit map shows every territory with its name and what it is: area is the share of the change effort, color is the share of its changes that stay inside it, hatching says the territory is not judged and why (test code, no counted changes, changes only in commits too large to count, or too few changes), and one numbered marker gives a territory's best rank in Where to start, outlined for the top three. Names never break inside a word and text colors meet WCAG AA.
- "Where to start" lists the ranked entry points with their verdict, where a boundary leaks to, the design move, and the numbers behind it, and links to the territory on the fit map and to the files in the treemap. On a phone the top three come before the map.
- The treemap, its side panel, color modes, and filter move unchanged into a "Map" section. The page follows light and dark mode and says plainly when a report has no territories or entry points.

The help of `--html`, `--out`, and `--no-open` now says "HTML report" instead of "treemap". The JSON report and the flags are unchanged.
