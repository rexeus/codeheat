/** How many steps each side of the leak line has: `leak-1` (keeps least inside) to `leak-3`, `hold-1` to `hold-3` (keeps most). */
const STEPS = 3;

/**
 * The color step of a territory that keeps `containment` of its changes
 * inside, against the leak line `limit`: warm at or below it, darkest where
 * the least stays; calm above it, darkest where the most stays. `none` when
 * there is nothing to judge. The stylesheet maps each step to a fill.
 */
export const containmentStep = (
  containment: number | null,
  limit: number,
): string => {
  if (containment === null) {
    return "none";
  }
  if (containment <= limit) {
    const step = Math.floor((containment / Math.max(limit, 1e-9)) * STEPS);
    return `leak-${Math.min(STEPS, step + 1)}`;
  }
  const step = Math.ceil(((containment - limit) / (1 - limit)) * STEPS);
  return `hold-${Math.max(1, Math.min(STEPS, step))}`;
};
