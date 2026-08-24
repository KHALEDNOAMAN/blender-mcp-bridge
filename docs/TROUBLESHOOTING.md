# Troubleshooting Guide

## Common Issues

### 1. Blender Won't Connect to MCP
**Symptom**: "Connection refused" when starting the bridge.

**Fix**:
- Ensure Blender is running **before** starting the bridge
- Check that the MCP port (default: 3000) is not in use:
  ```bash
  lsof -i :3000   # macOS/Linux
  netstat -an | findstr 3000   # Windows
  ```
- Verify the Blender addon is enabled: Edit → Preferences → Add-ons → Search "MCP"

### 2. Python Version Mismatch
**Symptom**: `ModuleNotFoundError` on startup.

**Fix**:
```bash
python --version    # Needs 3.9+
pip install -r requirements.txt
```

### 3. AI Provider Not Responding
| Provider | Check | Fix |
|----------|-------|-----|
| Claude | API key in `.env` | Verify at console.anthropic.com |
| Gemini | API key in `.env` | Verify at aistudio.google.com |
| OpenRouter | API key + model ID | Check model availability |

### 4. Session Replay Fails
- Ensure `session.json` was created with the same Blender version
- Check file paths are relative, not absolute
- Try replaying with `--verbose` flag for debug output

### 5. 3D Print Prep Issues
- **Non-manifold geometry**: Use Blender's 3D Print Toolbox addon to check
- **Scale wrong**: Ensure units are set to Metric in Scene Properties
- **STL export fails**: Check for overlapping faces with Mesh → Clean Up

## Performance Tips
- Close unused Blender viewports to reduce memory
- For large scenes, disable real-time preview in render settings
- Use `--background` flag for headless batch processing

## Getting Help
- Open an issue with your Blender version, OS, and error log
- Include the output of `python -m blender_mcp --version`
