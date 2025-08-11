# Bridge Service Test Setup

This directory contains the test setup for the Bridge Service, including support for both mock and real DLL server testing.

## Test Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests with default settings (mock mode) |
| `npm run test:mock` | Run tests using mock DLL server |
| `npm run test:real` | Run tests against real Civ5 DLL (requires game running) |
| `npm run test:mock-watch` | Watch mode with mock server |
| `npm run test:watch` | Default watch mode |
| `npm run test:coverage` | Run tests with coverage report |

## Mock vs Real Server

The test suite uses an environment variable `USE_MOCK` to switch between testing modes:

- **Mock Mode** (`USE_MOCK=true`, default): Uses the mock DLL server for testing
- **Real Mode** (`USE_MOCK=false`): Tests against actual Civilization V DLL

### Mock Mode (Default)
- Fast execution
- No external dependencies
- Consistent, predictable behavior
- Ideal for CI/CD pipelines

### Real Mode
- Tests actual integration with Civ5
- Requires Civilization V running with Community Patch
- Slower execution due to actual game interaction
- Best for integration testing

## Test Structure

- `setup.ts` - Global test configuration and environment setup
- `connection.test.ts` - Basic connection and functionality tests
- `vitest.config.ts` - Vitest configuration with extended timeouts for IPC operations

## Running Tests

### Basic Connection Test
```bash
# Test with mock server (default)
npm run test:mock

# Test with real Civ5 DLL (make sure game is running)
npm run test:real
```

### Development Workflow
```bash
# Start mock server in one terminal
npm run mock

# Run bridge service with mock in another terminal  
npm run dev:with-mock

# Run tests in watch mode in a third terminal
npm run test:mock-watch
```

## Test Features

- **Extended Timeouts**: 15-second timeouts for IPC operations
- **Automatic Retry**: Tests retry once in CI environments
- **Environment Detection**: Automatically detects and reports test mode
- **Clean Setup/Teardown**: Proper mock server lifecycle management
- **TypeScript Support**: Full type checking and IntelliSense support