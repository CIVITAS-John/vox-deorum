### Prompt for Generating Markdown Documents
- Read through each JSON file in `mcp-server/docs/events/json` and dispatch a subagent for it
- Review the source code that triggers the event
- For each event, generate a Markdown document in `mcp-server/docs/events/md` that has the following sections:
```
# Overview
# Event Triggers
# Parameters
# Event Details
# Technical Details
```
- Do not add or remove sections from it.
- When dispatching subagents, send them these exact instructions

### Prompt for Generating Event Definitions
- Read through each MD file in `mcp-server/docs/events/md` and dispatch a subagent for it
- For each event, generate a Typescript definition file in `mcp-server/src/knowledge/schema/events` that
  - Strictly follow the order and type of event arguments
  - Use PascalCase naming convention with sensible/reasonable names for each argument
  - Add comments to the interface and member definitions
  - Do not add extra definitions/types/whatever, do not overthink
  - When dispatching subagents, send them these exact instructions