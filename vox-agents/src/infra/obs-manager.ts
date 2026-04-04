/**
 * @module infra/obs-manager
 *
 * Manages OBS Studio for recording and livestreaming game sessions.
 * Uses obs-websocket-js (WebSocket v5) to control OBS programmatically.
 *
 * Responsibilities:
 * - Connect to OBS via WebSocket
 * - Set up game capture scenes automatically
 * - Start/stop/pause/resume recording or streaming
 * - Track recording files and write companion log files
 * - Health monitoring with automatic reconnection
 * - OBS process detection and launch
 */

import OBSWebSocket from 'obs-websocket-js';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createLogger } from '../utils/logger.js';
import { processManager } from './process-manager.js';
import type { ProductionMode, ObsConfig } from '../types/config.js';

const logger = createLogger('ObsManager');

const GAME_SCENE_NAME = 'Vox Deorum';
const PAUSE_SCENE_NAME = 'Vox Deorum - Paused';
const GAME_CAPTURE_INPUT_NAME = 'Game Capture';
const PAUSE_IMAGE_INPUT_NAME = 'Pause Image';
const GAME_EXECUTABLE = 'CivilizationV.exe';
const DEFAULT_OBS_PATH = 'C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe';
const HEALTH_POLL_INTERVAL = 10_000;
const MAX_RECOVERY_ATTEMPTS = 3;

/** Entry in the companion event log written alongside each recording. */
export interface ObsEvent {
  type: string;
  at: string;
  details?: string;
}

/** Metadata for a single recording file. */
export interface RecordingFile {
  path: string;
  startedAt: Date;
  stoppedAt?: Date;
  logPath: string;
}

/** Companion log written alongside each recording video file. */
interface RecordingLog {
  videoFile: string;
  configName: string;
  productionMode: ProductionMode;
  startedAt: string;
  stoppedAt: string;
  events: ObsEvent[];
}

class ObsManager {
  private obs = new OBSWebSocket();
  private mode: ProductionMode = 'none';
  private obsConfig?: ObsConfig;
  private configName = '';
  private connected = false;
  private productionActive = false;
  private healthInterval?: ReturnType<typeof setInterval>;
  private recoveryAttempts = 0;
  private events: ObsEvent[] = [];
  private recordingFiles: RecordingFile[] = [];
  private currentRecording?: RecordingFile;
  private processManagerRegistered = false;

  /**
   * Initialize OBS connection and set up scenes.
   * Returns true if OBS is operational, false if it could not connect.
   */
  async initialize(mode: ProductionMode, config?: ObsConfig, configName?: string): Promise<boolean> {
    if (mode !== 'livestream' && mode !== 'recording') {
      logger.debug(`OBS not needed for mode: ${mode}`);
      return false;
    }

    this.mode = mode;
    this.obsConfig = config;
    this.configName = configName || '';

    // Register with ProcessManager for clean shutdown
    if (!this.processManagerRegistered) {
      this.processManagerRegistered = true;
      processManager.register('obs', async () => {
        await this.destroy();
      });
    }

    // Ensure OBS is running
    if (!this.isObsRunning()) {
      const launched = this.launchObs();
      if (!launched) {
        logger.error('Failed to launch OBS Studio');
        return false;
      }
      // Give OBS time to start and initialize WebSocket server
      await this.sleep(3000);
    }

    // Connect to OBS WebSocket
    const wsConnected = await this.connect();
    if (!wsConnected) return false;

    // Set up scenes
    await this.setupScenes();

    // Listen for recording state events
    this.obs.on('RecordStateChanged', (event) => {
      if (event.outputState === 'OBS_WEBSOCKET_OUTPUT_STOPPED' && event.outputPath) {
        this.handleRecordingStopped(event.outputPath);
      }
    });

    // Start health monitoring
    this.startHealthMonitor();

    logger.info(`OBS initialized in ${mode} mode`);
    return true;
  }

