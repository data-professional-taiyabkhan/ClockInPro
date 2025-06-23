#!/usr/bin/env python3
"""
Professional face recognition service using OpenCV and computer vision.
Provides encoding generation and face comparison for attendance systems.
"""

import cv2
import numpy as np
import base64
import json
import sys
from PIL import Image
import io

def process_image_to_rgb(image_data):
    """Convert base64 image to RGB numpy array."""
    try:
        # Remove data URL prefix if present
        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]
        
        # Decode base64
        image_bytes = base64.b64decode(image_data)
        
        # Open with PIL and convert to RGB
        pil_image = Image.open(io.BytesIO(image_bytes))
        rgb_image = pil_image.convert('RGB')
        
        # Convert to numpy array
        return np.array(rgb_image)
    except Exception as e:
        raise ValueError(f"Failed to process image: {str(e)}")

def generate_face_encoding(image_data):
    """Generate face encoding from image data using OpenCV."""
    try:
        # Convert image to RGB array
        rgb_array = process_image_to_rgb(image_data)
        
        # Convert to grayscale for face detection
        gray = cv2.cvtColor(rgb_array, cv2.COLOR_RGB2GRAY)
        
        # Load face detector
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        # Try multiple detection parameters for better face detection
        # First try with standard parameters
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(50, 50))
        
        # If no faces found, try more relaxed parameters
        if len(faces) == 0:
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=3, minSize=(30, 30))
        
        # If still no faces, try very relaxed parameters
        if len(faces) == 0:
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.02, minNeighbors=2, minSize=(20, 20))
        
        if len(faces) == 0:
            return {
                "success": False,
                "error": "No face detected in image",
                "encoding": None,
                "confidence": 0
            }
        
        # Get the largest face
        largest_face = max(faces, key=lambda rect: rect[2] * rect[3])
        x, y, w, h = largest_face
        
        # Extract face region
        face_roi = gray[y:y+h, x:x+w]
        
        # Resize to standard size for consistent comparison
        face_resized = cv2.resize(face_roi, (128, 128))
        
        # Generate feature vector using multiple descriptors
        encoding = []
        
        # 1. LBP (Local Binary Pattern) features
        lbp = cv2.calcHist([face_resized], [0], None, [256], [0, 256])
        encoding.extend(lbp.flatten().tolist())
        
        # 2. HOG-like features using gradients
        grad_x = cv2.Sobel(face_resized, cv2.CV_64F, 1, 0, ksize=3)
        grad_y = cv2.Sobel(face_resized, cv2.CV_64F, 0, 1, ksize=3)
        magnitude = np.sqrt(grad_x**2 + grad_y**2)
        orientation = np.arctan2(grad_y, grad_x)
        
        # Create gradient histogram
        hist, _ = np.histogram(orientation.flatten(), bins=36, range=(-np.pi, np.pi), weights=magnitude.flatten())
        encoding.extend(hist.tolist())
        
        # 3. Statistical features
        encoding.extend([
            float(np.mean(face_resized)),
            float(np.std(face_resized)),
            float(np.min(face_resized)),
            float(np.max(face_resized))
        ])
        
        # Calculate confidence based on face size and quality
        face_area = w * h
        image_area = rgb_array.shape[0] * rgb_array.shape[1]
        face_ratio = face_area / image_area
        
        # Higher confidence for larger, clearer faces
        confidence = min(95, 50 + (face_ratio * 400))
        
        return {
            "success": True,
            "encoding": encoding,
            "confidence": float(confidence),
            "face_location": [int(y), int(x+w), int(y+h), int(x)],  # top, right, bottom, left format
            "face_ratio": float(face_ratio)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "encoding": None,
            "confidence": 0
        }

def compare_faces(known_encoding, unknown_image_data, tolerance=0.3):
    """Compare a known face encoding with an unknown face image."""
    try:
        # Convert known encoding back to numpy array
        if isinstance(known_encoding, list):
            known_encoding = np.array(known_encoding)
        
        # Generate encoding for unknown image
        unknown_result = generate_face_encoding(unknown_image_data)
        
        if not unknown_result["success"]:
            return {
                "success": False,
                "match": False,
                "distance": 1.0,
                "confidence": 0,
                "error": unknown_result["error"]
            }
        
        unknown_encoding = np.array(unknown_result["encoding"])
        
        # Ensure both encodings have the same length
        min_length = min(len(known_encoding), len(unknown_encoding))
        known_encoding = known_encoding[:min_length]
        unknown_encoding = unknown_encoding[:min_length]
        
        # Calculate normalized Euclidean distance
        distance = np.linalg.norm(known_encoding - unknown_encoding)
        normalized_distance = distance / np.sqrt(len(known_encoding))
        
        # Determine if faces match based on tolerance
        is_match = normalized_distance <= tolerance
        
        # Calculate confidence percentage
        # Lower distance = higher confidence
        max_expected_distance = 1.0
        confidence = max(0, min(100, (1.0 - (normalized_distance / max_expected_distance)) * 100))
        
        return {
            "success": True,
            "match": bool(is_match),
            "distance": float(normalized_distance),
            "confidence": float(confidence),
            "tolerance": float(tolerance),
            "unknown_face_confidence": float(unknown_result["confidence"])
        }
        
    except Exception as e:
        return {
            "success": False,
            "match": False,
            "distance": 1.0,
            "confidence": 0,
            "error": str(e)
        }

def main():
    """Main function to handle command line operations."""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No operation specified"}))
        sys.exit(1)
    
    operation = sys.argv[1]
    
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        if operation == "encode":
            # Generate face encoding
            result = generate_face_encoding(input_data["image_data"])
            print(json.dumps(result))
            
        elif operation == "compare":
            # Compare faces
            result = compare_faces(
                input_data["known_encoding"],
                input_data["unknown_image"],
                input_data.get("tolerance", 0.6)
            )
            print(json.dumps(result))
            
        else:
            print(json.dumps({"error": f"Unknown operation: {operation}"}))
            sys.exit(1)
            
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()