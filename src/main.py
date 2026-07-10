# src/main.py

import asyncio
import logging
import socket
import threading

import click
import uvicorn

from .config import settings
from .sessions import BridgeSession, SessionMetadata, SessionPlayer, SessionRecorder

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("mcp_server")


def _blender_health_check(host: str, port: int, interval: int = 5):
    """Background thread: logs when Blender addon connects or disconnects."""
    was_connected = None
    while True:
        try:
            s = socket.create_connection((host, port), timeout=2)
            s.close()
            connected = True
        except OSError:
            connected = False

        if connected != was_connected:
            if connected:
                logger.info(f"[Blender] 🟢 Connected to addon at {host}:{port}")
            else:
                logger.warning(f"[Blender] 🔴 Disconnected — addon not reachable at {host}:{port}")
            was_connected = connected

        threading.Event().wait(interval)


@click.group()
def cli():
    """Blender MCP Bridge CLI"""
    pass


@cli.command()
@click.option("--host", default=settings.bridge_host, help="Host to bind the server to")
@click.option("--port", default=settings.bridge_port, help="Port to bind the server to")
@click.option(
    "--record",
    "record_path",
    type=click.Path(),
    help="Path to record the session to (JSON)",
)
@click.option("--name", default="Recorded Session", help="Session name")
@click.option("--model", default="", help="AI model name used")
@click.option("--description", default="", help="Session description")
@click.option("--url", "doc_url", default="", help="Documentation URL")
def serve(host, port, record_path, name, model, description, doc_url):
    """Start the Blender MCP server"""
    import src.server as server_mod

    if record_path:
        metadata = SessionMetadata(
            name=name, model=model, description=description, documentation_url=doc_url
        )
        server_mod.recorder = SessionRecorder(record_path, metadata)
        print(f"RECORDER ACTIVE: Saving to {record_path}")

    print("============================================================")
    print("Starting High-Stability n8n MCP Server (Modular)")
    print(f"HTTP Streamable: http://{host}:{port}/mcp")
    print("============================================================")

    # Start Blender addon health check in background
    t = threading.Thread(
        target=_blender_health_check,
        args=(settings.addon_host, settings.addon_port),
        daemon=True,
    )
    t.start()

    uvicorn.run(server_mod.app, host=host, port=port, log_level="warning", access_log=False)


@cli.command()
@click.argument("path", type=click.Path(exists=True))
@click.option(
    "--transport",
    type=click.Choice(["stateless", "stateful"]),
    default="stateful",
    help="Transport mode to use",
)
@click.option("--host", default=settings.bridge_url, help="Target MCP Server URL")
def play(path, transport, host):
    """Playback a recorded session JSON file"""
    print(f"Playing back session from {path}...")
    session = BridgeSession.load(path)
    player = SessionPlayer(transport=transport, host=host)
    asyncio.run(player.play(session))


if __name__ == "__main__":
    cli()
