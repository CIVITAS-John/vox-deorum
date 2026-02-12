/**
 * Test setup file for Vox Agents
 * Configures the test environment and sets up global test utilities.
 * Includes a global guard that aborts all tests if CivilizationV.exe is already running,
 * since only one instance can run at a time and we must not kill an active game session.
 */
import { execSync } from 'child_process';
import "../src/utils/config.js";

// Set default test environment variables if not already set
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// Set up test logging to reduce noise
if (!process.env.LOG_LEVEL) {
  process.env.LOG_LEVEL = 'error';
}

// Global guard: abort all tests if CivilizationV.exe is already running.
// Only one Civ5 instance can run at a time. If one is already active, it may be
// a live game session — we must not kill it, so we abort tests instead.
if (process.platform === 'win32') {
  try {
    const output = execSync(
      'tasklist /FI "IMAGENAME eq CivilizationV.exe" /FO CSV',
      { encoding: 'utf-8' }
    );
    if (output.includes('CivilizationV.exe')) {
      console.error('\n' + '='.repeat(70));
      console.error('ABORTING TEST SUITE: CivilizationV.exe is already running.');
      console.error('');
      console.error('Only one Civilization V instance can run at a time.');
      console.error('The running instance may be an active game session.');
      console.error('Please close Civilization V before running tests.');
      console.error('='.repeat(70) + '\n');
      process.exit(1);
    }
  } catch {
    // tasklist command failed — safe to continue.
    // Game tests will fail on their own if Civ5 is needed but unavailable.
  }
}