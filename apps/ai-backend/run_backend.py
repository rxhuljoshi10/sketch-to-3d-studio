import os
import sys
import uvicorn

current_dir = os.path.dirname(os.path.abspath(__file__))
venv_python = os.path.join(current_dir, ".venv", "Scripts", "python.exe")

# If .venv exists and we are not running inside it, re-launch with .venv python
if os.path.exists(venv_python) and sys.executable.lower() != venv_python.lower():
    import subprocess
    sys.exit(subprocess.call([venv_python] + sys.argv))

if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    print(f"Starting Scribble3D AI Backend on http://localhost:{port} ...")
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
