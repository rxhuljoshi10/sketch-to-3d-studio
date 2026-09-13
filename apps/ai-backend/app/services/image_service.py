import base64
import urllib.parse
import httpx
import logging
import io
import os
import random
import asyncio
from typing import Optional, Dict, Any
from PIL import Image
import google.generativeai as genai
from dotenv import load_dotenv

logger = logging.getLogger("image_service")

# Vision models to try in priority order
VISION_MODELS = ["gemini-3.6-flash", "gemini-flash-latest", "gemini-2.5-flash"]


class ImageService:
    def __init__(self):
        self._setup_client()

    def _setup_client(self):
        load_dotenv(override=True)
        api_key = os.getenv("GEMINI_API_KEY", "").strip()
        if api_key and api_key != "your_gemini_api_key_here":
            genai.configure(api_key=api_key)
            self._configured = True
        else:
            self._configured = False

    async def improve_sketch(self, image_base64: str, prompt: Optional[str] = None) -> Dict[str, Any]:
        """
        Takes the user's drawn sketch, analyzes its visual content and shapes using
        Gemini Vision, and generates an enhanced 3D concept artwork faithful to the sketch.
        """
        self._setup_client()

        # Step 1: Decode image and use Gemini Vision to describe the actual drawing
        pil_image = await asyncio.to_thread(self._decode_image, image_base64)

        sketch_prompt = await asyncio.to_thread(
            self._analyze_sketch_with_gemini, pil_image, prompt
        )

        logger.info(f"Generated artwork prompt from sketch: {sketch_prompt}")

        # Step 2: Generate polished image with Pollinations
        seed = random.randint(1, 999999)
        result = await self._generate_pollinations_image(sketch_prompt, seed)
        if result:
            return result

        # Fallback: return the original drawing cleanly
        clean_b64 = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
        return {"image": clean_b64, "width": 800, "height": 600}

    def _decode_image(self, image_base64: str) -> Optional[Image.Image]:
        """Decode a base64 image string into a PIL Image."""
        try:
            clean = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
            image_data = base64.b64decode(clean)
            return Image.open(io.BytesIO(image_data))
        except Exception as e:
            logger.error(f"Image decode error: {e}")
            return None

    def _analyze_sketch_with_gemini(
        self,
        pil_image: Optional[Image.Image],
        user_prompt: Optional[str] = None,
    ) -> str:
        """
        Uses Gemini Vision to analyze the sketch and generate an accurate prompt
        describing the exact subject, shapes, and colors drawn by the user.
        """
        if not self._configured or pil_image is None:
            extra = user_prompt.strip() if user_prompt and user_prompt.strip() else "creative artwork"
            return f"Stunning 3D concept render of {extra}, vibrant colors, studio lighting, highly detailed"

        extra_context = f"\nUser added notes: {user_prompt.strip()}" if user_prompt and user_prompt.strip() else ""

        system_instruction = (
            "You are an expert concept artist and digital illustrator. Carefully analyze this sketch.\n"
            "Identify what specific object, character, creature, vehicle, structure, or scene the user has drawn.\n"
            "Notice the shapes, contours, colors, and layout.\n"
            "Write a concise, vivid prompt (1-3 sentences) for an image generator to create a stunning, "
            "polished 3D digital concept art render of this EXACT subject.\n"
            "Strict rules:\n"
            "- Faithfully preserve what the user drew (same subject, colors, and overall composition).\n"
            "- Describe it as finished, high-resolution 3D artwork with studio lighting and clean background.\n"
            f"{extra_context}\n"
            "- Output ONLY the prompt text. Do not add quotes, markdown formatting, or introductory text."
        )

        for model_name in VISION_MODELS:
            try:
                model = genai.GenerativeModel(model_name)
                response = model.generate_content([system_instruction, pil_image])
                text = response.text.strip() if response and response.text else ""
                if text:
                    # Clean any leading or trailing quotes
                    text = text.strip('"\'`')
                    return text
            except Exception as e:
                logger.warning(f"Vision model {model_name} failed: {e}")
                continue

        # Fallback if vision calls failed
        fallback_subject = user_prompt.strip() if user_prompt and user_prompt.strip() else "concept art object"
        return f"Stunning 3D concept render of {fallback_subject}, clean geometry, vibrant colors, studio lighting"

    async def _generate_pollinations_image(self, prompt: str, seed: int) -> Optional[Dict[str, Any]]:
        """Calls Pollinations with the vision-generated prompt to produce the finished image."""
        encoded = urllib.parse.quote(prompt)

        # Try flux model first, then fallback to default model
        urls = [
            f"https://image.pollinations.ai/prompt/{encoded}?width=800&height=600&model=flux&nologo=true&seed={seed}",
            f"https://image.pollinations.ai/prompt/{encoded}?width=800&height=600&nologo=true&seed={seed}",
        ]

        for url in urls:
            try:
                async with httpx.AsyncClient(timeout=45.0) as client:
                    res = await client.get(url)
                    if res.status_code == 200 and len(res.content) > 1000:
                        b64 = base64.b64encode(res.content).decode("utf-8")
                        return {"image": b64, "width": 800, "height": 600}
                    logger.warning(f"Pollinations returned status {res.status_code}")
            except Exception as e:
                logger.error(f"Pollinations request error ({url[:60]}...): {e}")

        return None


image_service = ImageService()
