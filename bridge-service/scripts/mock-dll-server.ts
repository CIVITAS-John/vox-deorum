/**
 * Mock DLL Server - Simulates the Community Patch DLL for testing
 * 
 * This server implements the same IPC protocol as the real DLL, allowing
 * the bridge service to be tested without the actual Civilization V game.
 */

import ipc from 'node-ipc';
import { EventEmitter } from 'events';
import { createLogger } from '../src/utils/logger';
import {
  IPCMessage,
  GameEventMessage
} from '../src/types/event';
import {
  LuaCallMessage,
  LuaResponseMessage,
  LuaRegisterMessage
} from '../src/types/lua';
import {
  ExternalRegisterMessage,
  ExternalUnregisterMessage,
  ExternalCallMessage,
  ExternalResponseMessage
} from '../src/types/external';

const logger = createLogger('MockDLL');

/**
 * Mock DLL Server configuration
 */
export interface MockDLLConfig {
  id: string;
  simulateDelay?: boolean;
  responseDelay?: number;
  autoEvents?: boolean;
  eventInterval?: number;
}

/**
 * Mock DLL Server class
 */
export class MockDLLServer extends EventEmitter {
  private config: MockDLLConfig;
  private isRunning: boolean = false;
  private eventTimer?: NodeJS.Timeout;
  private registeredFunctions: Set<string> = new Set();

  constructor(config: MockDLLConfig) {
    super();
    this.config = {
      simulateDelay: true,
      responseDelay: 50,
      autoEvents: false,
      eventInterval: 5000,
      ...config
    };
    this.setupIPC();
  }

  /**
   * Configure IPC settings
   */
  private setupIPC(): void {
    ipc.config.id = this.config.id;
    ipc.config.retry = 1500;
    ipc.config.maxRetries = false;
    ipc.config.silent = true;
    ipc.config.rawBuffer = false;
    ipc.config.encoding = 'utf8';
  }