  /**
   * Start recording or streaming based on the current mode.
   */
  async startProduction(): Promise<void> {
    if (!this.connected) {
      logger.warn('Cannot start production: OBS not connected');
      return;
    }

    if (this.mode === 'recording') {
      // If already recording, treat as success (idempotent)
      const status = await this.obs.call('GetRecordStatus');
      if (status.outputActive) {
        logger.info('Recording already active — joining existing session');
        this.productionActive = true;
        if (!this.currentRecording) {
          this.currentRecording = { path: '', startedAt: new Date(), logPath: '' };
        }
        this.addEvent('recording_started', 'joined existing session');
        return;
      }

      await this.obs.call('StartRecord');
      this.currentRecording = {
        path: '',
        startedAt: new Date(),
        logPath: '',
      };
      this.addEvent('recording_started');
      this.productionActive = true;
      logger.info('Recording started');
    } else if (this.mode === 'livestream') {
      const status = await this.obs.call('GetStreamStatus');
      if (status.outputActive) {
        logger.info('Stream already active — joining existing session');
        this.productionActive = true;
        return;
      }

      await this.obs.call('StartStream');
      this.addEvent('streaming_started');
      this.productionActive = true;
      logger.info('Streaming started');
    }
  }

  /**
   * Pause production.
   * - Recording mode: PauseRecord (keeps file open, no dead air)
   * - Livestream mode: Switch to pause scene (shows static image)
   */
  async pauseProduction(): Promise<void> {
    if (!this.connected || !this.productionActive) return;

    try {
      if (this.mode === 'recording') {
        await this.obs.call('PauseRecord');
        this.addEvent('recording_paused');
        logger.info('Recording paused');
      } else if (this.mode === 'livestream') {
        await this.obs.call('SetCurrentProgramScene', { sceneName: PAUSE_SCENE_NAME });
        this.addEvent('stream_paused');
        logger.info('Stream paused (switched to pause scene)');
      }
    } catch (error) {
      logger.error('Failed to pause production:', error);
    }
  }

  /**
   * Resume production after a pause.
   * - Recording mode: ResumeRecord
   * - Livestream mode: Switch back to game capture scene
   */
  async resumeProduction(): Promise<void> {
    if (!this.connected || !this.productionActive) return;

    try {
      if (this.mode === 'recording') {
        await this.obs.call('ResumeRecord');
        this.addEvent('recording_resumed');
        logger.info('Recording resumed');
      } else if (this.mode === 'livestream') {
        await this.obs.call('SetCurrentProgramScene', { sceneName: GAME_SCENE_NAME });
        this.addEvent('stream_resumed');
        logger.info('Stream resumed (switched to game scene)');
      }
    } catch (error) {
      logger.error('Failed to resume production:', error);
    }
  }

  /**
   * Stop production and write companion log file (for recording mode).
   */
  async stopProduction(): Promise<void> {
    if (!this.connected || !this.productionActive) return;

    try {
      if (this.mode === 'recording') {
        const response = await this.obs.call('StopRecord');
        this.addEvent('recording_stopped');

        // StopRecord returns the output path
        if (response.outputPath) {
          this.handleRecordingStopped(response.outputPath);
        }

        // Wait for OBS to fully finalize the recording
        for (let i = 0; i < 10; i++) {
          await this.sleep(200);
          const status = await this.obs.call('GetRecordStatus');
          if (!status.outputActive) break;
        }

        logger.info('Recording stopped');
      } else if (this.mode === 'livestream') {
        await this.obs.call('StopStream');
        this.addEvent('streaming_stopped');
        logger.info('Streaming stopped');
      }
      this.productionActive = false;
    } catch (error) {
      logger.error('Failed to stop production:', error);
      this.productionActive = false;
    }
  }

  /**
   * Add an event to the current recording's event log.
   * Called by strategist-session at key lifecycle points.
   */
  addEvent(type: string, details?: string): void {
    const event: ObsEvent = {
      type,
      at: new Date().toISOString(),
      ...(details && { details }),
    };
    this.events.push(event);
    logger.debug(`Event logged: ${type}${details ? ` (${details})` : ''}`);
  }

  /** Get all recording files tracked during this session. */
  getRecordingFiles(): RecordingFile[] {
    return [...this.recordingFiles];
  }

  /** Whether OBS is connected and operational. */
  isOperational(): boolean {
    return this.connected;
  }

  /** Whether production (recording/streaming) is active. */
  isProductionActive(): boolean {
    return this.productionActive;
  }

