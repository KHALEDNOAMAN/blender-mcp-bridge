# src/assistant.py
#
# AI Assistant endpoints for Studio: a provider-agnostic agent loop that
# drives Blender through the same tool set the MCP server exposes.
#
# Endpoints (registered in server.py):
#   GET  /assistant/providers  -> which providers are configured + models
#   POST /assistant/chat       -> NDJSON event stream of an agent turn
#   POST /assistant/upload     -> save an uploaded model file under ASSETS_DIR
#
# Providers: anthropic (official SDK), google (Gemini REST), openrouter
# (OpenAI-compatible REST). API keys come from env vars, with an optional
# per-request override so a key can be pasted into the Studio UI when the
# bridge host has none configured.

import base64
import json
import logging
import os
import re
from typing import Any

import httpx
from starlette.datastructures import UploadFile
from starlette.requests import Request
from starlette.responses import JSONResponse, StreamingResponse

from .config import settings
from .connection import blender
from .tools import get_mcp_tools

logger = logging.getLogger("mcp_server")

MAX_AGENT_ITERATIONS = 30
MAX_TOOL_RESULT_CHARS = 20000  # cap what goes back to the model
UI_TOOL_RESULT_CHARS = 4000  # cap what streams to the browser

SYSTEM_PROMPT = """You are the Blender assistant inside Studio, driving a live Blender \
instance through tools. The user works in millimeters for 3D printing (scene unit scale \
0.001, METRIC/MILLIMETERS).

Guidelines:
- Before modifying an object, inspect the scene (get_scene_info / object queries) to learn \
its name, dimensions, and bounding box. Never guess positions.
- Modifications like adding a loop/handle: create the new geometry (e.g. a torus), size and \
position it against the target's bounding box, then boolean-union it into the target.
- MANDATORY before any STL/3MF export for printing: run repair_mesh, then \
check_mesh_for_printing and confirm the mesh is watertight with 0 degenerate faces. If not, \
remesh/repair and re-check before exporting.
- File paths: always use paths relative to the assets directory (never absolute paths).
- Keep the user informed: briefly say what you are about to do before a batch of tool calls, \
and summarize the outcome after.
- After significant geometry changes, call get_viewport_screenshot: the captured image is \
attached to the result so you can SEE the scene. Visually verify placement (nothing floating, \
parts attached) and fix problems before declaring the task done.
"""

PROVIDERS = {
    "anthropic": {
        "label": "Anthropic (Claude)",
        "env": ["ANTHROPIC_API_KEY"],
        "models": ["claude-opus-4-8", "claude-sonnet-5", "claude-haiku-4-5"],
    },
    "google": {
        "label": "Google (Gemini)",
        "env": ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
        "models": ["gemini-2.5-pro", "gemini-2.5-flash"],
    },
    "openrouter": {
        "label": "OpenRouter",
        "env": ["OPENROUTER_API_KEY"],
        "models": [
            "anthropic/claude-sonnet-4.5",
            "google/gemini-2.5-flash",
            "openai/gpt-4.1",
            "meta-llama/llama-3.3-70b-instruct",
        ],
    },
}


def _get_api_key(provider: str, override: str | None) -> str | None:
    if override:
        return override
    for var in PROVIDERS[provider]["env"]:
        val = os.getenv(var)
        if val:
            return val
    return None


# --- Blender tool execution (mirrors server.py call_tool flattening) ---------


def execute_blender_tool(name: str, args: dict) -> dict:
    """Send a tool call to Blender and normalize the response shape."""
    from . import server as server_mod  # late import to avoid circularity

    clean_args = server_mod.resolve_path(dict(args or {}))
    logger.info(f"[Assistant] Tool Call: {name} with params: {clean_args}")

    # Honor `serve --record`: assistant tool calls land in the session
    # recording just like MCP ones, so an AI-driven build can be replayed.
    if server_mod.recorder:
        server_mod.recorder.record_command(name, clean_args)
    try:
        res = blender.send_command(name, clean_args, "ASSIST")
    except Exception as e:  # connection errors etc.
        return {"status": "error", "error": str(e)}

    if isinstance(res, dict) and "result" in res and "status" in res:
        status_val = res["status"]
        res = res["result"]
        if isinstance(res, dict) and "status" not in res:
            res["status"] = status_val
    if res is None:
        res = {"status": "success", "message": f"{name} completed (no result returned)."}
    if not isinstance(res, dict):
        res = {"status": "success", "result": res}
    return res


