import os
import io
import re
import base64
import logging
from typing import Optional
from PIL import Image
import google.generativeai as genai
from app.prompts import (
    SKETCH_TO_3D_SYSTEM_PROMPT,
    EDIT_3D_SYSTEM_PROMPT,
    CODE_PARSER_SYSTEM_PROMPT,
)

from dotenv import load_dotenv

logger = logging.getLogger("gemini_service")

class GeminiService:
    def __init__(self):
        self._configured = False
        self._setup_client()

    def _setup_client(self):
        load_dotenv(override=True)
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key and api_key.strip() and api_key != "your_gemini_api_key_here":
            genai.configure(api_key=api_key.strip())
            self._configured = True
            logger.info("Gemini API client configured successfully.")
        else:
            self._configured = False
            logger.warning("GEMINI_API_KEY not set or invalid. Running in fallback/demo mode.")

    def _decode_image(self, base64_str: str) -> Optional[Image.Image]:
        try:
            if "," in base64_str:
                base64_str = base64_str.split(",", 1)[1]
            image_data = base64.b64decode(base64_str)
            return Image.open(io.BytesIO(image_data))
        except Exception as e:
            logger.error(f"Error decoding image: {e}")
            return None

    def _clean_code(self, raw_text: str) -> str:
        text = raw_text.strip()
        # Strip ```html or ```javascript codeblocks
        match = re.search(r"```(?:html|javascript|js)?\s*\n([\s\S]*?)```", text)
        if match:
            return match.group(1).strip()
        return text

    def generate_3d_code(self, image_base64: str, prompt: Optional[str] = None) -> str:
        self._setup_client()
        image = self._decode_image(image_base64)

        if not self._configured or not image:
            logger.info("Using smart procedural fallback for 3D model generation.")
            return self._generate_fallback_code(prompt or "Object")

        try:
            try:
                model = genai.GenerativeModel(
                    model_name="gemini-3.6-flash",
                    system_instruction=SKETCH_TO_3D_SYSTEM_PROMPT,
                )
            except Exception:
                model = genai.GenerativeModel(
                    model_name="gemini-flash-latest",
                    system_instruction=SKETCH_TO_3D_SYSTEM_PROMPT,
                )
            contents = [
                image,
                f"Convert this sketch into an interactive Three.js 3D model. Additional description/notes: {prompt or 'None'}",
            ]
            response = model.generate_content(contents)
            cleaned = self._clean_code(response.text)
            return cleaned
        except Exception as e:
            logger.error(f"Gemini API error during 3D generation: {e}, using fallback.")
            return self._generate_fallback_code(prompt or "Object")

    def edit_3d_code(self, existing_code: str, image_base64: str, prompt: Optional[str] = None) -> str:
        self._setup_client()
        image = self._decode_image(image_base64)

        if not self._configured or not image:
            return existing_code

        try:
            try:
                model = genai.GenerativeModel(
                    model_name="gemini-3.6-flash",
                    system_instruction=EDIT_3D_SYSTEM_PROMPT,
                )
            except Exception:
                model = genai.GenerativeModel(
                    model_name="gemini-flash-latest",
                    system_instruction=EDIT_3D_SYSTEM_PROMPT,
                )
            contents = [
                image,
                f"Existing Three.js code:\n```javascript\n{existing_code}\n```\n\nModification notes: {prompt or 'Update model based on new sketch'}",
            ]
            response = model.generate_content(contents)
            return self._clean_code(response.text)
        except Exception as e:
            logger.error(f"Gemini API error during edit: {e}")
            return existing_code

    def parse_threejs_object(self, raw_code: str) -> str:
        """Extract only the object creation block returning a THREE.Object3D/Group/Mesh."""
        self._setup_client()

        # Try fast local heuristic extraction first
        local_extract = self._try_local_extract(raw_code)
        if local_extract:
            return local_extract

        if not self._configured:
            return self._generate_fallback_object_code()

        try:
            try:
                model = genai.GenerativeModel(
                    model_name="gemini-3.6-flash",
                    system_instruction=CODE_PARSER_SYSTEM_PROMPT,
                )
            except Exception:
                model = genai.GenerativeModel(
                    model_name="gemini-flash-latest",
                    system_instruction=CODE_PARSER_SYSTEM_PROMPT,
                )
            response = model.generate_content(
                f"Extract the object creation JavaScript code from this Three.js script:\n```javascript\n{raw_code}\n```"
            )
            return self._clean_code(response.text)
        except Exception as e:
            logger.error(f"Error in parse_threejs_object: {e}")
            return self._generate_fallback_object_code()

    def _try_local_extract(self, code: str) -> Optional[str]:
        """Check if code already contains a clean standalone object creation block."""
        cleaned = self._clean_code(code)
        # If code already creates a group and returns it, and has no DOM/renderer/scene
        if "return " in cleaned and "renderer" not in cleaned and "requestAnimationFrame" not in cleaned:
            return cleaned
        return None

    def _generate_fallback_code(self, label: str) -> str:
        """Returns a vibrant pure-JS Three.js group creation function (no HTML, no renderer)."""
        return """const group = new THREE.Group();

// Base body
const baseGeo = new THREE.CylinderGeometry(0.8, 1.0, 1.4, 32);
const baseMat = new THREE.MeshStandardMaterial({
    color: 0x7c3aed,
    roughness: 0.25,
    metalness: 0.2
});
const baseMesh = new THREE.Mesh(baseGeo, baseMat);
baseMesh.position.y = 0.7;
baseMesh.castShadow = true;
group.add(baseMesh);

// Accent top
const topGeo = new THREE.SphereGeometry(0.7, 32, 32);
const topMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.1,
    metalness: 0.8
});
const topMesh = new THREE.Mesh(topGeo, topMat);
topMesh.position.y = 1.6;
topMesh.castShadow = true;
group.add(topMesh);

// Ring detail
const ringGeo = new THREE.TorusGeometry(0.9, 0.08, 16, 64);
const ringMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 });
const ring = new THREE.Mesh(ringGeo, ringMat);
ring.position.y = 1.1;
ring.rotation.x = Math.PI / 2;
group.add(ring);

return group;"""

    def _generate_fallback_object_code(self) -> str:
        """Returns clean executable Three.js object definition code."""
        return """
const group = new THREE.Group();

const baseGeo = new THREE.CylinderGeometry(0.8, 1.0, 1.4, 32);
const baseMat = new THREE.MeshStandardMaterial({
    color: 0x7c3aed,
    roughness: 0.25,
    metalness: 0.2
});
const baseMesh = new THREE.Mesh(baseGeo, baseMat);
baseMesh.position.y = 0.7;
baseMesh.castShadow = true;
group.add(baseMesh);

const topGeo = new THREE.SphereGeometry(0.7, 32, 32);
const topMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.1,
    metalness: 0.8
});
const topMesh = new THREE.Mesh(topGeo, topMat);
topMesh.position.y = 1.6;
topMesh.castShadow = true;
group.add(topMesh);

const ringGeo = new THREE.TorusGeometry(0.9, 0.08, 16, 64);
const ringMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 });
const ring = new THREE.Mesh(ringGeo, ringMat);
ring.position.y = 1.1;
ring.rotation.x = Math.PI / 2;
group.add(ring);

return group;
"""

gemini_service = GeminiService()
