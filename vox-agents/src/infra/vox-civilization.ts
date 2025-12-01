/**
 * @module infra/vox-civilization
 *
 * Manages Civilization V game process lifecycle.
 * Handles game launching, process monitoring, and exit callback management
 * for the Windows environment. Supports binding to existing processes and
 * crash recovery scenarios.
 */

import { spawn, exec } from 'child_process';
import { join } from 'path';
import { promisify } from 'util';
import { setTimeout } from 'node:timers/promises'
import { createLogger } from '../utils/logger.js';

const logger = createLogger('VoxCivilization');
const execAsync = promisify(exec);
type ExitCallback = (code: number | null) => void;

/**
 * Controls Civilization V game instance.
 * Manages game process lifecycle including launching, monitoring, and shutdown.
 *
 * @class
 *
 * @example
 * ```typescript
 * import { voxCivilization } from './infra/vox-civilization.js';
 *
 * voxCivilization.onGameExit((code) => {
 *   console.log(`Game exited with code: ${code}`);
 * });
 *
 * await voxCivilization.startGame('StartGame.lua');
 * ```
 */
export class VoxCivilization {
  private exitCallbacks: Set<ExitCallback> = new Set();
  private monitoring = false;
  private externalProcessPid: number | null = null;
  private pollInterval: NodeJS.Timeout | null = null;

  /**
   * Finds and binds to an existing CivilizationV.exe process.
   *
   * @private
   * @returns True if found and bound successfully, false otherwise
   */
  private async bindToExistingProcess(): Promise<boolean> {
    const pid = await this.findCivilizationProcess();
    if (pid) {
      logger.info(`Found existing CivilizationV.exe process (PID: ${pid})`);
      this.externalProcessPid = pid;
      this.monitoring = true;
      this.startProcessMonitoring();
      return true;
    } else {
      return false;
    }
  }

  /**
   * Finds CivilizationV.exe process using Windows tasklist.
   *
   * @private
   * @returns Process ID if found, null otherwise
   */
  private async findCivilizationProcess(): Promise<number | null> {
    try {
      const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq CivilizationV.exe" /FO CSV');
      const lines = stdout.trim().split('\n');

      // Skip header line, look for process
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts[0]?.includes('CivilizationV.exe')) {
          const pid = parseInt(parts[1].replace(/"/g, ''), 10);
          if (!isNaN(pid)) {
            return pid;
          }
        }
      }
    } catch (error) {
      // Command failed, no process found
    }
    return null;
  }

  /**
   * Starts polling to monitor an external process.
   * Checks every 5 seconds if the process is still running.
   *
   * @private
   */
  private startProcessMonitoring(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    // Poll every 5 seconds to check if process still exists
    this.pollInterval = setInterval(async () => {
      if (this.externalProcessPid) {
        const stillRunning = await this.isProcessRunning(this.externalProcessPid);
        if (!stillRunning) {
          logger.info(`Process ${this.externalProcessPid} is no longer running`);
          this.handleGameExit(0);
          this.stopProcessMonitoring();
        }
      }
    }, 5000);
  }

  /**
   * Stops the process monitoring poll
   */
  private stopProcessMonitoring(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Checks if a process with given PID is running
   */
  private async isProcessRunning(pid: number): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV`);
      const lines = stdout.trim().split('\n');
      // Check if we have more than just the header line and the PID is present
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].includes(`"${pid}"`)) {
          return true;
        }
      }
      return false;
    } catch (error) {
      logger.error(`Error checking if process ${pid} is running:`, error);
      return false;
    }
  }

  /**
   * Starts a Civilization V game with the specified Lua script.
   * Waits for the game process to fully initialize before returning.
   *
   * @param luaName - Name of the Lua script to run (default: 'LoadMods.lua')
   * @returns True if game started successfully, false if already running
   */
  async startGame(luaName: string = 'LoadMods.lua'): Promise<boolean> {
    // Check if game is already running
    if (await this.bindToExistingProcess() || this.isGameRunning()) {
      logger.info('Game instance already exists, monitoring it...');
      return true;
    }

    const scriptPath = join('scripts', 'launch-civ5.cmd');

    try {
      logger.info(`Launching Civilization V with script: ${luaName}`);

      // Launch the cmd script and wait for it to complete
      await new Promise<void>((resolve, reject) => {
        const cmdProcess = spawn('cmd', ['/c', scriptPath, luaName], {
          detached: false,
          stdio: 'inherit',
          shell: false
        });

        cmdProcess.on('exit', (code) => {
          if (code === 0) {
            logger.info('Launch script completed successfully');
            resolve();
          } else {
            reject(new Error(`Launch script exited with code ${code}`));
          }
        });

        cmdProcess.on('error', (err) => {
          reject(err);
        });
      });

      // Wait an additional 5s after the cmd finishes
      // Note that Civ5 would start a process, end it, and then start another one
      logger.info('Waiting 5 seconds for game to fully initialize...');
      await setTimeout(5000);

      // Find and bind to the actual CivilizationV.exe process
      return await this.bindToExistingProcess();
    } catch (error) {
      logger.error('Failed to launch game:', error);
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
    return this.monitoring && this.externalProcessPid !== null;
  }

  /**
   * Gets the current game process PID if running
   * @returns Process ID or null if not running
   */
  getProcessId(): number | null {
    return this.externalProcessPid;
  }

  private handleGameExit(code: number | null): void {
    if (!this.monitoring) return;
    
    logger.info(`Game exited with code: ${code}`);
    this.monitoring = false;
    this.externalProcessPid = null;
    this.stopProcessMonitoring();

    // Notify all registered callbacks
    this.exitCallbacks.forEach(callback => {
      try {
        callback(code);
      } catch (error) {
        logger.error('Error in exit callback:', error);
      }
    });
  }

  /**
   * Forcefully kill the game process using Windows taskkill.
   *
   * @returns True if kill command succeeded, false otherwise
   */
  async killGame(): Promise<boolean> {
    if (!this.externalProcessPid) {
      logger.info('No game process to kill');
      return true;
    }

    try {
      logger.info(`Killing game process with PID: ${this.externalProcessPid}`);
      await execAsync(`taskkill /F /PID ${this.externalProcessPid}`);

      // Wait a bit for the process to terminate
      await setTimeout(5000);

      // Update internal state if haven't
      this.handleGameExit(-1);
      return true;
    } catch (error) {
      logger.error('Failed to kill game process:', error);
      return false;
    }
  }

  /**
   * Cleanup resources.
   * Stops monitoring and clears all callbacks.
   */
  destroy(): void {
    this.stopProcessMonitoring();
    this.exitCallbacks.clear();
  }
}

/**
 * Singleton VoxCivilization instance for managing the game process.
 *
 * @example
 * ```typescript
 * import { voxCivilization } from './infra/vox-civilization.js';
 * await voxCivilization.startGame('LoadGame.lua');
 * ```
 */
export const voxCivilization = new VoxCivilization();