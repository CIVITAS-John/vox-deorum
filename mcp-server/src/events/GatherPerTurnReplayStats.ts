/**
 * Event triggered during gameplay to collect statistical data for replay functionality
 */
export interface GatherPerTurnReplayStatsEvent {
  /** The unique identifier of the player for whom statistics are being gathered */
  PlayerId: number;
}