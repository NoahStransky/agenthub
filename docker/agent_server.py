import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class AgentHandler(BaseHTTPRequestHandler):
    server_version = "AgentHubHermesMVP/0.1"

    def do_GET(self):
        if self.path == "/" or self.path.startswith("/?"):
            self.write_html(200, render_home())
            return

        if self.path == "/health":
            self.write_json(200, {
                "status": "ok",
                "workspace": workspace_metadata(),
            })
            return

        self.write_json(404, {"error": "not_found"})

    def do_POST(self):
        if self.path != "/tasks":
            self.write_json(404, {"error": "not_found"})
            return

        body = self.read_json()
        task_id = body.get("taskId") or "unknown"
        workspace_write = write_task_marker(task_id, body)
        self.write_json(202, {
            "status": "accepted",
            "taskId": task_id,
            "workspace": workspace_metadata(),
            "workspaceWrite": workspace_write,
            "message": "Hermes MVP placeholder accepted the task.",
        })

    def log_message(self, format, *args):
        return

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length == 0:
            return {}
        try:
            return json.loads(self.rfile.read(length))
        except json.JSONDecodeError:
            return {}

    def write_json(self, status, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def write_html(self, status, html):
        data = html.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def workspace_metadata():
    return {
        "mount": os.environ.get("AGENTHUB_WORKSPACE_MOUNT", "/workspace"),
        "provider": os.environ.get("AGENTHUB_WORKSPACE_PROVIDER"),
        "bucket": os.environ.get("AGENTHUB_WORKSPACE_BUCKET"),
        "prefix": os.environ.get("AGENTHUB_WORKSPACE_PREFIX"),
    }


def gateway_metadata():
    return {
        "proxyUrl": os.environ.get("AGENTHUB_HERMES_PROXY_URL"),
        "webhookBaseUrl": os.environ.get("AGENTHUB_HERMES_WEBHOOK_BASE_URL"),
    }


def render_home():
    workspace = workspace_metadata()
    gateway = gateway_metadata()
    return f"""<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hermes MVP</title>
    <style>
      body {{ font-family: system-ui, sans-serif; margin: 40px; max-width: 760px; line-height: 1.5; }}
      code, pre {{ background: #f4f4f5; border-radius: 6px; padding: 2px 6px; }}
      pre {{ padding: 16px; overflow: auto; }}
    </style>
  </head>
  <body>
    <h1>Hermes MVP</h1>
    <p>This page is served by the Hermes instance. AgentHub only handles lifecycle, isolation, and proxy access.</p>
    <h2>Workspace</h2>
    <pre>{json.dumps(workspace, indent=2)}</pre>
    <h2>AgentHub Gateway</h2>
    <pre>{json.dumps(gateway, indent=2)}</pre>
    <h2>Configuration Boundary</h2>
    <p>Hermes-owned integrations such as Telegram, Slack, and custom webhooks should be configured inside Hermes.</p>
  </body>
</html>"""


def write_task_marker(task_id, payload):
    workspace_root = Path(os.environ.get("AGENTHUB_WORKSPACE_MOUNT", "/workspace"))
    try:
        tasks_dir = workspace_root / "tasks"
        tasks_dir.mkdir(parents=True, exist_ok=True)
        marker = tasks_dir / f"{task_id}.json"
        marker.write_text(json.dumps(payload), encoding="utf-8")
        return {"ok": True, "path": str(marker)}
    except OSError as error:
        return {"ok": False, "error": str(error)}


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8080), AgentHandler).serve_forever()
