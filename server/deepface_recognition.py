#!/usr/bin/env python3
"""
DeepFace implementation for face verification
Uses DeepFace with Facenet model to match desktop system results
"""

import sys
import json
import base64
import io
import os
import tempfile
from PIL import Image
from deepface import DeepFace

def process_image_from_base64(image_data, save_path):
    """Convert base64 image to file and save it."""
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
        
        # Save as JPEG
        pil_image.save(save_path, 'JPEG', quality=95)
        
        return True
    except Exception as e:
        raise Exception(f"Failed to process image: {str(e)}")

def store_face_image(image_data):
    """Store face image and return just the base64 data (no encoding needed)."""
    try:
        # For DeepFace, we don't need to generate encodings
        # We just store the image data and compare images directly
        return image_data
        
    except Exception as e:
        raise Exception(f"Failed to store face image: {str(e)}")

def verify_faces_with_deepface(registered_image_data, captured_image_data):
    """Compare two face images using DeepFace with Facenet model."""
    try:
        # Create temporary files for the images
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as registered_file:
            registered_path = registered_file.name
            
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as captured_file:
            captured_path = captured_file.name
        
        try:
            # Save both images to temporary files
            process_image_from_base64(registered_image_data, registered_path)
            process_image_from_base64(captured_image_data, captured_path)
            
            # Use DeepFace to verify the faces with Facenet model
            result = DeepFace.verify(
                img1_path=registered_path,
                img2_path=captured_path,
                model_name="Facenet",
                enforce_detection=True
            )
            
            return {
                "verified": bool(result["verified"]),
                "distance": float(result["distance"]),
                "threshold": float(result["threshold"]),
                "model": "Facenet"
            }
            
        finally:
            # Clean up temporary files
            try:
                os.unlink(registered_path)
                os.unlink(captured_path)
            except:
                pass
                
    except Exception as e:
        raise Exception(f"Failed to verify faces: {str(e)}")

def main():
    """Main function to handle operations."""
    try:
        if len(sys.argv) > 1:
            operation = sys.argv[1]
            
            if operation == "store":
                # Store face image (no encoding needed for DeepFace)
                input_data = sys.stdin.read()
                data = json.loads(input_data)
                image_data = data.get('image_data', '')
                
                stored_data = store_face_image(image_data)
                
                print(json.dumps({
                    "success": True,
                    "image_data": stored_data
                }))
                
            elif operation == "verify":
                # Verify faces using DeepFace
                input_data = sys.stdin.read()
                data = json.loads(input_data)
                
                registered_image = data.get('registered_image', '')
                captured_image = data.get('captured_image', '')
                
                result = verify_faces_with_deepface(registered_image, captured_image)
                
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