#!/usr/bin/env python3
"""
Test script to debug the face verification pipeline
"""

import sys
import json
import base64
import io
import numpy as np
from PIL import Image
import cv2

def create_test_face_image():
    """Create a simple test image with a face-like pattern"""
    # Create a 200x200 image with a simple face pattern
    image = np.zeros((200, 200, 3), dtype=np.uint8)
    
    # Add a face-like oval
    cv2.ellipse(image, (100, 100), (80, 100), 0, 0, 360, (200, 180, 160), -1)
    
    # Add eyes
    cv2.circle(image, (75, 85), 8, (50, 50, 50), -1)
    cv2.circle(image, (125, 85), 8, (50, 50, 50), -1)
    
    # Add mouth
    cv2.ellipse(image, (100, 130), (20, 10), 0, 0, 180, (100, 100, 100), 2)
    
    # Convert to PIL Image and then to base64
    pil_image = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    buffer = io.BytesIO()
    pil_image.save(buffer, format='PNG')
    img_str = base64.b64encode(buffer.getvalue()).decode()
    
    return f"data:image/png;base64,{img_str}"

def test_face_detection():
    """Test face detection with our test image"""
    print("=== TESTING FACE DETECTION ===")
    
    # Create test image
    test_image_data = create_test_face_image()
    
    # Test encoding
    test_data = {
        "image_data": test_image_data
    }
    
    import subprocess
    process = subprocess.Popen(
        ['python3', 'server/simple_face_recognition.py', 'encode'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    stdout, stderr = process.communicate(json.dumps(test_data))
    
    print(f"Return code: {process.returncode}")
    print(f"Stdout: {stdout}")
    print(f"Stderr: {stderr}")
    
    if process.returncode == 0:
        result = json.loads(stdout)
        if result.get('success'):
            print(f"✓ Face encoding successful, dimensions: {len(result['encoding'])}")
            return result['encoding']
        else:
            print(f"✗ Face encoding failed: {result.get('error')}")
    else:
        print("✗ Process failed")
    
    return None

def test_face_comparison():
    """Test face comparison"""
    print("\n=== TESTING FACE COMPARISON ===")
    
    # Get encoding from first test
    encoding = test_face_detection()
    if not encoding:
        print("Cannot test comparison without valid encoding")
        return
    
    # Create slightly different test image
    test_image_data = create_test_face_image()
    
    # Test comparison
    test_data = {
        "known_encoding": encoding,
        "unknown_image": test_image_data,
        "tolerance": 0.6
    }
    
    import subprocess
    process = subprocess.Popen(
        ['python3', 'server/simple_face_recognition.py', 'compare'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    stdout, stderr = process.communicate(json.dumps(test_data))
    
    print(f"Return code: {process.returncode}")
    print(f"Stdout: {stdout}")
    print(f"Stderr: {stderr}")
    
    if process.returncode == 0:
        result = json.loads(stdout)
        if result.get('success'):
            comparison_result = result.get('result', {})
            print(f"✓ Face comparison successful:")
            print(f"  Distance: {comparison_result.get('distance')}")
            print(f"  Is Match: {comparison_result.get('is_match')}")
            print(f"  Tolerance: {comparison_result.get('tolerance')}")
        else:
            print(f"✗ Face comparison failed: {result.get('error')}")
    else:
        print("✗ Process failed")

if __name__ == "__main__":
    test_face_detection()
    test_face_comparison()