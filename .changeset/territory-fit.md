---
"codeheat": minor
---

Measure how well each territory holds up to the way the code changes. Every node of `territories.nodes` gains `fit` (null for the root and for a node no detail shows), computed once per territory with the module measures' rules over the territories visible at `fit.detail`, the detail that shows it closest to the recommended one:

- `containment` is the share of the changes touching the territory that touch no other territory, `radius` the median number of territories such a change touches, and `partner` the territory its changes most often reach into, with the shared changes and their share of the territory's own.
- `distantPairs` counts the coupled file pairs that cross the territory's boundary (test code and pairs of two contract files left out), `hiddenPairs` those among them that no import links, and `cliques` the groups of three or more territories it changes with as one unit.
- `erosion` is how containment moved over the series (the shape and verdicts of `Module.erosion`), `chronicFiles` and `acuteFiles` count its chronic and acute hotspots, `chronicShare` is the share of its code's heat they carry, and `fixDensity` the fixes among its changes.

Test-only territories take no part: test code is no spread. The new numbers add no measurable time to an analysis.
