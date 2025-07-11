# Copyright (c) 2025 Kyle-Aaron-Merrill
# 
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
# 
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
# 
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

import requests
from PIL import Image
from io import BytesIO
import os

def crop_thumbnail(url, save_path, album, size=544):
    response = requests.get(url)
    img = Image.open(BytesIO(response.content)).convert("RGB")

    # Get image size
    width, height = img.size

    # Calculate coordinates to crop the center square
    new_side = min(width, height)
    left = (width - new_side) // 2
    top = (height - new_side) // 2
    right = left + new_side
    bottom = top + new_side

    # Crop and resize to 544x544
    img_cropped = img.crop((left, top, right, bottom)).resize((size, size), Image.LANCZOS)

    # Save to path
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    filename = f"{save_path}{album}.png"
    img_cropped.save(filename, format="PNG")

    print(f"Saved cropped thumbnail to {save_path}")

# Example usage:
# thumbnail_url = "https://i.ytimg.com/vi_webp/AhIn3zo3UT0/maxresdefault.webp"
# crop_thumbnail(thumbnail_url, "assets/bin/thumbnails/", "Tungsten")
