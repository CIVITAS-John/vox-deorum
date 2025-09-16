# Clean up log files
echo "Cleaning up log files..."
rm -rf ../bridge-service/logs/* 2>/dev/null
rm -rf ../mcp-server/logs/* 2>/dev/null
rm -rf ../vox-agents/logs/* 2>/dev/null
echo "Log files cleaned."
