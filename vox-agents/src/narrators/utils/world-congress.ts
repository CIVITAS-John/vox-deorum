/**
 * @module narrators/utils/world-congress
 *
 * Pure text formatter that converts the `VictoryProgress.DiplomaticVictory`
 * JSON blob and a list of `ResolutionResult` GameEvent payloads into a
 * compact human-readable World Congress summary used by the narrator
 * pipeline.
 */

/** Known per-civ field names from VictoryProgress.DiplomaticVictory */
export const DIPLOMATIC_NON_CIV_KEYS = new Set([
  'Status',
  'VotesNeeded',
  'ActiveResolutions',
  'Proposals',
  'Contender',
]);

/**
 * Format a World Congress summary string from VictoryProgress.DiplomaticVictory
 * data and ResolutionResult event payloads. Returns null if there's nothing
 * meaningful to report.
 */
export function formatWorldCongress(
  diplomaticVictory: unknown,
  resolutionEvents: Record<string, unknown>[],
): string | null {
  const dipl = (typeof diplomaticVictory === 'object' && diplomaticVictory !== null)
    ? diplomaticVictory as Record<string, unknown>
    : null;

  const lines: string[] = [];

  if (dipl) {
    // Header line: status + votes needed
    const status = typeof dipl.Status === 'string' ? dipl.Status : null;
    const votesNeeded = typeof dipl.VotesNeeded === 'number' ? dipl.VotesNeeded : null;
    if (status) {
      lines.push(votesNeeded != null
        ? `${status} (${votesNeeded} votes needed)`
        : status);
    }

    // Delegates: civ-keyed entries with { Delegates, VictoryPercentage }
    const delegates: { civ: string; delegates: number; pct: number }[] = [];
    for (const [key, value] of Object.entries(dipl)) {
      if (DIPLOMATIC_NON_CIV_KEYS.has(key)) continue;
      if (typeof value !== 'object' || value === null) continue;
      const v = value as Record<string, unknown>;
      if (typeof v.Delegates === 'number') {
        delegates.push({
          civ: key,
          delegates: v.Delegates,
          pct: typeof v.VictoryPercentage === 'number' ? v.VictoryPercentage : 0,
        });
      }
    }
    if (delegates.length > 0) {
      delegates.sort((a, b) => b.delegates - a.delegates);
      const summary = delegates
        .map((d) => `${d.civ} ${d.delegates} (${d.pct}%)`)
        .join(', ');
      lines.push(`Delegates: ${summary}`);
    }

    if (typeof dipl.Contender === 'string' && dipl.Contender) {
      lines.push(`Contender: ${dipl.Contender}`);
    }

    // Active resolutions: keys are human-readable names
    const active = dipl.ActiveResolutions;
    if (active && typeof active === 'object') {
      const names = Object.keys(active as Record<string, unknown>);
      if (names.length > 0) {
        lines.push(`Active: ${names.join(', ')}`);
      }
    }

    // Proposals: keys are human-readable names
    const proposals = dipl.Proposals;
    if (proposals && typeof proposals === 'object') {
      const names = Object.keys(proposals as Record<string, unknown>);
      if (names.length > 0) {
        lines.push(`Proposals: ${names.join(', ')}`);
      }
    }
  }

  // Voting results from ResolutionResult events
  if (resolutionEvents.length > 0) {
    const results = resolutionEvents.map((e) => {
      const action = e.IsEnact ? 'Enact' : 'Repeal';
      const outcome = e.Passed ? 'passed' : 'failed';
      const resolutionType = e.ResolutionType;
      return `${action} resolution ${resolutionType} ${outcome}`;
    });
    lines.push(`Voting Results: ${results.join('; ')}`);
  }

  return lines.length > 0 ? lines.join('\n') : null;
}
