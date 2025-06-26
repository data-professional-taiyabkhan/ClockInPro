#!/usr/bin/env python3
"""
Simple face recognition using face_recognition library
Exactly as requested - no complications, just encode and compare
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
    """Use face_recognition.face_encodings() to encode the face."""
    try:
        # Convert image to RGB numpy array
        rgb_image = process_image_from_base64(image_data)
        
        # Use face_recognition library to encode face
        face_encodings = face_recognition.face_encodings(rgb_image)
        
        if len(face_encodings) == 0:
            raise Exception("No face detected in image")
        
        # Return the first face encoding (there should only be one)
        encoding = face_encodings[0]
        
        return encoding.tolist()
        
    except Exception as e:
        raise Exception(f"Failed to encode face: {str(e)}")

def compare_faces_simple(known_encoding, unknown_image_data, tolerance=0.6):
    """Simple face comparison using face_recognition.compare_faces and face_recognition.face_distance."""
    try:
        # Encode the unknown face
        unknown_encoding = encode_face(unknown_image_data)
        
        # Convert known encoding to numpy array
        known_encoding_array = np.array(known_encoding)
        unknown_encoding_array = np.array(unknown_encoding)
        
        # Use face_recognition.compare_faces() 
        matches = face_recognition.compare_faces([known_encoding_array], unknown_encoding_array, tolerance=tolerance)
        
        # Use face_recognition.face_distance() to get the distance
        distances = face_recognition.face_distance([known_encoding_array], unknown_encoding_array)
        distance = distances[0]
        
        return {
            "distance": float(distance),
            "is_match": matches[0],
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