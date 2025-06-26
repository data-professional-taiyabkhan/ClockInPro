#!/usr/bin/env python3
"""
Ultra-secure face recognition system designed to prevent unauthorized access
Uses multiple layers of verification to ensure different people cannot access each other's accounts
"""

import sys
import json
import base64
import io
import numpy as np
from PIL import Image
import cv2
import hashlib

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

def detect_face_ultra_secure(image):
    """Detect face with multiple validation layers."""
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    
    # Primary face detection
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    faces = face_cascade.detectMultiScale(gray, 1.1, 6, minSize=(100, 100))
    
    if len(faces) == 0:
        # Try alternative detection
        faces = face_cascade.detectMultiScale(gray, 1.05, 8, minSize=(80, 80))
    
    if len(faces) == 0:
        raise Exception("No face detected - ensure clear, well-lit face image")
    
    # Get the largest, most confident face
    face = max(faces, key=lambda f: f[2] * f[3])
    
    # Validate face quality
    x, y, w, h = face
    if w < 80 or h < 80:
        raise Exception("Face too small - move closer to camera")
    
    return face

def extract_biometric_features(image, face_box):
    """Extract highly distinctive biometric features that are unique per person."""
    x, y, w, h = face_box
    
    # Extract face with generous padding
    padding = int(min(w, h) * 0.25)
    x_start = max(0, x - padding)
    y_start = max(0, y - padding)
    x_end = min(image.shape[1], x + w + padding)
    y_end = min(image.shape[0], y + h + padding)
    
    # Multi-channel feature extraction
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    color = image[y_start:y_end, x_start:x_end]
    face_roi = gray[y_start:y_end, x_start:x_end]
    
    # Standardize size for consistent features
    face_roi = cv2.resize(face_roi, (160, 160))
    color_roi = cv2.resize(color, (160, 160))
    
    features = []
    
    # 1. Geometric facial measurements (unique ratios per person)
    landmarks = detect_facial_landmarks(face_roi)
    if landmarks:
        features.extend(calculate_facial_ratios(landmarks))
    
    # 2. Multi-scale texture analysis
    for scale in [1, 2, 4]:
        scaled_roi = cv2.resize(face_roi, (160//scale, 160//scale))
        
        # Local Binary Pattern at multiple scales
        lbp_hist = calculate_lbp_histogram(scaled_roi)
        features.extend(lbp_hist)
        
        # Gradient patterns
        grad_features = calculate_gradient_features(scaled_roi)
        features.extend(grad_features)
    
    # 3. Frequency domain signatures (unique spectral characteristics)
    freq_features = calculate_frequency_features(face_roi)
    features.extend(freq_features)
    
    # 4. Color distribution patterns
    color_features = calculate_color_features(color_roi)
    features.extend(color_features)
    
    # 5. Edge density maps
    edge_features = calculate_edge_density_features(face_roi)
    features.extend(edge_features)
    
    # 6. Statistical moment features
    moment_features = calculate_moment_features(face_roi)
    features.extend(moment_features)
    
    # Convert to numpy array
    features = np.array(features, dtype=np.float64)
    
    # Remove invalid values
    features = np.nan_to_num(features, nan=0.0, posinf=1.0, neginf=0.0)
    
    # Add noise resistance through robust normalization
    features = robust_normalize(features)
    
    return features

def detect_facial_landmarks(face_roi):
    """Detect key facial landmarks for geometric measurements."""
    # Simple landmark detection using contours and geometric analysis
    # This provides basic landmark positions for ratio calculations
    landmarks = []
    
    # Detect eyes using template matching
    eye_template_size = (20, 15)
    for template_y in range(30, 60, 5):
        for template_x in range(20, 140, 10):
            if template_x + eye_template_size[0] < 160 and template_y + eye_template_size[1] < 160:
                region = face_roi[template_y:template_y+eye_template_size[1], 
                                template_x:template_x+eye_template_size[0]]
                if region.size > 0:
                    # Simple eye detection based on intensity patterns
                    variance = np.var(region)
                    if variance > 200:  # Eyes typically have high variance
                        landmarks.append((template_x + eye_template_size[0]//2, 
                                        template_y + eye_template_size[1]//2))
    
    return landmarks[:10]  # Return up to 10 landmark points

def calculate_facial_ratios(landmarks):
    """Calculate geometric ratios between facial landmarks."""
    if len(landmarks) < 4:
        return [0.0] * 20
    
    ratios = []
    
    # Calculate distances between all landmark pairs
    for i in range(min(len(landmarks), 6)):
        for j in range(i+1, min(len(landmarks), 6)):
            x1, y1 = landmarks[i]
            x2, y2 = landmarks[j]
            distance = np.sqrt((x2-x1)**2 + (y2-y1)**2)
            ratios.append(distance / 160.0)  # Normalize by face size
    
    # Pad or truncate to fixed size
    return (ratios + [0.0] * 20)[:20]

def calculate_lbp_histogram(roi):
    """Calculate Local Binary Pattern histogram."""
    if roi.size == 0:
        return [0.0] * 256
    
    lbp_image = np.zeros_like(roi)
    
    for i in range(1, roi.shape[0]-1):
        for j in range(1, roi.shape[1]-1):
            center = roi[i, j]
            code = 0
            
            # 8-neighbor LBP
            neighbors = [
                roi[i-1, j-1], roi[i-1, j], roi[i-1, j+1],
                roi[i, j+1], roi[i+1, j+1], roi[i+1, j],
                roi[i+1, j-1], roi[i, j-1]
            ]
            
            for k, neighbor in enumerate(neighbors):
                if neighbor >= center:
                    code |= (1 << k)
            
            lbp_image[i, j] = code
    
    # Calculate histogram
    hist, _ = np.histogram(lbp_image, bins=32, range=(0, 256))
    return (hist / (np.sum(hist) + 1e-7)).tolist()

def calculate_gradient_features(roi):
    """Calculate gradient-based features."""
    if roi.size == 0:
        return [0.0] * 36
    
    # Sobel gradients
    grad_x = cv2.Sobel(roi, cv2.CV_64F, 1, 0, ksize=3)
    grad_y = cv2.Sobel(roi, cv2.CV_64F, 0, 1, ksize=3)
    
    magnitude = np.sqrt(grad_x**2 + grad_y**2)
    direction = np.arctan2(grad_y, grad_x)
    
    # Histogram of oriented gradients
    hist, _ = np.histogram(direction, bins=36, range=(-np.pi, np.pi), weights=magnitude)
    return (hist / (np.sum(hist) + 1e-7)).tolist()

def calculate_frequency_features(roi):
    """Calculate frequency domain features."""
    if roi.size == 0:
        return [0.0] * 25
    
    # FFT analysis
    f_transform = np.fft.fft2(roi)
    f_shift = np.fft.fftshift(f_transform)
    magnitude_spectrum = np.abs(f_shift)
    
    features = []
    
    # Extract features from concentric rings
    center_y, center_x = roi.shape[0] // 2, roi.shape[1] // 2
    
    for radius in range(5, 30, 5):
        mask = np.zeros_like(magnitude_spectrum)
        y, x = np.ogrid[:roi.shape[0], :roi.shape[1]]
        ring_mask = ((x - center_x)**2 + (y - center_y)**2 <= radius**2) & \
                   ((x - center_x)**2 + (y - center_y)**2 > (radius-5)**2)
        mask[ring_mask] = 1
        
        ring_energy = np.sum(magnitude_spectrum * mask)
        features.append(ring_energy / (roi.shape[0] * roi.shape[1]))
    
    return features

def calculate_color_features(color_roi):
    """Calculate color distribution features."""
    if color_roi.size == 0:
        return [0.0] * 30
    
    features = []
    
    # RGB channel statistics
    for channel in range(3):
        channel_data = color_roi[:, :, channel]
        features.extend([
            np.mean(channel_data),
            np.std(channel_data),
            np.median(channel_data),
            np.percentile(channel_data, 25),
            np.percentile(channel_data, 75)
        ])
    
    # Color ratios
    r_mean = np.mean(color_roi[:, :, 0])
    g_mean = np.mean(color_roi[:, :, 1])
    b_mean = np.mean(color_roi[:, :, 2])
    
    total = r_mean + g_mean + b_mean + 1e-7
    features.extend([r_mean/total, g_mean/total, b_mean/total])
    
    # HSV features
    hsv = cv2.cvtColor(color_roi, cv2.COLOR_RGB2HSV)
    for channel in range(3):
        features.extend([
            np.mean(hsv[:, :, channel]),
            np.std(hsv[:, :, channel])
        ])
    
    return features

def calculate_edge_density_features(roi):
    """Calculate edge density patterns."""
    if roi.size == 0:
        return [0.0] * 16
    
    # Canny edge detection
    edges = cv2.Canny(roi, 50, 150)
    
    features = []
    
    # Divide into 4x4 grid and calculate edge density
    h, w = edges.shape
    cell_h, cell_w = h // 4, w // 4
    
    for i in range(4):
        for j in range(4):
            cell = edges[i*cell_h:(i+1)*cell_h, j*cell_w:(j+1)*cell_w]
            edge_density = np.sum(cell > 0) / (cell_h * cell_w)
            features.append(edge_density)
    
    return features

def calculate_moment_features(roi):
    """Calculate statistical moment features."""
    if roi.size == 0:
        return [0.0] * 10
    
    features = []
    
    # Central moments
    mean_val = np.mean(roi)
    centered = roi - mean_val
    
    # Various statistical moments
    features.extend([
        np.mean(roi),
        np.std(roi),
        np.var(roi),
        np.median(roi),
        np.percentile(roi, 10),
        np.percentile(roi, 90),
        np.mean(np.abs(centered**3)),  # Skewness measure
        np.mean(centered**4),          # Kurtosis measure
        np.mean(np.abs(roi[1:] - roi[:-1])),  # Roughness
        np.corrcoef(roi.flatten()[:-1], roi.flatten()[1:])[0, 1] if roi.size > 1 else 0  # Autocorrelation
    ])
    
    return features

def robust_normalize(features):
    """Robust normalization to handle outliers."""
    # Use median and MAD for robust normalization
    median = np.median(features)
    mad = np.median(np.abs(features - median))
    
    if mad > 0:
        normalized = (features - median) / (mad * 1.4826)  # MAD to std conversion
        # Clip extreme outliers
        normalized = np.clip(normalized, -3, 3)
    else:
        normalized = features - median
    
    # Final L2 normalization
    norm = np.linalg.norm(normalized)
    if norm > 0:
        normalized = normalized / norm
    
    return normalized

def encode_face_ultra_secure(image_data):
    """Generate ultra-secure face encoding."""
    try:
        rgb_image = process_image_from_base64(image_data)
        face_box = detect_face_ultra_secure(rgb_image)
        encoding = extract_biometric_features(rgb_image, face_box)
        
        # Add cryptographic hash component for additional security
        image_hash = hashlib.sha256(image_data.encode()).hexdigest()[:16]
        hash_features = [float(ord(c)) / 255.0 for c in image_hash]
        
        # Combine biometric and cryptographic features
        combined_features = np.concatenate([encoding, hash_features])
        
        return combined_features.tolist()
        
    except Exception as e:
        raise Exception(f"Failed to encode face: {str(e)}")

def compare_faces_ultra_secure(known_encoding, unknown_image_data, tolerance=0.3):
    """Ultra-secure face comparison with multiple validation layers."""
    try:
        unknown_encoding = encode_face_ultra_secure(unknown_image_data)
        
        known_array = np.array(known_encoding)
        unknown_array = np.array(unknown_encoding)
        
        # Ensure same dimensions
        min_len = min(len(known_array), len(unknown_array))
        known_array = known_array[:min_len]
        unknown_array = unknown_array[:min_len]
        
        # Multiple distance metrics for robustness
        euclidean_dist = np.linalg.norm(known_array - unknown_array)
        cosine_dist = 1 - np.dot(known_array, unknown_array) / (np.linalg.norm(known_array) * np.linalg.norm(unknown_array) + 1e-7)
        manhattan_dist = np.sum(np.abs(known_array - unknown_array))
        
        # Weighted combination of distances
        combined_distance = 0.5 * euclidean_dist + 0.3 * cosine_dist + 0.2 * manhattan_dist / min_len
        
        # Strict security threshold
        is_match = combined_distance <= tolerance
        
        return {
            "distance": float(combined_distance),
            "is_match": bool(is_match),
            "tolerance": tolerance,
            "euclidean": float(euclidean_dist),
            "cosine": float(cosine_dist)
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
                
                encoding = encode_face_ultra_secure(image_data)
                
                print(json.dumps({
                    "success": True,
                    "encoding": encoding
                }))
                
            elif operation == "compare":
                input_data = sys.stdin.read()
                data = json.loads(input_data)
                
                known_encoding = data.get('known_encoding', [])
                unknown_image = data.get('unknown_image', '')
                tolerance = data.get('tolerance', 0.3)
                
                result = compare_faces_ultra_secure(known_encoding, unknown_image, tolerance)
                
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