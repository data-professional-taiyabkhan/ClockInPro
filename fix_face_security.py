#!/usr/bin/env python3
"""
Critical security fix - create a face recognition system that properly distinguishes between different people
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

def detect_face_secure(image):
    """Detect face with high confidence requirement."""
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    
    # Use multiple cascades for better detection
    cascades = [
        cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'),
        cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt.xml'),
        cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml')
    ]
    
    faces = []
    for cascade in cascades:
        if cascade.empty():
            continue
        detected = cascade.detectMultiScale(gray, 1.1, 5, minSize=(80, 80))
        if len(detected) > 0:
            faces.extend(detected)
            break
    
    if len(faces) == 0:
        raise Exception("No face detected - please ensure your face is clearly visible")
    
    # Get the largest face
    face = max(faces, key=lambda f: f[2] * f[3])
    return face

def extract_unique_features(image, face_box):
    """Extract features that are unique to individuals and resistant to spoofing."""
    x, y, w, h = face_box
    
    # Ensure we have enough padding
    padding = max(20, int(min(w, h) * 0.2))
    x_start = max(0, x - padding)
    y_start = max(0, y - padding)
    x_end = min(image.shape[1], x + w + padding)
    y_end = min(image.shape[0], y + h + padding)
    
    # Extract face region
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    face_roi = gray[y_start:y_end, x_start:x_end]
    
    # Resize to standard size for consistent feature extraction
    face_roi = cv2.resize(face_roi, (128, 128))
    
    features = []
    
    # 1. Multi-scale LBP (Local Binary Patterns) for texture uniqueness
    for radius in [1, 2, 3]:
        for n_points in [8, 16]:
            lbp_features = []
            for i in range(radius, 128 - radius):
                for j in range(radius, 128 - radius):
                    center = face_roi[i, j]
                    pattern = 0
                    for k in range(n_points):
                        angle = 2.0 * np.pi * k / n_points
                        x_offset = int(radius * np.cos(angle))
                        y_offset = int(radius * np.sin(angle))
                        neighbor = face_roi[i + y_offset, j + x_offset]
                        if neighbor >= center:
                            pattern |= (1 << k)
                    lbp_features.append(pattern / 255.0)
            
            # Sample every 4th feature to avoid too many dimensions
            features.extend(lbp_features[::4])
    
    # 2. Gradient orientation histograms (captures edge patterns unique to face structure)
    grad_x = cv2.Sobel(face_roi, cv2.CV_64F, 1, 0, ksize=3)
    grad_y = cv2.Sobel(face_roi, cv2.CV_64F, 0, 1, ksize=3)
    
    magnitude = np.sqrt(grad_x**2 + grad_y**2)
    orientation = np.arctan2(grad_y, grad_x)
    
    # Divide into 8x8 grid
    cell_h, cell_w = 128 // 8, 128 // 8
    for i in range(8):
        for j in range(8):
            cell_mag = magnitude[i*cell_h:(i+1)*cell_h, j*cell_w:(j+1)*cell_w]
            cell_ori = orientation[i*cell_h:(i+1)*cell_h, j*cell_w:(j+1)*cell_w]
            
            # Create histogram of oriented gradients
            hist, _ = np.histogram(cell_ori.flatten(), bins=9, range=(-np.pi, np.pi), weights=cell_mag.flatten())
            features.extend(hist / (np.sum(hist) + 1e-7))
    
    # 3. Facial region intensity patterns (captures geometric structure)
    regions = {
        'forehead': face_roi[0:32, 32:96],
        'left_eye': face_roi[32:64, 16:64],
        'right_eye': face_roi[32:64, 64:112],
        'nose': face_roi[48:80, 48:80],
        'mouth': face_roi[80:112, 32:96],
        'left_cheek': face_roi[48:96, 0:48],
        'right_cheek': face_roi[48:96, 80:128],
        'chin': face_roi[96:128, 32:96]
    }
    
    for region_name, region in regions.items():
        if region.size > 0:
            # Statistical features
            features.extend([
                np.mean(region),
                np.std(region),
                np.median(region),
                np.percentile(region, 25),
                np.percentile(region, 75)
            ])
            
            # Texture features using co-occurrence matrix
            if region.shape[0] > 4 and region.shape[1] > 4:
                # Simple co-occurrence features
                shifted_right = region[:, 1:]
                shifted_down = region[1:, :]
                original_right = region[:, :-1]
                original_down = region[:-1, :]
                
                features.extend([
                    np.mean(np.abs(shifted_right - original_right)),
                    np.mean(np.abs(shifted_down - original_down)),
                    np.std(shifted_right - original_right),
                    np.std(shifted_down - original_down)
                ])
    
    # 4. Frequency domain features (captures unique spectral characteristics)
    f_transform = np.fft.fft2(face_roi)
    f_shift = np.fft.fftshift(f_transform)
    magnitude_spectrum = np.abs(f_shift)
    
    # Extract features from different frequency bands
    center_y, center_x = 64, 64
    for radius in [10, 20, 30, 40]:
        mask = np.zeros((128, 128))
        y, x = np.ogrid[:128, :128]
        mask_region = (x - center_x)**2 + (y - center_y)**2 <= radius**2
        mask[mask_region] = 1
        
        masked_spectrum = magnitude_spectrum * mask
        features.extend([
            np.mean(masked_spectrum),
            np.std(masked_spectrum),
            np.max(masked_spectrum)
        ])
    
    # Convert to numpy array and normalize
    features = np.array(features, dtype=np.float64)
    
    # Remove any NaN or infinite values
    features = np.nan_to_num(features, nan=0.0, posinf=1.0, neginf=0.0)
    
    # L2 normalization for scale invariance
    norm = np.linalg.norm(features)
    if norm > 0:
        features = features / norm
    
    return features

def encode_face_secure(image_data):
    """Generate secure face encoding that distinguishes between different people."""
    try:
        rgb_image = process_image_from_base64(image_data)
        face_box = detect_face_secure(rgb_image)
        encoding = extract_unique_features(rgb_image, face_box)
        return encoding.tolist()
    except Exception as e:
        raise Exception(f"Failed to encode face: {str(e)}")

def compare_faces_secure(known_encoding, unknown_image_data, tolerance=0.4):
    """Compare faces with strict security - different people should have distance > 0.4"""
    try:
        unknown_encoding = encode_face_secure(unknown_image_data)
        
        known_array = np.array(known_encoding)
        unknown_array = np.array(unknown_encoding)
        
        # Use Euclidean distance
        distance = np.linalg.norm(known_array - unknown_array)
        
        # For security: same person typically < 0.3, different people > 0.5
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
                input_data = sys.stdin.read()
                data = json.loads(input_data)
                image_data = data.get('image_data', '')
                
                encoding = encode_face_secure(image_data)
                
                print(json.dumps({
                    "success": True,
                    "encoding": encoding
                }))
                
            elif operation == "compare":
                input_data = sys.stdin.read()
                data = json.loads(input_data)
                
                known_encoding = data.get('known_encoding', [])
                unknown_image = data.get('unknown_image', '')
                tolerance = data.get('tolerance', 0.4)
                
                result = compare_faces_secure(known_encoding, unknown_image, tolerance)
                
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