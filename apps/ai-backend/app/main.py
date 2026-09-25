import os
import asyncio
import logging
from typing import Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from fastapi import FastAPI, Request, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.services.task_manager import task_manager
from app.services.gemini_service import gemini_service
from app.services.image_service import image_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("scribble3d_backend")

app = FastAPI(
    title="Scribble3D AI Backend",
    description="Multimodal generative AI backend for 2D Sketch to 3D Studio",
    version="1.0.0",
)

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models ---
class Queue3DRequest(BaseModel):
    prompt: Optional[str] = None
    image_base64: str

class QueueEditRequest(BaseModel):
    threejs_code: str
    prompt: Optional[str] = None
    image_base64: str

class QueueImageRequest(BaseModel):
    prompt: Optional[str] = None
    image_base64: str
    width: Optional[int] = None
    height: Optional[int] = None

class TrellisTaskRequest(BaseModel):
    model: Optional[str] = "Qubico/trellis"
    task_type: Optional[str] = "image-to-3d"
    input: dict

# --- Background Task Workers ---
async def process_3d_generation(task_id: str, image_b64: str, prompt: Optional[str]):
    try:
        await task_manager.emit(task_id, {"status": "in_progress", "message": "Analyzing sketch contours & colors..."})
        await asyncio.sleep(0.5)
        await task_manager.emit(task_id, {"status": "in_progress", "message": "Generating Three.js procedural 3D model..."})

        # Run Gemini generation in thread pool
        code = await asyncio.to_thread(gemini_service.generate_3d_code, image_b64, prompt)

        await task_manager.emit(task_id, {
            "status": "completed",
            "content": code,
            "message": "3D model generated successfully!"
        }, event_type="complete")
    except Exception as e:
        logger.error(f"Failed processing 3D task {task_id}: {e}")
        await task_manager.emit(task_id, {"status": "failed", "message": str(e)}, event_type="error")

async def process_3d_edit(task_id: str, existing_code: str, image_b64: str, prompt: Optional[str]):
    try:
        await task_manager.emit(task_id, {"status": "in_progress", "message": "Analyzing edit instructions..."}, event_type="start")

        edited_code = await asyncio.to_thread(gemini_service.edit_3d_code, existing_code, image_b64, prompt)

        await task_manager.emit(task_id, {
            "status": "completed",
            "content": edited_code,
            "message": "3D model edited successfully!"
        }, event_type="complete")
    except Exception as e:
        logger.error(f"Failed processing edit task {task_id}: {e}")
        await task_manager.emit(task_id, {"status": "failed", "message": str(e)}, event_type="error")

async def process_image_improvement(task_id: str, image_b64: str, prompt: Optional[str], width: Optional[int] = None, height: Optional[int] = None):
    try:
        await task_manager.emit(task_id, {"status": "in_progress", "message": "Polishing vector sketch with Gemini AI..."}, event_type="start")

        result = await image_service.improve_sketch(
            image_b64,
            prompt,
            width=width or 500,
            height=height or 500,
        )

        mime_type = result.get("mime_type", "image/png")
        await task_manager.emit(task_id, {
            "status": "completed",
            "image": result["image"],
            "mime_type": mime_type,
            "svg": result.get("svg"),
            "images": [
                {
                    "image_base64": result["image"],
                    "mime_type": mime_type,
                    "width": result.get("width", 500),
                    "height": result.get("height", 500),
                }
            ],
            "width": result.get("width", 500),
            "height": result.get("height", 500),
            "message": "Sketch improved into clean vector artwork!"
        }, event_type="complete")
    except Exception as e:
        logger.error(f"Failed processing image task {task_id}: {e}")
        await task_manager.emit(task_id, {"status": "failed", "message": str(e)}, event_type="error")

# --- API Endpoints ---

@app.get("/")
async def root():
    gemini_service._setup_client()
    return {
        "status": "online",
        "service": "Scribble3D AI Backend",
        "gemini_active": gemini_service._configured
    }

@app.post("/api/queue/3d")
async def queue_3d(request: Queue3DRequest, background_tasks: BackgroundTasks):
    task_id = task_manager.create_task()
    background_tasks.add_task(process_3d_generation, task_id, request.image_base64, request.prompt)
    return {"task_id": task_id}

@app.post("/api/queue/edit")
async def queue_edit(request: QueueEditRequest, background_tasks: BackgroundTasks):
    task_id = task_manager.create_task()
    background_tasks.add_task(process_3d_edit, task_id, request.threejs_code, request.image_base64, request.prompt)
    return {"task_id": task_id}

@app.post("/api/queue/image")
async def queue_image(request: QueueImageRequest, background_tasks: BackgroundTasks):
    task_id = task_manager.create_task()
    background_tasks.add_task(
        process_image_improvement,
        task_id,
        request.image_base64,
        request.prompt,
        request.width,
        request.height,
    )
    return {"task_id": task_id}

@app.get("/api/subscribe/{task_id}")
async def subscribe_task(task_id: str):
    return StreamingResponse(
        task_manager.subscribe(task_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

@app.get("/api/task/{task_id}")
async def get_task_status(task_id: str):
    task = task_manager.get_task(task_id)
    if not task:
        return JSONResponse({"status": "not_found", "message": "Task not found"}, status_code=404)
    return task

@app.post("/api/cerebras/parse")
async def parse_code(request: Request):
    """
    Parses/extracts the standalone executable Three.js object definition
    function for insertion into the 3D scene graph.
    """
    raw_body = await request.body()
    code_text = raw_body.decode("utf-8")

    # If sent as JSON, unpack it
    try:
        import json
        parsed_json = json.loads(code_text)
        if isinstance(parsed_json, dict) and "code" in parsed_json:
            code_text = parsed_json["code"]
    except Exception:
        pass

    extracted_code = await asyncio.to_thread(gemini_service.parse_threejs_object, code_text)
    return {"content": extracted_code}

@app.post("/api/trellis/task")
async def create_trellis_task(request: TrellisTaskRequest):
    """Trellis is not yet integrated. Redirect to Gemini generation path."""
    task_id = task_manager.create_task()
    return {"data": {"task_id": task_id}}

@app.websocket("/api/trellis/task/ws/{task_id}")
async def trellis_websocket(websocket: WebSocket, task_id: str):
    """Trellis GLTF generation is not yet available. Returns an error."""
    await websocket.accept()
    try:
        await websocket.send_json({
            "status": "failed",
            "message": "GLTF generation via Trellis is not yet available. Please use the standard Make 3D path (toggle the brain icon OFF) to generate Three.js models via Gemini AI."
        })
    except WebSocketDisconnect:
        logger.info(f"Client disconnected from Trellis WebSocket {task_id}")
    except Exception as e:
        logger.error(f"WebSocket error for {task_id}: {e}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
