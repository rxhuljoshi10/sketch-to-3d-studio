import asyncio
import json
import uuid
from typing import Dict, Any, Optional, Set

class TaskManager:
    """In-memory task manager and SSE/WebSocket event broadcaster."""

    def __init__(self):
        self._tasks: Dict[str, Dict[str, Any]] = {}
        self._subscribers: Dict[str, Set[asyncio.Queue]] = {}
        self._lock = asyncio.Lock()

    def create_task(self) -> str:
        task_id = str(uuid.uuid4())
        self._tasks[task_id] = {
            "status": "in_progress",
            "message": "Task queued...",
            "content": None,
            "image": None,
        }
        self._subscribers[task_id] = set()
        return task_id

    async def emit(self, task_id: str, data: Dict[str, Any], event_type: Optional[str] = None):
        """Update task state and broadcast event to all listeners."""
        async with self._lock:
            if task_id in self._tasks:
                self._tasks[task_id].update(data)

            subscribers = list(self._subscribers.get(task_id, set()))

        payload = {
            "data": data,
            "event_type": event_type or ("complete" if data.get("status") == "completed" else "message")
        }
        for queue in subscribers:
            await queue.put(payload)

    def _format_sse(self, data: Dict[str, Any], event_type: Optional[str] = None) -> str:
        raw_json = json.dumps(data)
        out = []
        if event_type and event_type != "message":
            out.append(f"event: {event_type}\ndata: {raw_json}\n\n")
        out.append(f"data: {raw_json}\n\n")
        return "".join(out)

    async def subscribe(self, task_id: str):
        """Yield events for a task via an async generator."""
        queue: asyncio.Queue = asyncio.Queue()

        async with self._lock:
            if task_id not in self._tasks:
                yield self._format_sse({"status": "failed", "message": "Task not found"}, "error")
                return

            if task_id not in self._subscribers:
                self._subscribers[task_id] = set()
            self._subscribers[task_id].add(queue)

            current_task = dict(self._tasks[task_id])

        # If already completed or failed, send state immediately
        if current_task.get("status") in ("completed", "failed"):
            event_name = "complete" if current_task.get("status") == "completed" else "error"
            yield self._format_sse(current_task, event_name)
            return

        # Otherwise yield initial start event
        yield self._format_sse(current_task, "start")

        try:
            while True:
                item = await queue.get()
                data = item["data"]
                event_type = item.get("event_type")

                yield self._format_sse(data, event_type)

                if data.get("status") in ("completed", "failed", "error"):
                    break
        finally:
            async with self._lock:
                if task_id in self._subscribers:
                    self._subscribers[task_id].discard(queue)

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        return self._tasks.get(task_id)


task_manager = TaskManager()