def _tool_result_text(result: dict) -> str:
    text = json.dumps(result)
    if len(text) > MAX_TOOL_RESULT_CHARS:
        text = text[:MAX_TOOL_RESULT_CHARS] + '... (truncated)"}'
    return text


def _is_error_result(result: dict) -> bool:
    return bool(result.get("error")) or result.get("status") == "error"


MAX_IMAGE_BYTES = 4_000_000


def _load_image_b64(result: dict) -> str | None:
    """If a tool result points at a PNG on this machine (viewport screenshot,
    render), return it base64-encoded so the model can actually see it."""
    fp = result.get("filepath")
    if not (isinstance(fp, str) and fp.lower().endswith(".png") and os.path.exists(fp)):
        return None
    try:
        data = open(fp, "rb").read()
    except OSError:
        return None
    if not data or len(data) > MAX_IMAGE_BYTES:
        return None
    return base64.standard_b64encode(data).decode()


# --- Tool schema conversion ---------------------------------------------------


def _mcp_tools_raw() -> list[dict]:
    tools = []
    for t in get_mcp_tools():
        tools.append(
            {
                "name": t.name,
                "description": t.description or "",
                "schema": t.inputSchema or {"type": "object", "properties": {}},
            }
        )
    return tools


_GEMINI_ALLOWED_KEYS = {
    "type",
    "description",
    "properties",
    "required",
    "enum",
    "items",
    "format",
    "nullable",
}


def _sanitize_gemini_schema(schema):
    """Gemini's function-declaration schema is a subset of JSON Schema —
    strip unsupported keys recursively."""
    if isinstance(schema, dict):
        out = {}
        for k, v in schema.items():
            if k not in _GEMINI_ALLOWED_KEYS:
                continue
            if k == "properties" and isinstance(v, dict):
                out[k] = {pk: _sanitize_gemini_schema(pv) for pk, pv in v.items()}
            elif k == "items":
                out[k] = _sanitize_gemini_schema(v)
            else:
                out[k] = v
        return out
    return schema


# --- Event helpers -------------------------------------------------------------


def _ev(kind: str, **fields) -> str:
    return json.dumps({"type": kind, **fields}) + "\n"


def _tool_events(name: str, args: dict, result: dict):
    """Yield the tool_call/tool_result UI events for one execution."""
    yield _ev("tool_call", name=name, args=args)
    ui_result = json.dumps(result)
    if len(ui_result) > UI_TOOL_RESULT_CHARS:
        ui_result = ui_result[:UI_TOOL_RESULT_CHARS] + "... (truncated)"
    yield _ev("tool_result", name=name, ok=not _is_error_result(result), result=ui_result)


# --- Provider agent loops -------------------------------------------------------
# Each is a plain (sync) generator yielding NDJSON lines; Starlette's
# StreamingResponse iterates sync generators in a threadpool, so blocking
# HTTP/socket calls in here don't stall the event loop.


def _run_anthropic(api_key: str, model: str, history: list[dict]):  # noqa: C901
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)
    # Loosely typed on purpose: tool schemas come from MCP definitions and
    # message content mixes plain dicts with SDK response blocks.
    tools: list[Any] = [
        {"name": t["name"], "description": t["description"], "input_schema": t["schema"]}
        for t in _mcp_tools_raw()
    ]
    messages: list[Any] = [{"role": m["role"], "content": m["content"]} for m in history]

    for _ in range(MAX_AGENT_ITERATIONS):
        response = client.messages.create(
            model=model,
            max_tokens=8192,
            system=[
                {"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}
            ],
            thinking={"type": "adaptive"},
            tools=tools,
            messages=messages,
        )

        tool_uses = []
        for block in response.content:
            if block.type == "text" and block.text:
                yield _ev("text", text=block.text)
            elif block.type == "tool_use":
                tool_uses.append(block)

        if response.stop_reason == "refusal":
            yield _ev("error", message="The model declined this request.")
            return
        if response.stop_reason != "tool_use" or not tool_uses:
            return

        messages.append({"role": "assistant", "content": response.content})
        results = []
        for tu in tool_uses:
            result = execute_blender_tool(tu.name, tu.input or {})
            yield from _tool_events(tu.name, tu.input or {}, result)
            b64 = _load_image_b64(result)
            content: Any = _tool_result_text(result)
            if b64:
                # Attach the actual pixels so the model can see the viewport
                content = [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": "image/png", "data": b64},
                    },
                    {"type": "text", "text": _tool_result_text(result)},
                ]
            results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": tu.id,
                    "content": content,
                    "is_error": _is_error_result(result),
                }
            )
        messages.append({"role": "user", "content": results})

    yield _ev("error", message="Stopped: agent loop hit the iteration limit.")


