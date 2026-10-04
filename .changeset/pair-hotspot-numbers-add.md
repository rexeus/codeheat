---
"codeheat": patch
---

Add the hotspot numbers of a boundary between two territories. When such an entry also takes in the hotspots of its territories, `chronicHeatShare` and `chronicFiles` in its `evidence` are summed over the hotspots of both instead of being those of the one that scores higher, and its other numbers stay those of both territories together even when a hotspot leads the entry.
