# Bridge Service

### Reading
- Due to the ESM import reasons, when you see `import from '*.js'`, read the corresponding .ts file instead.

### Testing
- Use Vitest, not JEST, for testing
- Test files should be in `tests/` directory with `.test.ts` extension
- Run tests with `npm test`, watch mode with `npm run test:watch`, coverage with `npm run test:coverage`
- Test setup file is at `tests/setup.ts` for global test configuration