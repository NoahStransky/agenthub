import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class AgentHandler(BaseHTTPRequestHandler):
    server_version = "AgentHubHermesMVP/0.1"

    def do_GET(self):
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


def workspace_metadata():
    return {
        "mount": os.environ.get("AGENTHUB_WORKSPACE_MOUNT", "/workspace"),
        "provider": os.environ.get("AGENTHUB_WORKSPACE_PROVIDER"),
        "bucket": os.environ.get("AGENTHUB_WORKSPACE_BUCKET"),
        "prefix": os.environ.get("AGENTHUB_WORKSPACE_PREFIX"),
    }


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
