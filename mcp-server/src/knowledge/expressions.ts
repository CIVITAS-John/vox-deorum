import { Expression, expressionBuilder, SqlBool } from "kysely";
import { KnowledgeDatabase } from "./schema/base";

/**
 * An expression to check whether the TimedKnowledge is visible to a player.
 */
export function isVisible(playerID: number, level: number = 1): Expression<SqlBool> {
  const eb = expressionBuilder<KnowledgeDatabase>();
  return eb(`Player${playerID}` as any, '>=', level);
}

/**
 * An expression to check whether the TimedKnowledge is at a given turn.
 * By default, turn = current turn - 1.
 */
export function isAtTurn(turn: number): Expression<SqlBool> {
  const eb = expressionBuilder<KnowledgeDatabase>();
  return eb(`Turn` as any, '=', turn);
}