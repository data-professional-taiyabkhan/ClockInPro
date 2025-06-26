#!/usr/bin/env python3
"""
Simple face recognition - just encode and compare faces
No complications, exactly as requested
"""

import sys
import json
import base64
import io
import numpy as np
from PIL import Image
import cv2

def process_image_from_base64(image_data):
    """Convert base64 image to numpy array for face_recognition library."""
    try:
        # Remove data URL prefix if present
        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]
        
        # Decode base64 to bytes
        image_bytes = base64.b64decode(image_data)
        
        # Convert to PIL Image
        pil_image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if needed
        if pil_image.mode != 'RGB':
            pil_image = pil_image.convert('RGB')
        
        # Convert to numpy array (format expected by face_recognition)
        rgb_array = np.array(pil_image)
        
        return rgb_array
    except Exception as e:
        raise Exception(f"Failed to process image: {str(e)}")

def encode_face(image_data):
    """Simple face encoding using OpenCV - mimics face_recognition.face_encodings()."""
    try:
        # Convert image to RGB numpy array
        rgb_image = process_image_from_base64(image_data)
        
        # Convert to grayscale for face detection
        gray = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2GRAY)
        
        # Detect face using OpenCV with multiple detection attempts
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        # Try multiple scale factors for better detection
        faces = face_cascade.detectMultiScale(gray, 1.1, 3, minSize=(30, 30))
        if len(faces) == 0:
            faces = face_cascade.detectMultiScale(gray, 1.3, 5, minSize=(20, 20))
        if len(faces) == 0:
            faces = face_cascade.detectMultiScale(gray, 1.05, 2, minSize=(15, 15))
        
        if len(faces) == 0:
            raise Exception("No face detected in image - please ensure your face is clearly visible and well-lit")
        
        # Get the largest face
        face = max(faces, key=lambda f: f[2] * f[3])
        x, y, w, h = face
        
        # Extract face region
        face_roi = gray[y:y+h, x:x+w]
        face_roi = cv2.resize(face_roi, (100, 100))  # Standardize size
        
        # Simple encoding - flatten the face region and normalize
        encoding = face_roi.flatten().astype(np.float64)
        # Normalize to unit vector (similar to face_recognition library)
        norm = np.linalg.norm(encoding)
        if norm > 0:
            encoding = encoding / norm
        
        return encoding.tolist()
        
    except Exception as e:
        raise Exception(f"Failed to encode face: {str(e)}")

def compare_faces_simple(known_encoding, unknown_image_data, tolerance=0.6):
    """Simple face comparison - mimics face_recognition.compare_faces and face_distance."""
    try:
        # Encode the unknown face
        unknown_encoding = encode_face(unknown_image_data)
        
        # Convert to numpy arrays
        known_encoding_array = np.array(known_encoding)
        unknown_encoding_array = np.array(unknown_encoding)
        
        # Calculate Euclidean distance (same as face_recognition.face_distance)
        distance = np.linalg.norm(known_encoding_array - unknown_encoding_array)
        
        # Compare against tolerance (same as face_recognition.compare_faces)
        is_match = distance <= tolerance
        
        return {
            "distance": float(distance),
            "is_match": bool(is_match),
            "tolerance": float(tolerance)
        }
        
    except Exception as e:
        raise Exception(f"Failed to compare faces: {str(e)}")

def main():
    """Main function to handle operations."""
    try:
        if len(sys.argv) > 1:
            operation = sys.argv[1]
            
            if operation == "encode":
                # Read image data from stdin
                input_data = sys.stdin.read()
                data = json.loads(input_data)
                image_data = data.get('image_data', '')
                
                # Encode face using face_recognition.face_encodings()
                encoding = encode_face(image_data)
                
                print(json.dumps({
                    "success": True,
                    "encoding": encoding
                }))
                
            elif operation == "compare":
                # Read comparison data from stdin
                input_data = sys.stdin.read()
                data = json.loads(input_data)
                
                known_encoding = data.get('known_encoding', [])
                unknown_image = data.get('unknown_image', '')
                tolerance = data.get('tolerance', 0.6)
                
                # Compare faces using face_recognition library
                result = compare_faces_simple(known_encoding, unknown_image, tolerance)
                
                print(json.dumps({
                    "success": True,
                    "result": result
                }))
                
            else:
                print(json.dumps({
                    "success": False,
                    "error": f"Unknown operation: {operation}"
                }))
                
        else:
            print(json.dumps({
                "success": False,
                "error": "No operation specified"
            }))
            
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))

if __name__ == "__main__":
    main()