  /**
   * Cleanly disconnect and stop all OBS operations.
   */
  async destroy(): Promise<void> {
    this.stopHealthMonitor();

    if (this.productionActive) {
      try {
        await this.stopProduction();
      } catch {
        // Best-effort stop during destroy
      }
    }

    if (this.connected) {
      try {
        this.obs.removeAllListeners();
        await this.obs.disconnect();
      } catch {
        // Ignore disconnect errors during destroy
      }
      this.connected = false;
    }

    logger.info('OBS Manager destroyed');
  }

  // --- Private methods ---

  /** Connect to the OBS WebSocket server. */
  private async connect(): Promise<boolean> {
    const port = this.obsConfig?.wsPort ?? 4455;
    const password = this.obsConfig?.wsPassword;
    const url = `ws://127.0.0.1:${port}`;

    try {
      await this.obs.connect(url, password);
      this.connected = true;
      this.recoveryAttempts = 0;
      logger.info(`Connected to OBS WebSocket at ${url}`);
      return true;
    } catch (error) {
      logger.error(`Failed to connect to OBS WebSocket at ${url}:`, error);
      this.connected = false;
      return false;
    }
  }

  /**
   * Set up OBS scenes for game capture and pause screen.
   * Creates scenes and inputs if they don't already exist.
   */
  private async setupScenes(): Promise<void> {
    try {
      const { scenes } = await this.obs.call('GetSceneList');
      const sceneNames = scenes.map((s: any) => s.sceneName as string);

      // Create game capture scene if it doesn't exist
      if (!sceneNames.includes(GAME_SCENE_NAME)) {
        await this.obs.call('CreateScene', { sceneName: GAME_SCENE_NAME });
        logger.info(`Created scene: ${GAME_SCENE_NAME}`);

        // Add game capture input
        await this.obs.call('CreateInput', {
          sceneName: GAME_SCENE_NAME,
          inputName: GAME_CAPTURE_INPUT_NAME,
          inputKind: 'game_capture',
          inputSettings: {
            capture_mode: 'window',
            window: `${GAME_EXECUTABLE}:${GAME_EXECUTABLE}:${GAME_EXECUTABLE}`,
            priority: 2, // WINDOW_PRIORITY_EXE — match by executable name
          },
        });
        logger.info(`Created game capture input targeting ${GAME_EXECUTABLE}`);
      }

      // Create pause scene if it doesn't exist (for livestream mode)
      if (this.mode === 'livestream' && !sceneNames.includes(PAUSE_SCENE_NAME)) {
        await this.obs.call('CreateScene', { sceneName: PAUSE_SCENE_NAME });
        logger.info(`Created scene: ${PAUSE_SCENE_NAME}`);

        // Add pause image if configured
        const pauseImagePath = this.obsConfig?.pauseImagePath;
        if (pauseImagePath && fs.existsSync(pauseImagePath)) {
          await this.obs.call('CreateInput', {
            sceneName: PAUSE_SCENE_NAME,
            inputName: PAUSE_IMAGE_INPUT_NAME,
            inputKind: 'image_source',
            inputSettings: {
              file: pauseImagePath,
            },
          });
          logger.info(`Created pause image input: ${pauseImagePath}`);
        }
      }

      // Set game capture scene as the active scene
      await this.obs.call('SetCurrentProgramScene', { sceneName: GAME_SCENE_NAME });
      logger.info(`Active scene set to: ${GAME_SCENE_NAME}`);
    } catch (error) {
      logger.error('Failed to set up OBS scenes:', error);
    }
  }

  /** Handle recording file path when recording stops. */
  private handleRecordingStopped(outputPath: string): void {
    if (this.currentRecording) {
      this.currentRecording.path = outputPath;
      this.currentRecording.stoppedAt = new Date();

      // Derive log file path from video file path
      const parsed = path.parse(outputPath);
      this.currentRecording.logPath = path.join(parsed.dir, `${parsed.name}.log.json`);

      // Write companion log file
      this.writeRecordingLog(this.currentRecording);

      this.recordingFiles.push(this.currentRecording);
      this.currentRecording = undefined;
    }
  }

