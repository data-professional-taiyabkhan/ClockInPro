#!/usr/bin/env python3
"""
Proper face recognition using the face_recognition library
Exactly matching the desktop system approach described by the user
"""

import sys
import json
import base64
import io
import numpy as np
from PIL import Image
import face_recognition

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
    """
    Encode face using face_recognition.face_encodings()
    Exactly as described by the user for their desktop system
    """
    try:
        # Convert image to RGB numpy array
        rgb_image = process_image_from_base64(image_data)
        
        # Use face_recognition.face_encodings() - the exact function user mentioned
        face_encodings = face_recognition.face_encodings(rgb_image)
        
        if len(face_encodings) == 0:
            raise Exception("No face detected in image - please ensure your face is clearly visible and well-lit")
        
        # Return the first (and usually only) face encoding
        # Convert to list for JSON serialization
        encoding = face_encodings[0].tolist()
        
        return encoding
        
    except Exception as e:
        raise Exception(f"Failed to encode face: {str(e)}")

def compare_faces_proper(known_encoding, unknown_image_data, tolerance=0.6):
    """
    Compare faces using face_recognition.compare_faces and face_recognition.face_distance
    Exactly as described by the user for their desktop system
    """
    try:
        # Step 1: Encode the test image (webcam image)
        encoded_test_image = encode_face(unknown_image_data)
        
        # Step 2: Use face_recognition.compare_faces - exact function user mentioned
        # known_encoding is the uploaded_image encoding stored in database
        # encoded_test_image is the webcam image encoding
        result = face_recognition.compare_faces([known_encoding], encoded_test_image, tolerance=tolerance)
        
        # Step 3: Use face_recognition.face_distance - exact function user mentioned
        distance = face_recognition.face_distance([known_encoding], encoded_test_image)
        
        # Extract the single result and distance value
        is_match = result[0] if len(result) > 0 else False
        face_distance = distance[0] if len(distance) > 0 else 1.0
        
        return {
            "distance": float(face_distance),
            "is_match": bool(is_match),
            "tolerance": tolerance
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
                result = compare_faces_proper(known_encoding, unknown_image, tolerance)
                
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