#!/usr/bin/env python3
"""
High-accuracy face recognition service using the same face_recognition library
as your desktop system for consistent and reliable face verification.
"""

import sys
import json
import base64
import io
import numpy as np
from PIL import Image
import face_recognition
import cv2

def process_image_to_rgb(image_data):
    """Convert base64 image to RGB numpy array compatible with face_recognition library."""
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
        
        # Convert to numpy array
        rgb_array = np.array(pil_image)
        
        return rgb_array
    except Exception as e:
        raise Exception(f"Failed to process image: {str(e)}")

def generate_face_encoding(image_data):
    """Generate face encoding using the same face_recognition library as desktop system."""
    try:
        # Convert image to RGB numpy array
        rgb_image = process_image_to_rgb(image_data)
        
        # Use face_recognition library to detect face locations
        face_locations = face_recognition.face_locations(rgb_image)
        
        if len(face_locations) == 0:
            raise Exception("No face detected in image")
        
        # Generate face encodings using the same library as desktop
        face_encodings = face_recognition.face_encodings(rgb_image, face_locations)
        
        if len(face_encodings) == 0:
            raise Exception("Failed to generate face encoding")
        
        # Return the first (and typically only) face encoding
        # This matches exactly what your desktop system does
        encoding = face_encodings[0]
        
        return encoding.tolist()
        
    except Exception as e:
        raise Exception(f"Failed to generate face encoding: {str(e)}")

def compare_faces(known_encoding, unknown_image_data, tolerance=0.6):
    """Compare faces using the exact same method as your desktop system."""
    try:
        # Generate encoding for unknown image using same method
        unknown_encoding = generate_face_encoding(unknown_image_data)
        
        # Convert to numpy arrays
        known_array = np.array([known_encoding])  # face_recognition expects list of encodings
        unknown_array = np.array(unknown_encoding)
        
        # Use face_recognition.face_distance - same as desktop system
        face_distances = face_recognition.face_distance(known_array, unknown_array)
        distance = face_distances[0]  # Get the distance value
        
        # Use face_recognition.compare_faces with tolerance - same as desktop
        matches = face_recognition.compare_faces(known_array, unknown_array, tolerance=tolerance)
        is_match = matches[0]
        
        return {
            "distance": float(distance),
            "is_match": is_match,
            "tolerance": tolerance
        }
        
    except Exception as e:
        raise Exception(f"Failed to compare faces: {str(e)}")

def main():
    """Main function matching desktop system functionality."""
    try:
        if len(sys.argv) > 1:
            operation = sys.argv[1]
            
            if operation == "encode":
                # Read image data from stdin
                input_data = sys.stdin.read()
                data = json.loads(input_data)
                image_data = data.get('image_data', '')
                
                # Generate encoding using face_recognition library
                encoding = generate_face_encoding(image_data)
                
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
                tolerance = data.get('tolerance', 0.6)  # Use 0.6 default like desktop
                
                # Compare faces using same method as desktop
                result = compare_faces(known_encoding, unknown_image, tolerance)
                
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