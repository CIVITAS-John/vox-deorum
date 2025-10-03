/**
 * Configuration test - Tests for configuration loading and validation
 */

import { describe, it, expect } from 'vitest';
import { config } from '../../src/utils/config.js';

// Configuration verification (supporting all connection tests)
describe('Configuration', () => {
  // Configuration loading and validation
  it('should verify configuration is properly loaded', async () => {
    // Verify configuration is loaded
    expect(config).toBeDefined();
    expect(config.rest.port).toBeTypeOf('number');
    expect(config.gamepipe.id).toBeTypeOf('string');
    expect(config.rest.host).toBeTypeOf('string');
    
    console.log('⚙️ Bridge service config:', {
      port: config.rest.port,
      host: config.rest.host,
      gamepipeId: config.gamepipe.id
    });
  });
});