def _run_google(api_key: str, model: str, history: list[dict]):  # noqa: C901
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    declarations = [
        {
            "name": t["name"],
            "description": t["description"],
            "parameters": _sanitize_gemini_schema(t["schema"]),
        }
        for t in _mcp_tools_raw()
    ]
    contents = [
        {"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
        for m in history
    ]

    with httpx.Client(timeout=300) as http:
        for _ in range(MAX_AGENT_ITERATIONS):
            resp = http.post(
                url,
                params={"key": api_key},
                json={
                    "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
                    "contents": contents,
                    "tools": [{"functionDeclarations": declarations}],
                },
            )
            if resp.status_code != 200:
                yield _ev(
                    "error", message=f"Gemini API error {resp.status_code}: {resp.text[:500]}"
                )
                return
            data = resp.json()
            candidates = data.get("candidates") or []
            if not candidates:
                yield _ev(
                    "error", message=f"Gemini returned no candidates: {json.dumps(data)[:500]}"
                )
                return
            parts = (candidates[0].get("content") or {}).get("parts") or []

            function_calls = []
            model_parts = []
            for part in parts:
                if part.get("text"):
                    yield _ev("text", text=part["text"])
                    model_parts.append({"text": part["text"]})
                elif part.get("functionCall"):
                    function_calls.append(part["functionCall"])
                    # Echo the whole part (incl. thoughtSignature) back to Gemini
                    model_parts.append(part)

            if not function_calls:
                return

            contents.append({"role": "model", "parts": model_parts})
            response_parts = []
            for fc in function_calls:
                name = fc.get("name", "")
                args = fc.get("args") or {}
                result = execute_blender_tool(name, args)
                yield from _tool_events(name, args, result)
                response_parts.append(
                    {"functionResponse": {"name": name, "response": {"result": result}}}
                )
                b64 = _load_image_b64(result)
                if b64:
                    # Attach the actual pixels so the model can see the viewport
                    response_parts.append({"inline_data": {"mime_type": "image/png", "data": b64}})
            contents.append({"role": "user", "parts": response_parts})

    yield _ev("error", message="Stopped: agent loop hit the iteration limit.")


def _run_openrouter(api_key: str, model: str, history: list[dict]):  # noqa: C901
    tools = [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t["schema"],
            },
        }
        for t in _mcp_tools_raw()
    ]
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages += [{"role": m["role"], "content": m["content"]} for m in history]

    vision_ok = True  # flipped off if the chosen model rejects image input

    def _strip_images(msgs: list[Any]) -> list[Any]:
        out = []
        for m in msgs:
            if isinstance(m.get("content"), list) and any(
                p.get("type") == "image_url" for p in m["content"]
            ):
                out.append(
                    {
                        "role": m["role"],
                        "content": "(A screenshot was captured, but this model does not "
                        "support image input — verify geometry numerically with "
                        "get_object_info / get_distance instead.)",
                    }
                )
            else:
                out.append(m)
        return out

    with httpx.Client(timeout=300) as http:
        for _ in range(MAX_AGENT_ITERATIONS):
            resp = http.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "X-Title": "Blender MCP Studio",
                },
                json={"model": model, "messages": messages, "tools": tools},
            )
            if resp.status_code == 404 and vision_ok and "image input" in resp.text:
                # Model is text-only: drop attached screenshots and retry once
                # per turn, then stop attaching them for the rest of the run.
                vision_ok = False
                messages = _strip_images(messages)
                yield _ev(
                    "text",
                    text="(Note: this model does not support images — screenshots "
                    "will not be visually verified.)",
                )
                continue
            if resp.status_code != 200:
                yield _ev(
                    "error", message=f"OpenRouter API error {resp.status_code}: {resp.text[:500]}"
                )
                return
            data = resp.json()
            choices = data.get("choices") or []
            if not choices:
                yield _ev(
                    "error", message=f"OpenRouter returned no choices: {json.dumps(data)[:500]}"
                )
                return
            msg = choices[0].get("message") or {}

            if msg.get("content"):
                yield _ev("text", text=msg["content"])

            tool_calls = msg.get("tool_calls") or []
            if not tool_calls:
                return

            messages.append(msg)
            image_parts = []
            for tc in tool_calls:
                fn = tc.get("function") or {}
                name = fn.get("name", "")
                try:
                    args = json.loads(fn.get("arguments") or "{}")
                except json.JSONDecodeError:
                    args = {}
                result = execute_blender_tool(name, args)
                yield from _tool_events(name, args, result)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc.get("id", ""),
                        "content": _tool_result_text(result),
                    }
                )
                b64 = _load_image_b64(result) if vision_ok else None
                if b64:
                    image_parts.append(
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{b64}"},
                        }
                    )
            if image_parts:
                # OpenAI-style tool messages are text-only — deliver the pixels
                # in a follow-up user message (vision-capable models only).
                vision_msg: dict[str, Any] = {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Screenshot(s) from the tool call(s) above:"},
                        *image_parts,
                    ],
                }
                messages.append(vision_msg)

    yield _ev("error", message="Stopped: agent loop hit the iteration limit.")


