#!/usr/bin/env python3
"""
Actual DeepFace implementation using the real DeepFace.verify function
No custom shit, just the actual library as requested
"""

import sys
import json
import base64
import io
import os
import tempfile
from PIL import Image

# Install DeepFace if not available
try:
    from deepface import DeepFace
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "DeepFace not installed. Install with: pip install deepface"
    }))
    sys.exit(1)

def process_image_from_base64(image_data):
    """Convert base64 image to temporary file for DeepFace."""
    try:
        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]
        
        image_bytes = base64.b64decode(image_data)
        pil_image = Image.open(io.BytesIO(image_bytes))
        
        if pil_image.mode != 'RGB':
            pil_image = pil_image.convert('RGB')
        
        # Save to temporary file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
        pil_image.save(temp_file.name, 'JPEG')
        temp_file.close()
        
        return temp_file.name
    except Exception as e:
        raise Exception(f"Failed to process image: {str(e)}")

def store_face_image(image_data):
    """Store face image - just return the image data."""
    return image_data

def verify_faces_with_actual_deepface(registered_image_data, captured_image_data):
    """Verify faces using actual DeepFace.verify function."""
    temp_files = []
    try:
        # Convert base64 images to temporary files
        registered_path = process_image_from_base64(registered_image_data)
        captured_path = process_image_from_base64(captured_image_data)
        temp_files = [registered_path, captured_path]
        
        # Use actual DeepFace.verify function
        result = DeepFace.verify(
            img1_path=registered_path,
            img2_path=captured_path,
            model_name='Facenet',
            detector_backend='opencv'
        )
        
        return {
            "verified": bool(result['verified']),
            "distance": float(result['distance']),
            "threshold": float(result['threshold']),
            "model": result['model']
        }
        
    except Exception as e:
        raise Exception(f"DeepFace verification failed: {str(e)}")
    finally:
        # Clean up temporary files
        for temp_file in temp_files:
            try:
                if os.path.exists(temp_file):
                    os.unlink(temp_file)
            except:
                pass

def main():
    """Main function to handle operations."""
    try:
        if len(sys.argv) > 1:
            operation = sys.argv[1]
            
            if operation == "store":
                input_data = sys.stdin.read()
                data = json.loads(input_data)
                image_data = data.get('image_data', '')
                
                stored_data = store_face_image(image_data)
                
                print(json.dumps({
                    "success": True,
                    "image_data": stored_data
                }))
                
            elif operation == "verify":
                input_data = sys.stdin.read()
                data = json.loads(input_data)
                
                registered_image = data.get('registered_image', '')
                captured_image = data.get('captured_image', '')
                
                result = verify_faces_with_actual_deepface(registered_image, captured_image)
                
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