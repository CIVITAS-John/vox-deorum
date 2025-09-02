/**
 * Event triggered when a Great Person unit is expended (consumed) to perform an action
 */
export interface GreatPersonExpendedEvent {
  /** The ID of the player who expended the Great Person */
  PlayerId: number;
  
  /** The unit type ID of the Great Person that was expended */
  GreatPersonUnit: number;
}