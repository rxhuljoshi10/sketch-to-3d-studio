import base64
import re
import logging
import io
import os
import asyncio
from typing import Optional, Dict, Any
from PIL import Image
from dotenv import load_dotenv

logger = logging.getLogger("image_service")

# Prompt that instructs Gemini to create a clean, polished vector SVG of the exact user sketch
VECTOR_IMPROVEMENT_PROMPT = """You are an expert digital vector artist and graphic illustrator.
Carefully examine the user's hand-drawn rough sketch.
Transform it into a clean, professional, polished vector SVG artwork of the EXACT same object drawn in the sketch.

Strict Rules:
1. FAITHFULLY preserve what the user drew: the exact same subject, composition, silhouettes, and colors.
2. Smooth out jagged lines, fix wobbly curves, align geometric shapes, and add tasteful highlights, clean flat fills, or smooth strokes.
3. Keep the drawing expressive and beautiful, as a professional vector icon or digital illustration.
4. Ensure the SVG has a TRANSPARENT background (do NOT add a solid background rectangle or canvas).
5. Set viewBox="0 0 {width} {height}" and width="100%" height="100%".
6. Return ONLY the complete, valid <svg xmlns="http://www.w3.org/2000/svg" ...> ... </svg> code. Do NOT output any markdown, explanations, or code fences.
"""


class ImageService:
    def __init__(self):
        self._configured = False
        self._genai_client = None
        self._setup_client()

    def _setup_client(self):
        load_dotenv(override=True)
        api_key = os.getenv("GEMINI_API_KEY", "").strip()
        if api_key and api_key != "your_gemini_api_key_here":
            try:
                from google import genai
                self._genai_client = genai.Client(api_key=api_key)
                self._configured = True
                logger.info("Image service: google.genai client configured.")
            except ImportError:
                logger.warning("google-genai package not installed.")
                self._configured = False
            except Exception as e:
                logger.error(f"Failed to configure google.genai client: {e}")
                self._configured = False
        else:
            self._configured = False

    async def improve_sketch(
        self,
        image_base64: str,
        prompt: Optional[str] = None,
        width: int = 500,
        height: int = 500,
    ) -> Dict[str, Any]:
        """
        Takes the user's drawn sketch and uses Gemini Vision to transform it
        into a polished vector SVG faithful to the exact drawn subject.
        """
        self._setup_client()

        # Decode the input image
        pil_image = await asyncio.to_thread(self._decode_image, image_base64)
        if pil_image is None:
            raise ValueError("Could not decode the input image.")

        # Determine dimensions from image if not supplied or default
        img_w, img_h = pil_image.size
        w = width if width and width > 50 else img_w
        h = height if height and height > 50 else img_h

        # Attempt vector SVG generation via Gemini
        if self._configured and self._genai_client:
            result = await self._generate_vector_svg(pil_image, prompt, w, h)
            if result:
                return result

        # Fallback: return the original drawing cleanly
        clean_b64 = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
        return {
            "image": clean_b64,
            "width": w,
            "height": h,
            "mime_type": "image/png",
        }

    async def _generate_vector_svg(
        self,
        pil_image: Image.Image,
        user_prompt: Optional[str],
        width: int,
        height: int,
    ) -> Optional[Dict[str, Any]]:
        """
        Uses Gemini's multimodal vision to analyze the rough sketch and produce
        a clean, smoothed, faithfully-colored SVG illustration of the exact subject.
        """
        prompt = VECTOR_IMPROVEMENT_PROMPT.format(width=width, height=height)
        if user_prompt and user_prompt.strip():
            prompt += f"\n\nUser additional notes: {user_prompt.strip()}"

        models_to_try = [
            "gemini-3.6-flash",
            "gemini-3.5-flash",
            "gemini-flash-latest",
            "gemini-flash-lite-latest",
        ]

        for model_name in models_to_try:
            try:
                logger.info(f"Generating polished vector SVG with model: {model_name}")
                response = await asyncio.wait_for(
                    asyncio.to_thread(
                        self._genai_client.models.generate_content,
                        model=model_name,
                        contents=[prompt, pil_image],
                    ),
                    timeout=22.0
                )

                if response and response.text:
                    raw_text = response.text
                    # Extract <svg ...> ... </svg>
                    match = re.search(r"<svg[\s\S]*?</svg>", raw_text, re.IGNORECASE)
                    if match:
                        svg_code = match.group(0).strip()
                        # Ensure proper XML namespace if missing
                        if "xmlns=" not in svg_code:
                            svg_code = svg_code.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"', 1)

                        # Encode as base64 for safe transport and data-uri usage
                        svg_b64 = base64.b64encode(svg_code.encode("utf-8")).decode("utf-8")
                        logger.info(f"Vector SVG generation succeeded ({len(svg_code)} chars).")

                        return {
                            "image": svg_b64,
                            "svg": svg_code,
                            "width": width,
                            "height": height,
                            "mime_type": "image/svg+xml",
                        }
                    else:
                        logger.warning(f"Model {model_name} did not include <svg> tag in response.")
            except asyncio.TimeoutError:
                logger.warning(f"Model {model_name} timed out after 22s, trying next model...")
                continue
            except Exception as e:
                logger.warning(f"Model {model_name} failed: {e}")
                continue

        logger.error("All vector SVG generation models failed.")
        return None

    def _decode_image(self, image_base64: str) -> Optional[Image.Image]:
        """Decode a base64 image string into a PIL Image."""
        try:
            clean = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
            image_data = base64.b64decode(clean)
            return Image.open(io.BytesIO(image_data))
        except Exception as e:
            logger.error(f"Image decode error: {e}")
            return None


image_service = ImageService()
