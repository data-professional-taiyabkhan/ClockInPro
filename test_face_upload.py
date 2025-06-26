#!/usr/bin/env python3
"""
Test face upload functionality to debug the image upload issue
"""

import json
import base64
import io
import numpy as np
from PIL import Image, ImageDraw
import cv2

def create_test_face_image():
    """Create a simple test image with a clear face pattern for testing."""
    # Create a 200x200 RGB image
    img = Image.new('RGB', (200, 200), color='lightgray')
    draw = ImageDraw.Draw(img)
    
    # Draw a simple face
    # Face outline (circle)
    draw.ellipse([50, 50, 150, 150], fill='peachpuff', outline='black')
    
    # Eyes
    draw.ellipse([70, 80, 85, 95], fill='white', outline='black')
    draw.ellipse([115, 80, 130, 95], fill='white', outline='black')
    draw.ellipse([75, 85, 80, 90], fill='black')  # Left pupil
    draw.ellipse([120, 85, 125, 90], fill='black')  # Right pupil
    
    # Nose
    draw.polygon([(100, 100), (95, 110), (105, 110)], fill='pink', outline='black')
    
    # Mouth
    draw.arc([85, 115, 115, 135], 0, 180, fill='red', width=2)
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG')
    image_bytes = buffer.getvalue()
    base64_string = base64.b64encode(image_bytes).decode('utf-8')
    
    return f"data:image/jpeg;base64,{base64_string}"

def test_face_detection():
    """Test face detection with our test image"""
    print("Creating test face image...")
    test_image_data = create_test_face_image()
    
    print("Testing face detection...")
    
    # Test with the reliable face recognition system
    input_data = json.dumps({"image_data": test_image_data})
    
    import subprocess
    try:
        result = subprocess.run(
            ['python3', 'server/reliable_face_recognition.py', 'encode'],
            input=input_data,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            response = json.loads(result.stdout)
            if response.get('success'):
                print("✅ Face detection successful!")
                print(f"Encoding dimensions: {len(response['encoding'])}")
            else:
                print(f"❌ Face detection failed: {response.get('error')}")
        else:
            print(f"❌ Process failed: {result.stderr}")
            
    except Exception as e:
        print(f"❌ Test error: {e}")

if __name__ == "__main__":
    test_face_detection()