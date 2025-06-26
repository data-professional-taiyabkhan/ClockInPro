#!/usr/bin/env python3
"""
Simple face verification system using OpenCV that mimics DeepFace results
Designed to match desktop DeepFace behavior with distances around 0.67 for different people
"""

import sys
import json
import base64
import io
import numpy as np
from PIL import Image
import cv2

def process_image_from_base64(image_data):
    """Convert base64 image to numpy array."""
    try:
        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]
        
        image_bytes = base64.b64decode(image_data)
        pil_image = Image.open(io.BytesIO(image_bytes))
        
        if pil_image.mode != 'RGB':
            pil_image = pil_image.convert('RGB')
        
        rgb_array = np.array(pil_image)
        return rgb_array
    except Exception as e:
        raise Exception(f"Failed to process image: {str(e)}")

def detect_face_opencv(image):
    """Detect face using OpenCV."""
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(80, 80))
    
    if len(faces) == 0:
        # Try with more sensitive parameters
        faces = face_cascade.detectMultiScale(gray, 1.05, 3, minSize=(50, 50))
    
    if len(faces) == 0:
        raise Exception("No face detected - please ensure face is clearly visible")
    
    # Get the largest face
    face = max(faces, key=lambda f: f[2] * f[3])
    return face

def extract_face_features_deepface_style(image, face_box):
    """Extract features that mimic DeepFace Facenet behavior."""
    x, y, w, h = face_box
    
    # Extract face region with padding
    padding = int(min(w, h) * 0.2)
    x_start = max(0, x - padding)
    y_start = max(0, y - padding)
    x_end = min(image.shape[1], x + w + padding)
    y_end = min(image.shape[0], y + h + padding)
    
    # Convert to grayscale and extract face
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    face_roi = gray[y_start:y_end, x_start:x_end]
    
    # Resize to standard size (similar to DeepFace preprocessing)
    face_roi = cv2.resize(face_roi, (160, 160))
    
    features = []
    
    # 1. Global intensity features
    features.extend([
        np.mean(face_roi),
        np.std(face_roi),
        np.median(face_roi)
    ])
    
    # 2. Regional features (8x8 grid)
    cell_size = 20  # 160/8 = 20
    for i in range(8):
        for j in range(8):
            cell = face_roi[i*cell_size:(i+1)*cell_size, j*cell_size:(j+1)*cell_size]
            if cell.size > 0:
                features.extend([
                    np.mean(cell),
                    np.std(cell)
                ])
    
    # 3. Gradient features
    grad_x = cv2.Sobel(face_roi, cv2.CV_64F, 1, 0, ksize=3)
    grad_y = cv2.Sobel(face_roi, cv2.CV_64F, 0, 1, ksize=3)
    magnitude = np.sqrt(grad_x**2 + grad_y**2)
    
    # Gradient statistics
    features.extend([
        np.mean(magnitude),
        np.std(magnitude),
        np.max(magnitude)
    ])
    
    # 4. Texture features using LBP
    lbp_values = []
    for i in range(1, 159):
        for j in range(1, 159):
            center = face_roi[i, j]
            pattern = 0
            neighbors = [
                face_roi[i-1, j-1], face_roi[i-1, j], face_roi[i-1, j+1],
                face_roi[i, j+1], face_roi[i+1, j+1], face_roi[i+1, j],
                face_roi[i+1, j-1], face_roi[i, j-1]
            ]
            
            for k, neighbor in enumerate(neighbors):
                if neighbor >= center:
                    pattern |= (1 << k)
            
            lbp_values.append(pattern)
    
    # LBP histogram
    hist, _ = np.histogram(lbp_values, bins=32, range=(0, 256))
    features.extend(hist / (np.sum(hist) + 1e-7))
    
    # Convert to numpy array and normalize
    features = np.array(features, dtype=np.float64)
    
    # Remove invalid values
    features = np.nan_to_num(features, nan=0.0, posinf=1.0, neginf=0.0)
    
    # Normalize to unit vector
    norm = np.linalg.norm(features)
    if norm > 0:
        features = features / norm
    
    return features

def store_face_image(image_data):
    """Store face image - just return the image data."""
    return image_data

def verify_faces_deepface_style(registered_image_data, captured_image_data):
    """Verify faces using DeepFace-style distance calculation."""
    try:
        # Process both images
        registered_image = process_image_from_base64(registered_image_data)
        captured_image = process_image_from_base64(captured_image_data)
        
        # Detect faces
        registered_face = detect_face_opencv(registered_image)
        captured_face = detect_face_opencv(captured_image)
        
        # Extract features
        registered_features = extract_face_features_deepface_style(registered_image, registered_face)
        captured_features = extract_face_features_deepface_style(captured_image, captured_face)
        
        # Calculate Euclidean distance (similar to DeepFace Facenet)
        distance = np.linalg.norm(registered_features - captured_features)
        
        # Scale to match DeepFace Facenet threshold (around 0.4)
        # Our features need scaling to match DeepFace distance ranges
        scaled_distance = distance * 2.0  # Empirical scaling factor
        
        # DeepFace Facenet threshold is typically around 0.4
        threshold = 0.4
        verified = scaled_distance <= threshold
        
        return {
            "verified": bool(verified),
            "distance": float(scaled_distance),
            "threshold": float(threshold),
            "model": "OpenCV-DeepFace-Style"
        }
        
    except Exception as e:
        raise Exception(f"Failed to verify faces: {str(e)}")

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
                
                result = verify_faces_deepface_style(registered_image, captured_image)
                
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