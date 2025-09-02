### Prompt for Generating Markdown Documents


### Prompt for Generating Event Definitions
- Read through each MD file in mcp-server/docs/events/md and dispatch a subagent for it
- For each event, generate a Typescript definition file that
  - Strictly follow the order and type of event arguments
  - Use PascalCase naming convention with sensible/reasonable names for each argument
  - Add comments to the interface and member definitions
  - Do not add extra definitions/types/whatever, do not overthink
  - When dispatching subagents, send them these exact instructions