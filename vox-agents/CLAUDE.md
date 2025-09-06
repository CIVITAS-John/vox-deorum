# MCP Server - Claude Instructions

## Development Guidelines

### Testing
- Use Vitest for all testing (not Jest)
- Test files should be in `tests/` directory with `.test.ts` extension
- Run tests with `npm test`, watch mode with `npm run test:watch`, coverage with `npm run test:coverage`
- Test setup file is at `tests/setup.ts` for global test configuration

### TypeScript & ESM
- Project uses ESM modules ("type": "module" in package.json)
- When importing local files, use `.js` extensions in imports even for `.ts` files
- Follow strict TypeScript configuration for type safety

### Code Structure
- Source code in `src/` directory
- Utilities in `src/utils/` subdirectory  
- Tests mirror source structure in `tests/` directory
- Built output goes to `dist/` directory (gitignored)

### Build & Development
- `npm run dev` - Development with hot reload using tsx
- `npm run build` - TypeScript compilation to dist/
- `npm run type-check` - TypeScript type checking without emit
- `npm run lint` - ESLint code quality checks

### Integration with MCP Server
- Always read `mcp-server/src/tools/index.ts` to understand which tools actually exist