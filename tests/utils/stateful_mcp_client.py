# tests/utils/stateful_mcp_client.py

import asyncio
import json
import threading
from typing import Any

from mcp.client.session import ClientSession
from mcp.client.streamable_http import streamablehttp_client
from mcp.types import TextContent

from src.config import settings


class StatefulMCPClient:
    def __init__(self, base_url=settings.bridge_url):
        self.base_url = base_url
        self.mcp_url = f"{base_url}/mcp/?transport=stateful"

        # Background worker state
        self._loop: asyncio.AbstractEventLoop | None = None
        self._thread: threading.Thread | None = None
        self._command_queue: asyncio.Queue[Any] | None = None
        self._ready = threading.Event()
        self._worker_task: Any = None

    def _ensure_worker(self):
        """Starts the background worker if not already running"""
        if self._thread is None:
            self._thread = threading.Thread(target=self._thread_entry, daemon=True)
            self._thread.start()
            self._ready.wait()

    def _thread_entry(self):
        """Thread entry point: runs the worker coroutine"""
        asyncio.run(self._worker())

    async def _worker(self):
        """Persistent worker task that manages the connection lifecycle"""
        self._loop = asyncio.get_running_loop()
        self._command_queue = asyncio.Queue()
        self._ready.set()

        from contextlib import AsyncExitStack

        async with AsyncExitStack() as stack:
            print(f"  [CLIENT] Connecting to {self.mcp_url}...")

            # Connect (this task enters the context)
            streams = await stack.enter_async_context(streamablehttp_client(self.mcp_url))

            if isinstance(streams, tuple):
                read_stream, write_stream = streams[:2]
            else:
                raise ValueError(f"Unexpected stream return type: {type(streams)}")

            session = await stack.enter_async_context(ClientSession(read_stream, write_stream))
            await session.initialize()

            # Request loop
            while True:
                cmd, name, args, future = await self._command_queue.get()

                if cmd == "call":
                    try:
                        result = await session.call_tool(name, args or {})
                        # Parse content
                        first = result.content[0] if result.content else None
                        if isinstance(first, TextContent):
                            raw_text = first.text
                            if not raw_text or not raw_text.strip():
                                future.set_result(
                                    {
                                        "status": "error",
                                        "message": f"Empty response from Blender for tool '{name}'. Check Blender console for errors.",
                                    }
                                )
                            else:
                                try:
                                    parsed = json.loads(raw_text)
                                    future.set_result(parsed)
                                except json.JSONDecodeError as e:
                                    future.set_result(
                                        {
                                            "status": "error",
                                            "message": f"Invalid JSON from Blender for tool '{name}': {e}. Raw: {raw_text[:200]}",
                                        }
                                    )
                        else:
                            future.set_result({"status": "success", "raw": str(result.content)})
                    except Exception as e:
                        future.set_exception(e)

                elif cmd == "close":
                    # This task will now exit the context
                    future.set_result(None)
                    break

                self._command_queue.task_done()

    async def call_tool_async(self, name, arguments=None):
        """Async tool call (Thread-safe dispatch to worker)"""
        self._ensure_worker()

        # Dispatch to worker thread and wait for it
        assert self._loop is not None
        item_future = asyncio.run_coroutine_threadsafe(
            self._dispatch_to_worker("call", name, arguments), self._loop
        )
        # Wrap concurrent.futures.Future for the current loop
        return await asyncio.wrap_future(item_future)

    def call_tool(self, name, arguments=None):
        """Synchronous tool call (dispatches to worker)"""
        self._ensure_worker()

        # Create a future that works across threads
        # We need to be careful here: self._loop is for the worker thread
        # We use a threadsafe future
        assert self._loop is not None
        item_future = asyncio.run_coroutine_threadsafe(
            self._dispatch_to_worker("call", name, arguments), self._loop
        )
        result = item_future.result()
        status = result.get("status", "ok")
        emoji = "OK " if status == "success" else "X "
        print(f"  [CLIENT] {name}: {emoji}{status}")
        if status == "error":
            print(f"    Error: {result.get('error')}")
            print(f"    Message: {result.get('message')}")
        return result

    async def _dispatch_to_worker(self, cmd, name=None, args=None):
        """Helper to push to the worker queue from within the same loop"""
        assert self._loop is not None
        assert self._command_queue is not None
        future = self._loop.create_future()
        await self._command_queue.put((cmd, name, args, future))
        return await future

    async def aclose(self):
        """Explicitly close by signaling the worker to exit (Thread-safe)"""
        if self._command_queue:
            assert self._loop is not None
            item_future = asyncio.run_coroutine_threadsafe(
                self._dispatch_to_worker("close"), self._loop
            )
            await asyncio.wrap_future(item_future)

    def close(self):
        """Synchronous close"""
        if self._loop and self._loop.is_running():
            future = asyncio.run_coroutine_threadsafe(self.aclose(), self._loop)
            future.result()
            # The worker thread will exit naturally when the coroutine finishes
            if self._thread is not None:
                self._thread.join(timeout=2.0)
            self._thread = None
            self._loop = None

    def __del__(self):
        """Graceful ish cleanup"""
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(self.aclose(), self._loop)