  /**
   * Start the mock server
   */
  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isRunning) {
        resolve();
        return;
      }

      logger.info(`Starting mock DLL server with ID: ${this.config.id}`);

      ipc.serve(() => {
        logger.info('Mock DLL server started successfully');
        this.isRunning = true;
        this.setupMessageHandlers();
        
        if (this.config.autoEvents) {
          this.startAutoEvents();
        }
        
        this.emit('started');
        resolve();
      });

      ipc.server.on('error', (error: any) => {
        logger.error('Mock DLL server error:', error);
        reject(error);
      });

      ipc.server.start();
    });
  }

  /**
   * Setup message handlers
   */
  private setupMessageHandlers(): void {
    ipc.server.on('message', (data: any, socket: any) => {
      logger.debug('Received message from bridge:', data);
      this.handleMessage(data, socket);
    });

    ipc.server.on('connect', (socket: any) => {
      logger.info('Bridge service connected to mock DLL');
      this.emit('client_connected', socket);
    });

    ipc.server.on('socket.disconnected', (socket: any) => {
      logger.info('Bridge service disconnected from mock DLL');
      this.emit('client_disconnected', socket);
    });
  }

  /**
   * Handle incoming messages from bridge service
   */
  private async handleMessage(message: any, socket: any): Promise<void> {
    try {
      // Parse message if it's a string
      let data: IPCMessage;
      if (typeof message === 'string') {
        try {
          data = JSON.parse(message);
        } catch (parseError) {
          logger.error('Failed to parse JSON message:', parseError);
          return;
        }
      } else {
        data = message;
      }

      // Simulate processing delay
      if (this.config.simulateDelay && this.config.responseDelay) {
        await new Promise(resolve => setTimeout(resolve, this.config.responseDelay));
      }

      // Route based on message type
      switch (data.type) {
        case 'lua_call':
          await this.handleLuaCall(data as LuaCallMessage, socket);
          break;
        case 'external_register':
          await this.handleExternalRegister(data as ExternalRegisterMessage, socket);
          break;
        case 'external_unregister':
          await this.handleExternalUnregister(data as ExternalUnregisterMessage, socket);
          break;
        case 'external_response':
          await this.handleExternalResponse(data as ExternalResponseMessage, socket);
          break;
        default:
          logger.warn('Unknown message type from bridge:', data.type);
      }
    } catch (error) {
      logger.error('Failed to handle message:', error);
    }
  }

  /**
   * Handle Lua function calls
   */
  private async handleLuaCall(data: LuaCallMessage, _socket: any): Promise<void> {
    logger.debug('Processing Lua call:', data.function);

    // Define known mock functions
    const knownFunctions = new Set([
      'GetPlayerName',
      'GetCurrentTurn', 
      'GetCityCount',
      'GetGameState'
    ]);

    let response: LuaResponseMessage;

    // Check if function exists
    if (!knownFunctions.has(data.function)) {
      // Return error for unknown functions
      response = {
        type: 'lua_response',
        id: data.id!,
        success: false,
        error: {
          code: 'FUNCTION_NOT_FOUND',
          message: `Function '${data.function}' is not available in the mock DLL`
        }
      };
    } else {
      // Mock different Lua functions with appropriate responses
      let result: any;
      switch (data.function) {
        case 'GetPlayerName':
          result = 'Mock Player';
          break;
        case 'GetCurrentTurn':
          result = Math.floor(Date.now() / 1000) % 500; // Mock turn number
          break;
        case 'GetCityCount':
          result = 3;
          break;
        case 'GetGameState':
          result = {
            turn: Math.floor(Date.now() / 1000) % 500,
            era: 'Classical Era',
            player: 'Mock Player',
            cities: 3,
            units: 8
          };
          break;
      }

      response = {
        type: 'lua_response',
        id: data.id!,
        success: true,
        result
      };
    }

    this.sendMessage(response, _socket);
  }

  /**
   * Handle external function registration
   */
  private async handleExternalRegister(data: ExternalRegisterMessage, _socket: any): Promise<void> {
    logger.info(`Registering external function: ${data.name}`);
    this.registeredFunctions.add(data.name);

    const response: LuaResponseMessage = {
      type: 'lua_response',
      id: data.id!,
      success: true,
      result: { registered: true }
    };

    this.sendMessage(response, _socket);
  }

  /**
   * Handle external function unregistration
   */
  private async handleExternalUnregister(data: ExternalUnregisterMessage, _socket: any): Promise<void> {
    logger.info(`Unregistering external function: ${data.name}`);
    this.registeredFunctions.delete(data.name);

    const response: LuaResponseMessage = {
      type: 'lua_response',
      id: data.id!,
      success: true,
      result: { unregistered: true }
    };

    this.sendMessage(response, _socket);
  }

  /**
   * Handle external function response
   */
  private async handleExternalResponse(data: ExternalResponseMessage, _socket: any): Promise<void> {
    logger.debug('Received external function response:', data.id);
    // In a real scenario, this would complete a pending external call
    // For the mock, we just log it
  }

  /**
   * Send message to bridge service
   */
  private sendMessage(message: IPCMessage, socket?: any): void {
    try {
      if (socket) {
        ipc.server.emit(socket, 'message', message);
      } else {
        ipc.server.broadcast('message', message);
      }
      logger.debug('Sent message to bridge:', message);
    } catch (error) {
      logger.error('Failed to send message to bridge:', error);
    }
  }

  /**
   * Simulate external function call
   */
  public simulateExternalCall(functionName: string, args: any = {}): void {
    if (!this.registeredFunctions.has(functionName)) {
      logger.warn(`Cannot simulate call to unregistered function: ${functionName}`);
      return;
    }

    const message: ExternalCallMessage = {
      type: 'external_call',
      id: `mock_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      function: functionName,
      args,
      async: true
    };

    logger.info(`Simulating external call: ${functionName}`);
    this.sendMessage(message);
  }

  /**
   * Simulate game event
   */
  public simulateGameEvent(eventType: string, payload: any = {}): void {
    const message: GameEventMessage = {
      type: 'game_event',
      event: eventType,
      payload,
      timestamp: new Date().toISOString()
    };

    logger.info(`Simulating game event: ${eventType}`);
    this.sendMessage(message);
  }

  /**
   * Simulate Lua register event
   */
  public simulateLuaRegister(functionName: string, description?: string): void {
    const message: LuaRegisterMessage = {
      type: 'lua_register',
      function: functionName,
      description
    };

    logger.info(`Simulating Lua register: ${functionName}`);
    this.sendMessage(message);
  }

  /**
   * Send a raw message to the bridge service (for testing purposes)
   */
  public sendRawMessage(message: IPCMessage): void {
    logger.info(`Sending raw message: ${message.type}`);
    this.sendMessage(message);
  }

  /**
   * Start automatic event generation
   */
  private startAutoEvents(): void {
    if (this.eventTimer) {
      clearInterval(this.eventTimer);
    }

    this.eventTimer = setInterval(() => {
      // Simulate random game events
      const events = [
        { type: 'turn_complete', payload: { turn: Math.floor(Date.now() / 1000) % 500 } },
        { type: 'city_founded', payload: { cityName: 'Mock City', player: 'Mock Player' } },
        { type: 'unit_moved', payload: { unitType: 'Warrior', position: [10, 15] } },
        { type: 'tech_researched', payload: { tech: 'Bronze Working', player: 'Mock Player' } }
      ];

      const randomEvent = events[Math.floor(Math.random() * events.length)];
      this.simulateGameEvent(randomEvent.type, randomEvent.payload);
    }, this.config.eventInterval);

    logger.info(`Started auto events with interval: ${this.config.eventInterval}ms`);
  }

  /**
   * Stop the mock server
   */
  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isRunning) {
        resolve();
        return;
      }

      logger.info('Stopping mock DLL server');

      if (this.eventTimer) {
        clearInterval(this.eventTimer);
        this.eventTimer = undefined;
      }

      ipc.server.stop();
      this.isRunning = false;
      this.registeredFunctions.clear();
      
      this.emit('stopped');
      resolve();
    });
  }

  /**
   * Get server status
   */
  public getStatus(): {
    running: boolean;
    registeredFunctions: string[];
    autoEvents: boolean;
  } {
    return {
      running: this.isRunning,
      registeredFunctions: Array.from(this.registeredFunctions),
      autoEvents: !!this.eventTimer
    };
  }
}

/**
 * Create and start a mock DLL server
 */
export async function createMockDLLServer(config: MockDLLConfig): Promise<MockDLLServer> {
  const server = new MockDLLServer(config);
  await server.start();
  return server;
}

/**
 * Default mock server factory for tests
 */
export async function createTestMockDLL(): Promise<MockDLLServer> {
  return createMockDLLServer({
    id: 'civ5',
    simulateDelay: true,
    responseDelay: 50,
    autoEvents: false
  });
}