import base64
import urllib.parse
import httpx
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger("image_service")

class ImageService:
    async def improve_sketch(self, image_base64: str, prompt: Optional[str] = None) -> Dict[str, Any]:
        """Generates an enhanced concept image using free FLUX generation via Pollinations."""
        clean_prompt = prompt.strip() if prompt and prompt.strip() else "vibrant 3D digital art concept, high quality, studio lighting, trending on artstation"
        enhanced_prompt = f"masterpiece, detailed 3D render concept of {clean_prompt}, clean background, sharp focus, 8k"

        encoded = urllib.parse.quote(enhanced_prompt)
        url = f"https://image.pollinations.ai/prompt/{encoded}?width=800&height=600&nologo=true"

        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    b64 = base64.b64encode(res.content).decode("utf-8")
                    return {
                        "image": b64,
                        "width": 800,
                        "height": 600,
                    }
        except Exception as e:
            logger.error(f"Pollinations image generation error: {e}")

        # Fallback to the original drawing if network request fails
        clean_b64 = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
        return {
            "image": clean_b64,
            "width": 800,
            "height": 600,
        }

image_service = ImageService()
