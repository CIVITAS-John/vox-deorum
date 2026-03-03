Generate a version log for the new version: $ARGUMENTS

Steps:
1. Read `release.txt` to get the last documented version tag (e.g. `v0.7.0`).
2. Run the following git commands to gather all changes since that tag:
   - `git log <last-tag>..HEAD --oneline --no-merges`
   - `git diff --stat <last-tag>..HEAD`
3. Analyze the output and group commits by component or theme (e.g. Bridge Service, MCP Server, Vox Agents, Civ5 DLL, Mod, Infra/Build).
4. Create the directory `docs/versions/` if it does not exist, then write a full structured version log to `docs/versions/$ARGUMENTS.md` with this structure:
   - A heading with the version and today's date
   - Grouped sections by component/theme, each with bullet points describing meaningful changes
   - A "File Changes" section summarizing the diff stat output
5. DO NOT Update `release.txt`.
6. After writing the file, output a succinct GitHub release note to the console. It should be:
   - Raw Markdown
   - A handful of bullet items grouped by feature/theme (not exhaustive)