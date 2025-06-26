#!/usr/bin/env python3
"""
Reliable face recognition using OpenCV DNN for face detection and simple but effective feature extraction
Designed to properly distinguish between different people while maintaining compatibility
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

def detect_face_robust(image):
    """Detect face using multiple OpenCV methods for better reliability."""
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    
    # Method 1: Haar cascade (most reliable for basic face detection)
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    
    # Try multiple parameters for better detection - more aggressive detection
    detection_params = [
        (1.1, 3, (20, 20)),  # More sensitive detection
        (1.05, 5, (15, 15)), # Very sensitive
        (1.3, 2, (25, 25)),  # Less sensitive but different scale
        (1.1, 4, (10, 10)),  # Very small faces
        (1.2, 3, (30, 30)),  # Medium faces
        (1.15, 4, (20, 20)), # Balanced
    ]
    
    faces = []
    for scale_factor, min_neighbors, min_size in detection_params:
        faces = face_cascade.detectMultiScale(gray, scale_factor, min_neighbors, minSize=min_size)
        if len(faces) > 0:
            break
    
    # Try profile face detection if frontal failed
    if len(faces) == 0:
        profile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
        faces = profile_cascade.detectMultiScale(gray, 1.1, 3, minSize=(20, 20))
    
    # Try alternative face detection method
    if len(faces) == 0:
        alt_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt.xml')
        faces = alt_cascade.detectMultiScale(gray, 1.1, 3, minSize=(20, 20))
    
    if len(faces) == 0:
        raise Exception("No face detected in image - please ensure your face is clearly visible and well-lit")
    
    # Get the largest face
    face = max(faces, key=lambda f: f[2] * f[3])
    return face

def extract_face_features(image, face_box):
    """Extract distinctive facial features that can differentiate between people."""
    x, y, w, h = face_box
    
    # Extract face region with some padding
    padding = int(min(w, h) * 0.15)
    x_start = max(0, x - padding)
    y_start = max(0, y - padding)
    x_end = min(image.shape[1], x + w + padding)
    y_end = min(image.shape[0], y + h + padding)
    
    # Convert to grayscale for feature extraction
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    face_roi = gray[y_start:y_end, x_start:x_end]
    
    # Resize to standard size
    face_roi = cv2.resize(face_roi, (96, 96))
    
    features = []
    
    # 1. Histogram features (captures overall intensity distribution)
    hist = cv2.calcHist([face_roi], [0], None, [32], [0, 256])
    hist = hist.flatten() / np.sum(hist)  # Normalize
    features.extend(hist)
    
    # 2. Gradient magnitude features (captures edges and textures)
    grad_x = cv2.Sobel(face_roi, cv2.CV_64F, 1, 0, ksize=3)
    grad_y = cv2.Sobel(face_roi, cv2.CV_64F, 0, 1, ksize=3)
    magnitude = np.sqrt(grad_x**2 + grad_y**2)
    
    # Divide into 6x6 grid for spatial information
    h, w = magnitude.shape
    cell_h, cell_w = h // 6, w // 6
    
    for i in range(6):
        for j in range(6):
            cell = magnitude[i*cell_h:(i+1)*cell_h, j*cell_w:(j+1)*cell_w]
            if cell.size > 0:
                features.extend([
                    np.mean(cell),
                    np.std(cell),
                    np.max(cell)
                ])
    
    # 3. Local Binary Pattern-like features (captures local texture)
    for i in range(1, 95):
        for j in range(1, 95):
            center = face_roi[i, j]
            # Simple 8-neighbor comparison
            neighbors = [
                face_roi[i-1, j-1], face_roi[i-1, j], face_roi[i-1, j+1],
                face_roi[i, j-1],                     face_roi[i, j+1],
                face_roi[i+1, j-1], face_roi[i+1, j], face_roi[i+1, j+1]
            ]
            binary_pattern = sum([(1 if neighbor >= center else 0) * (2**k) for k, neighbor in enumerate(neighbors)])
            features.append(binary_pattern / 255.0)  # Normalize
    
    # 4. Facial region features
    h, w = face_roi.shape
    regions = {
        'forehead': face_roi[0:h//3, w//4:3*w//4],
        'left_eye': face_roi[h//3:2*h//3, 0:w//2],
        'right_eye': face_roi[h//3:2*h//3, w//2:w],
        'nose': face_roi[h//3:2*h//3, w//3:2*w//3],
        'mouth': face_roi[2*h//3:h, w//4:3*w//4]
    }
    
    for region_name, region in regions.items():
        if region.size > 0:
            features.extend([
                np.mean(region),
                np.std(region),
                np.median(region)
            ])
    
    # Convert to numpy array and normalize
    features = np.array(features, dtype=np.float64)
    
    # L2 normalization
    norm = np.linalg.norm(features)
    if norm > 0:
        features = features / norm
    
    return features

def encode_face(image_data):
    """Generate face encoding."""
    try:
        # Convert image to RGB numpy array
        rgb_image = process_image_from_base64(image_data)
        
        # Detect face
        face_box = detect_face_robust(rgb_image)
        
        # Extract features
        encoding = extract_face_features(rgb_image, face_box)
        
        return encoding.tolist()
        
    except Exception as e:
        raise Exception(f"Failed to encode face: {str(e)}")

def compare_faces_reliable(known_encoding, unknown_image_data, tolerance=0.6):
    """Compare faces using Euclidean distance."""
    try:
        # Encode the unknown face
        unknown_encoding = encode_face(unknown_image_data)
        
        # Convert to numpy arrays
        known_array = np.array(known_encoding)
        unknown_array = np.array(unknown_encoding)
        
        # Calculate Euclidean distance
        distance = np.linalg.norm(known_array - unknown_array)
        
        # Compare against tolerance
        is_match = distance <= tolerance
        
        return {
            "distance": float(distance),
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
                
                # Encode face
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
                
                # Compare faces
                result = compare_faces_reliable(known_encoding, unknown_image, tolerance)
                
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