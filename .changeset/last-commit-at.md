---
"codeheat": minor
---

Say when the newest commit was made. `window` in `analyze --json` and `inspect --json` gains `lastCommitAt`: when the newest commit of the repository was made (the committer time of `HEAD`, an ISO timestamp), whatever the window, and `null` for a repository without commits. A window with no counted changes can say how old the repository's newest commit is (which need not touch the analysed files, such as a documentation-only commit), and a longer `--since` reads more history; the terminal summary adds one line for it, only in that case ("No counted changes in this window; the newest commit of the repository was on 2025-03-14."). It costs no extra call to `git`: one `git log -1` now resolves `HEAD` and reads its time where `git rev-parse` resolved it before. The report stays schema version 1; the field is additive.
