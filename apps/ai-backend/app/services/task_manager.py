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

    async def emit(self, task_id: str, data: Dict[str, Any]):
        """Update task state and broadcast event to all listeners."""
        async with self._lock:
            if task_id in self._tasks:
                self._tasks[task_id].update(data)

            subscribers = list(self._subscribers.get(task_id, set()))

        payload = json.dumps(data)
        for queue in subscribers:
            await queue.put(payload)

    async def subscribe(self, task_id: str):
        """Yield events for a task via an async generator."""
        queue: asyncio.Queue = asyncio.Queue()

        async with self._lock:
            if task_id not in self._tasks:
                yield f"data: {json.dumps({'status': 'failed', 'message': 'Task not found'})}\n\n"
                return

            if task_id not in self._subscribers:
                self._subscribers[task_id] = set()
            self._subscribers[task_id].add(queue)

            current_task = dict(self._tasks[task_id])

        # If already completed or failed, send state immediately
        if current_task.get("status") in ("completed", "failed"):
            yield f"data: {json.dumps(current_task)}\n\n"
            return

        # Otherwise yield initial status
        yield f"data: {json.dumps(current_task)}\n\n"

        try:
            while True:
                data = await queue.get()
                yield f"data: {data}\n\n"
                parsed = json.loads(data)
                if parsed.get("status") in ("completed", "failed", "error"):
                    break
        finally:
            async with self._lock:
                if task_id in self._subscribers:
                    self._subscribers[task_id].discard(queue)

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        return self._tasks.get(task_id)


task_manager = TaskManager()
