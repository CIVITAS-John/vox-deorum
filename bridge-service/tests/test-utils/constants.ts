/**
 * Test constants and configuration
 */

export const TEST_PORTS = {
  MOCK_EXTERNAL_SERVICE: 19876,
  MOCK_EXTERNAL_SERVICE_2: 19877,
};

export const TEST_TIMEOUTS = {
  DEFAULT: 5000,
  SHORT: 2000,
  LONG: 10000,
  VERY_SHORT: 200,
};

export const TEST_URLS = {
  MOCK_SERVICE: `http://localhost:${TEST_PORTS.MOCK_EXTERNAL_SERVICE}/execute`,
  MOCK_SERVICE_2: `http://localhost:${TEST_PORTS.MOCK_EXTERNAL_SERVICE_2}/execute`,
};