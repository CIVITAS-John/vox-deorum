/**
 * Manages Civilization V game process lifecycle
 */

import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type ExitCallback = (code: number | null) => void;

/**
 * Controls Civilization V game instance
 */
export class VoxCivilization {
  private gameProcess: ChildProcess | null = null;
  private exitCallbacks: Set<ExitCallback> = new Set();
  private monitoring = false;

  /**
   * Starts a Civilization V game with the specified Lua script
   * @param luaName Name of the Lua script to run (e.g., 'StartGame.lua')
   * @returns true if game started, false if already running
   */
  async startGame(luaName: string = 'LoadMods.lua'): Promise<boolean> {
    // Check if game is already running
    if (this.isGameRunning()) {
      console.log('Game instance already exists, monitoring it...');
      return false;
    }

    const scriptPath = join(__dirname, '..', '..', 'scripts', 'launch-civ5.cmd');

    try {
      this.gameProcess = spawn('cmd', ['/c', scriptPath, luaName], {
        detached: false,
        stdio: 'inherit',
        shell: false
      });

      this.monitoring = true;

      // Monitor process exit
      this.gameProcess.on('exit', (code) => {
        this.handleGameExit(code);
      });

      this.gameProcess.on('error', (err) => {
        console.error('Failed to start game:', err);
        this.handleGameExit(null);
      });

      console.log(`Started Civilization V with script: ${luaName}`);
      return true;
    } catch (error) {
      console.error('Failed to launch game:', error);
      return false;
    }
  }

  /**
   * Registers a callback to be called when the game exits
   * @param callback Function to call when game exits
   */
  onGameExit(callback: ExitCallback): void {
    this.exitCallbacks.add(callback);
  }

  /**
   * Removes a previously registered exit callback
   * @param callback Callback to remove
   */
  offGameExit(callback: ExitCallback): void {
    this.exitCallbacks.delete(callback);
  }

  /**
   * Checks if the game is currently running
   * @returns true if game process exists and hasn't exited
   */
  isGameRunning(): boolean {
    return this.gameProcess !== null && !this.gameProcess.killed && this.monitoring;
  }

  /**
   * Gets the current game process PID if running
   * @returns Process ID or null if not running
   */
  getProcessId(): number | null {
    return this.gameProcess?.pid ?? null;
  }

  private handleGameExit(code: number | null): void {
    console.log(`Game exited with code: ${code}`);
    this.monitoring = false;
    this.gameProcess = null;

    // Notify all registered callbacks
    this.exitCallbacks.forEach(callback => {
      try {
        callback(code);
      } catch (error) {
        console.error('Error in exit callback:', error);
      }
    });
  }
}

// Export singleton instance for convenience
export const voxCivilization = new VoxCivilization();