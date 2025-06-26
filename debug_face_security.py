#!/usr/bin/env python3
"""
Debug script to test face recognition security and identify why different people can access each other's accounts
"""

import sys
import json
import base64
import io
import numpy as np
from PIL import Image
import cv2
import subprocess

def create_distinct_face_images():
    """Create two clearly different face patterns for testing"""
    
    # Face 1 - Oval face with specific features
    image1 = np.zeros((200, 200, 3), dtype=np.uint8)
    cv2.ellipse(image1, (100, 100), (60, 80), 0, 0, 360, (220, 190, 170), -1)  # Face
    cv2.circle(image1, (80, 85), 6, (40, 40, 40), -1)   # Left eye
    cv2.circle(image1, (120, 85), 6, (40, 40, 40), -1)  # Right eye
    cv2.ellipse(image1, (100, 125), (15, 8), 0, 0, 180, (80, 80, 80), 2)  # Mouth
    
    # Face 2 - Square face with different features
    image2 = np.zeros((200, 200, 3), dtype=np.uint8)
    cv2.rectangle(image2, (50, 50), (150, 150), (200, 180, 160), -1)  # Square face
    cv2.circle(image2, (75, 80), 8, (20, 20, 20), -1)   # Left eye (bigger)
    cv2.circle(image2, (125, 80), 8, (20, 20, 20), -1)  # Right eye (bigger) 
    cv2.rectangle(image2, (90, 120), (110, 130), (60, 60, 60), -1)  # Square mouth
    
    # Convert to base64
    def image_to_base64(img):
        pil_image = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        buffer = io.BytesIO()
        pil_image.save(buffer, format='PNG')
        img_str = base64.b64encode(buffer.getvalue()).decode()
        return f"data:image/png;base64,{img_str}"
    
    return image_to_base64(image1), image_to_base64(image2)

def encode_face(image_data):
    """Encode a face using the simple face recognition system"""
    process = subprocess.Popen(
        ['python3', 'server/simple_face_recognition.py', 'encode'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    input_data = json.dumps({"image_data": image_data})
    stdout, stderr = process.communicate(input_data)
    
    if process.returncode == 0:
        result = json.loads(stdout)
        if result.get('success'):
            return result['encoding']
        else:
            print(f"Encoding failed: {result.get('error')}")
            return None
    else:
        print(f"Process failed: {stderr}")
        return None

def compare_faces(known_encoding, unknown_image, tolerance=0.6):
    """Compare faces using the simple face recognition system"""
    process = subprocess.Popen(
        ['python3', 'server/simple_face_recognition.py', 'compare'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    input_data = json.dumps({
        "known_encoding": known_encoding,
        "unknown_image": unknown_image,
        "tolerance": tolerance
    })
    stdout, stderr = process.communicate(input_data)
    
    if process.returncode == 0:
        result = json.loads(stdout)
        if result.get('success'):
            return result['result']
        else:
            print(f"Comparison failed: {result.get('error')}")
            return None
    else:
        print(f"Process failed: {stderr}")
        return None

def test_face_recognition_security():
    """Test if the face recognition system properly distinguishes between different people"""
    print("=" * 60)
    print("FACE RECOGNITION SECURITY TEST")
    print("=" * 60)
    
    # Create two distinct face images
    face1_image, face2_image = create_distinct_face_images()
    
    print("\n1. Encoding Face 1 (Person A)...")
    face1_encoding = encode_face(face1_image)
    if not face1_encoding:
        print("❌ Failed to encode Face 1")
        return
    print(f"✅ Face 1 encoded successfully (dimensions: {len(face1_encoding)})")
    
    print("\n2. Encoding Face 2 (Person B)...")
    face2_encoding = encode_face(face2_image)
    if not face2_encoding:
        print("❌ Failed to encode Face 2")
        return
    print(f"✅ Face 2 encoded successfully (dimensions: {len(face2_encoding)})")
    
    print("\n3. Testing Same Person Verification (Face 1 vs Face 1)...")
    same_person_result = compare_faces(face1_encoding, face1_image, 0.6)
    if same_person_result:
        print(f"   Distance: {same_person_result['distance']:.4f}")
        print(f"   Is Match: {same_person_result['is_match']}")
        print(f"   Expected: Should MATCH (distance < 0.6)")
        print(f"   Result: {'✅ CORRECT' if same_person_result['is_match'] else '❌ WRONG - Same person rejected!'}")
    
    print("\n4. Testing Different Person Verification (Face 1 vs Face 2)...")
    different_person_result = compare_faces(face1_encoding, face2_image, 0.6)
    if different_person_result:
        print(f"   Distance: {different_person_result['distance']:.4f}")
        print(f"   Is Match: {different_person_result['is_match']}")
        print(f"   Expected: Should NOT match (distance > 0.6)")
        print(f"   Result: {'✅ CORRECT' if not different_person_result['is_match'] else '🚨 SECURITY BREACH - Different person accepted!'}")
    
    print("\n5. Testing Reverse (Face 2 vs Face 1)...")
    reverse_result = compare_faces(face2_encoding, face1_image, 0.6)
    if reverse_result:
        print(f"   Distance: {reverse_result['distance']:.4f}")
        print(f"   Is Match: {reverse_result['is_match']}")
        print(f"   Expected: Should NOT match (distance > 0.6)")
        print(f"   Result: {'✅ CORRECT' if not reverse_result['is_match'] else '🚨 SECURITY BREACH - Different person accepted!'}")
    
    # Security Analysis
    print("\n" + "=" * 60)
    print("SECURITY ANALYSIS")
    print("=" * 60)
    
    if same_person_result and different_person_result and reverse_result:
        same_distance = same_person_result['distance']
        diff_distance = different_person_result['distance']
        reverse_distance = reverse_result['distance']
        
        print(f"Same person distance:      {same_distance:.4f} (should be < 0.6)")
        print(f"Different person distance: {diff_distance:.4f} (should be > 0.6)")
        print(f"Reverse distance:          {reverse_distance:.4f} (should be > 0.6)")
        
        # Check if the system can distinguish between people
        if diff_distance <= 0.6 or reverse_distance <= 0.6:
            print("\n🚨 CRITICAL SECURITY VULNERABILITY DETECTED!")
            print("   The face recognition system CANNOT distinguish between different people.")
            print("   This allows unauthorized access to other users' accounts.")
            print("\n   POSSIBLE CAUSES:")
            print("   - Face encoding algorithm is too simplistic")
            print("   - Face detection is not finding actual faces")
            print("   - Encoding normalization is removing distinguishing features")
            print("   - OpenCV face detection is inconsistent")
        else:
            print("\n✅ Face recognition security appears to be working correctly.")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    test_face_recognition_security()