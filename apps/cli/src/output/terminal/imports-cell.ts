// Owns how a table cell says which of two coupled files imports the other.
import type { Coupling } from "@codeheat/engine";

import type { Style } from "./style.js";
import { plain } from "./table.js";
import type { Cell } from "./table.js";

/** Which of the two files imports the other; no import at all is hidden coupling, which stands out. */
export const importsCell = (
  { imports }: Pick<Coupling, "imports">,
  style: Style,
): Cell =>
  imports === "none"
    ? { text: "hidden", paint: style.bold }
    : plain(imports ?? "-");