  /** Write the companion .log.json file alongside the recording. */
  private writeRecordingLog(recording: RecordingFile): void {
    try {
      const logData: RecordingLog = {
        videoFile: path.basename(recording.path),
        configName: this.configName,
        productionMode: this.mode,
        startedAt: recording.startedAt.toISOString(),
        stoppedAt: recording.stoppedAt?.toISOString() || new Date().toISOString(),
        events: [...this.events],
      };

      fs.writeFileSync(recording.logPath, JSON.stringify(logData, null, 2));
      logger.info(`Recording log written: ${recording.logPath}`);

      // Clear events for next recording
      this.events = [];
    } catch (error) {
      logger.error('Failed to write recording log:', error);
    }
  }

  /** Check if OBS is currently running. */
  private isObsRunning(): boolean {
    if (process.platform !== 'win32') return false;
    try {
      const output = execSync(
        'tasklist /FI "IMAGENAME eq obs64.exe" /FO CSV',
        { encoding: 'utf-8' }
      );
      return output.includes('obs64.exe');
    } catch {
      return false;
    }
  }

  /** Launch OBS Studio as a detached process. */
  private launchObs(): boolean {
    const executablePath = this.obsConfig?.executablePath || DEFAULT_OBS_PATH;

    if (!fs.existsSync(executablePath)) {
      logger.error(`OBS executable not found: ${executablePath}`);
      return false;
    }

    const args = ['--minimize-to-tray'];
    if (this.obsConfig?.profile) {
      args.push('--profile', this.obsConfig.profile);
    }
    if (this.obsConfig?.sceneCollection) {
      args.push('--collection', this.obsConfig.sceneCollection);
    }
    if (this.obsConfig?.scene) {
      args.push('--scene', this.obsConfig.scene);
    }

    try {
      const child = spawn(executablePath, args, {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      logger.info(`Launched OBS Studio: ${executablePath}`);
      return true;
    } catch (error) {
      logger.error('Failed to launch OBS:', error);
      return false;
    }
  }

  /** Start periodic health monitoring. */
  private startHealthMonitor(): void {
    this.healthInterval = setInterval(async () => {
      await this.healthCheck();
    }, HEALTH_POLL_INTERVAL);
  }

  /** Stop health monitoring. */
  private stopHealthMonitor(): void {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = undefined;
    }
  }

  /** Check OBS connection health and attempt recovery if needed. */
  private async healthCheck(): Promise<void> {
    try {
      await this.obs.call('GetVersion');
      // Connection is healthy
    } catch {
      logger.warn('OBS health check failed — connection lost');
      this.connected = false;

      if (this.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
        logger.error(`OBS recovery failed after ${MAX_RECOVERY_ATTEMPTS} attempts — giving up`);
        this.stopHealthMonitor();
        return;
      }

      this.recoveryAttempts++;
      logger.info(`Attempting OBS recovery (attempt ${this.recoveryAttempts}/${MAX_RECOVERY_ATTEMPTS})`);

      // Check if OBS process is still running
      if (!this.isObsRunning()) {
        logger.warn('OBS process not found — attempting to relaunch');
        const launched = this.launchObs();
        if (!launched) {
          logger.error('Failed to relaunch OBS');
          return;
        }
        await this.sleep(3000);
      }

      // Try to reconnect
      const reconnected = await this.connect();
      if (reconnected && this.productionActive) {
        // Restart production after recovery
        try {
          if (this.mode === 'recording') {
            await this.obs.call('StartRecord');
            this.currentRecording = {
              path: '',
              startedAt: new Date(),
              logPath: '',
            };
            this.addEvent('recording_restarted_after_recovery');
          } else if (this.mode === 'livestream') {
            await this.obs.call('StartStream');
            this.addEvent('streaming_restarted_after_recovery');
          }
          logger.info('Production restarted after OBS recovery');
        } catch (error) {
          logger.error('Failed to restart production after recovery:', error);
        }
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Singleton ObsManager instance.
 *
 * @example
 * ```typescript
 * import { obsManager } from './infra/obs-manager.js';
 *
 * const ready = await obsManager.initialize('recording', config.obs, configName);
 * if (ready) await obsManager.startProduction();
 * ```
 */
export const obsManager = new ObsManager();
