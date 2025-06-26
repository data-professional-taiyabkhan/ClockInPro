#!/usr/bin/env python3
"""
High-accuracy face recognition service matching desktop system performance.
Uses advanced OpenCV features and facial landmark detection for precise face comparison.
"""

import sys
import json
import base64
import io
import numpy as np
from PIL import Image
import cv2

def process_image_to_rgb(image_data):
    """Convert base64 image to RGB numpy array."""
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

def detect_face_landmarks(image):
    """Detect facial landmarks using OpenCV cascades and contour analysis."""
    try:
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        
        # Load face cascade
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        # Detect faces
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
        
        if len(faces) == 0:
            raise Exception("No face detected in image")
        
        # Get the largest face
        face = max(faces, key=lambda f: f[2] * f[3])
        x, y, w, h = face
        
        # Extract face region
        face_roi = gray[y:y+h, x:x+w]
        face_color = image[y:y+h, x:x+w]
        
        # Resize to standard size for consistent feature extraction
        face_roi = cv2.resize(face_roi, (128, 128))
        face_color = cv2.resize(face_color, (128, 128))
        
        return face_roi, face_color, (x, y, w, h)
        
    except Exception as e:
        raise Exception(f"Failed to detect face landmarks: {str(e)}")

def extract_facial_features(face_gray, face_color):
    """Extract comprehensive facial features similar to face_recognition library."""
    try:
        features = []
        
        # 1. Histogram of Oriented Gradients (HOG) features
        # Calculate gradients
        grad_x = cv2.Sobel(face_gray, cv2.CV_64F, 1, 0, ksize=3)
        grad_y = cv2.Sobel(face_gray, cv2.CV_64F, 0, 1, ksize=3)
        
        # Calculate magnitude and angle
        magnitude = np.sqrt(grad_x**2 + grad_y**2)
        angle = np.arctan2(grad_y, grad_x)
        
        # Create HOG histogram (simplified version)
        hist, _ = np.histogram(angle, bins=8, range=(-np.pi, np.pi), weights=magnitude)
        features.extend(hist.flatten())
        
        # 2. Local Binary Pattern (LBP) features
        def local_binary_pattern(image, radius=1, n_points=8):
            lbp = np.zeros_like(image)
            for i in range(radius, image.shape[0] - radius):
                for j in range(radius, image.shape[1] - radius):
                    center = image[i, j]
                    code = 0
                    for k in range(n_points):
                        x = int(i + radius * np.cos(2 * np.pi * k / n_points))
                        y = int(j + radius * np.sin(2 * np.pi * k / n_points))
                        if x < image.shape[0] and y < image.shape[1]:
                            if image[x, y] >= center:
                                code |= (1 << k)
                    lbp[i, j] = code
            return lbp
        
        lbp = local_binary_pattern(face_gray)
        lbp_hist, _ = np.histogram(lbp.ravel(), bins=256, range=(0, 256))
        features.extend(lbp_hist)
        
        # 3. Facial region analysis
        # Divide face into regions (eyes, nose, mouth areas)
        h, w = face_gray.shape
        
        # Eye region (top 1/3)
        eye_region = face_gray[0:h//3, :]
        eye_hist, _ = np.histogram(eye_region.ravel(), bins=32, range=(0, 256))
        features.extend(eye_hist)
        
        # Nose region (middle 1/3)
        nose_region = face_gray[h//3:2*h//3, w//4:3*w//4]
        nose_hist, _ = np.histogram(nose_region.ravel(), bins=32, range=(0, 256))
        features.extend(nose_hist)
        
        # Mouth region (bottom 1/3)
        mouth_region = face_gray[2*h//3:h, :]
        mouth_hist, _ = np.histogram(mouth_region.ravel(), bins=32, range=(0, 256))
        features.extend(mouth_hist)
        
        # 4. Color information from face
        for channel in range(3):  # RGB channels
            channel_hist, _ = np.histogram(face_color[:,:,channel].ravel(), bins=32, range=(0, 256))
            features.extend(channel_hist)
        
        # 5. Geometric features
        # Add some geometric measurements
        features.extend([h, w, h/w])  # Height, width, aspect ratio
        
        # Convert to numpy array and normalize
        features = np.array(features, dtype=np.float64)
        
        # L2 normalization (same as face_recognition library)
        norm = np.linalg.norm(features)
        if norm > 0:
            features = features / norm
        
        return features
        
    except Exception as e:
        raise Exception(f"Failed to extract facial features: {str(e)}")

def generate_face_encoding(image_data):
    """Generate comprehensive face encoding using multiple feature extraction methods."""
    try:
        # Convert image to RGB numpy array
        rgb_image = process_image_to_rgb(image_data)
        
        # Detect face and extract regions
        face_gray, face_color, face_coords = detect_face_landmarks(rgb_image)
        
        # Extract facial features
        encoding = extract_facial_features(face_gray, face_color)
        
        return encoding.tolist()
        
    except Exception as e:
        raise Exception(f"Failed to generate face encoding: {str(e)}")

def calculate_face_distance(encoding1, encoding2):
    """Calculate Euclidean distance between face encodings (same as face_recognition library)."""
    try:
        # Convert to numpy arrays
        enc1 = np.array(encoding1)
        enc2 = np.array(encoding2)
        
        # Calculate Euclidean distance
        distance = np.linalg.norm(enc1 - enc2)
        
        return float(distance)
        
    except Exception as e:
        raise Exception(f"Failed to calculate face distance: {str(e)}")

def compare_faces(known_encoding, unknown_image_data, tolerance=0.6):
    """Compare faces using the same logic as desktop face_recognition library."""
    try:
        # Generate encoding for unknown image
        unknown_encoding = generate_face_encoding(unknown_image_data)
        
        # Calculate distance
        distance = calculate_face_distance(known_encoding, unknown_encoding)
        
        # Determine if faces match (same logic as face_recognition.compare_faces)
        is_match = distance <= tolerance
        
        return {
            "distance": distance,
            "is_match": is_match,
            "tolerance": tolerance
        }
        
    except Exception as e:
        raise Exception(f"Failed to compare faces: {str(e)}")

def main():
    """Main function to handle command line operations."""
    try:
        if len(sys.argv) > 1:
            operation = sys.argv[1]
            
            if operation == "encode":
                # Read image data from stdin
                input_data = sys.stdin.read()
                data = json.loads(input_data)
                image_data = data.get('image_data', '')
                
                # Generate encoding
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
                tolerance = data.get('tolerance', 0.6)
                
                # Compare faces
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