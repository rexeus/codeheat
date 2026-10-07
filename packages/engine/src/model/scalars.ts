// Owns the scalar schemas shared by the report documents, so that report.ts
// and module.ts can both build on them without importing each other.
import { Schema } from "effect";

export const Count = Schema.Natural;
export const UnitInterval = Schema.Finite.check(
  Schema.isBetween({ minimum: 0, maximum: 1 }),
);
/** A difference of two unit-interval values. */
export const UnitDelta = Schema.Finite.check(
  Schema.isBetween({ minimum: -1, maximum: 1 }),
);
