import os

from dotenv import load_dotenv

load_dotenv()


class Config:
    def __init__(self):
        # 1. MCP Bridge Server (Python Gateway)
        # Naming: MCP_BRIDGE_HOST (Strict) -> BRIDGE_HOST (Previous) -> 0.0.0.0 (Default)
        self.bridge_host = os.getenv("MCP_BRIDGE_HOST") or os.getenv("BRIDGE_HOST") or "0.0.0.0"

        # Naming: MCP_BRIDGE_PORT (Strict) -> BRIDGE_PORT (Previous) -> 8008 (Default)
        self.bridge_port = int(os.getenv("MCP_BRIDGE_PORT") or os.getenv("BRIDGE_PORT") or "8008")

        # 2. Blender MCP Addon (Inside Blender)
        # Naming: BLENDER_ADDON_HOST (Strict) -> BLENDER_MCP_HOST (Previous) -> 127.0.0.1 (Default)
        self.addon_host = (
            os.getenv("BLENDER_ADDON_HOST") or os.getenv("BLENDER_MCP_HOST") or "127.0.0.1"
        )

        # Naming: BLENDER_ADDON_PORT (Strict) -> BLENDER_MCP_PORT (Previous) -> 8888 (Default)
        self.addon_port = int(
            os.getenv("BLENDER_ADDON_PORT") or os.getenv("BLENDER_MCP_PORT") or "8888"
        )

        # 3. Assets
        self.assets_dir = os.getenv("BLENDER_ASSETS_DIR")

    @property
    def bridge_url(self):
        """URL used by clients (n8n, Session Editor, Playback) to connect to the Bridge"""
        host = "localhost" if self.bridge_host == "0.0.0.0" else self.bridge_host
        return f"http://{host}:{self.bridge_port}"


settings = Config()
