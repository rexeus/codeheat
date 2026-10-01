---
"codeheat": patch
---

Report a fatal git error other than "not a git repository" (for example a dubious-ownership failure or a broken `.git/config`) with git's own message and exit code 1, instead of the misleading "not a git repository" and exit code 3. A bare repository or a `.git` directory, which has no work tree, still counts as not a git repository (exit code 3).
