/**
 * Utility functions for managing game identity and synchronization state
 * Uses BridgeManager to execute Lua scripts and interact with Civ V's save data
 */

import { bridgeManager } from '../../server.js';

/**
 * Game identity information
 */
export interface GameIdentity {
  gameId: string;
  turn: number;
  timestamp?: number;
}

/**
 * Get or create a unique game ID for the current game session
 * Uses Civ V's Modding.OpenSaveData() to persist the ID
 * @returns The unique game ID and current turn number
 */
export async function syncGameIdentity(): Promise<GameIdentity | undefined> {
  const script = `
    -- Open save data for persistent storage
    local saveDB = Modding.OpenSaveData()
    local gameId = nil
    local turn = Game.GetGameTurn()
    local lastSyncTimestamp = nil
    
    -- Create table if not exists
    for row in saveDB.Query('CREATE TABLE IF NOT EXISTS Deorum("ID" INTEGER NOT NULL PRIMARY KEY, "Key" TEXT, "Value" TEXT)') do end

    -- Try to get existing game ID
    for row in saveDB.Query("SELECT Value FROM Deorum WHERE Key == 'GameID'") do
      gameId = row.Value
      break
    end
    
    -- Get last sync timestamp before updating
    for row in saveDB.Query("SELECT Value FROM Deorum WHERE Key == 'LastSync'") do
      lastSyncTimestamp = tonumber(row.Value)
      break
    end
    
    -- Update timestamp
    local currentTimestamp = ${Date.now()}
    
    -- Create new game ID if not exists
    if not gameId then
      -- Generate unique ID using timestamp
      gameId = "${crypto.randomUUID()}"
      
      -- Store both GameID and LastSync in save data
      for row in saveDB.Query("INSERT INTO Deorum (Key, Value) VALUES ('GameID', ?)", gameId) do end
      for row in saveDB.Query("INSERT INTO Deorum (Key, Value) VALUES ('LastSync', ?)", tostring(currentTimestamp)) do end
    else
      -- Update existing timestamp
      for row in saveDB.Query("UPDATE Deorum SET Value = ? WHERE Key == 'LastSync'", tostring(currentTimestamp)) do end
    end
    
    return {
      gameId = gameId,
      turn = turn,
      timestamp = lastSyncTimestamp
    }
  `;

  const response = await bridgeManager.executeLuaScript(script);
  if (!response.success) return undefined;
  return response.result as GameIdentity;
}