_RUNNERS = {
    "anthropic": _run_anthropic,
    "google": _run_google,
    "openrouter": _run_openrouter,
}


# --- HTTP endpoints -------------------------------------------------------------


async def providers_endpoint(request: Request):
    """GET /assistant/providers — which providers have a key configured."""
    out = []
    for pid, meta in PROVIDERS.items():
        out.append(
            {
                "id": pid,
                "label": meta["label"],
                "configured": _get_api_key(pid, None) is not None,
                "models": meta["models"],
            }
        )
    return JSONResponse({"providers": out})


async def chat_endpoint(request: Request):
    """POST /assistant/chat — run one agent turn, stream NDJSON events."""
    try:
        body = await request.json()
    except json.JSONDecodeError:
        return JSONResponse({"error": "Invalid JSON body"}, status_code=400)

    provider = body.get("provider", "anthropic")
    if provider not in _RUNNERS:
        return JSONResponse({"error": f"Unknown provider: {provider}"}, status_code=400)
    model = body.get("model") or PROVIDERS[provider]["models"][0]
    history = body.get("messages") or []
    if not isinstance(history, list) or not history:
        return JSONResponse({"error": "messages must be a non-empty list"}, status_code=400)

    api_key = _get_api_key(provider, body.get("api_key"))
    if not api_key:
        env_names = " or ".join(PROVIDERS[provider]["env"])
        return JSONResponse(
            {
                "error": f"No API key for {provider}. Set {env_names} on the bridge, or paste a key in the panel."
            },
            status_code=400,
        )

    runner = _RUNNERS[provider]

    def stream():
        try:
            yield from runner(api_key, model, history)
        except Exception as e:
            logger.exception("[Assistant] agent turn failed")
            yield _ev("error", message=str(e))
        yield _ev("done")

    return StreamingResponse(stream(), media_type="application/x-ndjson")


async def upload_endpoint(request: Request):
    """POST /assistant/upload — save a model file (STL/OBJ/FBX) under ASSETS_DIR/uploads.

    Returns the assets-relative path to pass to import_model.
    """
    if not settings.assets_dir:
        return JSONResponse(
            {"error": "BLENDER_ASSETS_DIR is not configured on the bridge."}, status_code=400
        )

    form = await request.form()
    upload = form.get("file")
    # form values are str | UploadFile — only a real file upload is acceptable
    if not isinstance(upload, UploadFile) or not upload.filename:
        return JSONResponse({"error": "No file uploaded (field name: 'file')"}, status_code=400)

    filename = os.path.basename(upload.filename)
    filename = re.sub(r"[^A-Za-z0-9._-]", "_", filename)
    ext = os.path.splitext(filename)[1].lower()
    if ext not in (".stl", ".obj", ".fbx"):
        return JSONResponse({"error": f"Unsupported file type: {ext}"}, status_code=400)

    uploads_dir = os.path.join(settings.assets_dir, "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    dest = os.path.join(uploads_dir, filename)
    content = await upload.read()
    with open(dest, "wb") as f:
        f.write(content)

    rel_path = f"uploads/{filename}"
    logger.info(f"[Assistant] Uploaded model saved to {dest}")
    return JSONResponse({"status": "success", "path": rel_path, "bytes": len(content)})
