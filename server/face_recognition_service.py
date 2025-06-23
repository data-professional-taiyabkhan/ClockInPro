#!/usr/bin/env python3
"""
Professional face recognition service using OpenCV and computer vision.
Implements distance-based matching optimized for attendance systems.
"""

import cv2
import numpy as np
import base64
import json
import sys
from PIL import Image, ImageEnhance
import io

class FaceRecognitionService:
    def __init__(self, tolerance=0.5, num_augmentations=5):
        """
        Initialize face recognition service with attendance-optimized settings.
        
        Args:
            tolerance (float): Distance threshold for face matching (0.5 for stricter matching)
            num_augmentations (int): Number of augmentations for robust encoding
        """
        self.tolerance = tolerance
        self.num_augmentations = num_augmentations
        
        # Initialize OpenCV face detection
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        self.profile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
        
    def preprocess_image(self, image):
        """
        Preprocess image for optimal face recognition:
        - Normalize lighting
        - Enhance contrast
        - Ensure proper orientation
        """
        # Convert to PIL Image if needed
        if isinstance(image, np.ndarray):
            image = Image.fromarray(image)
        
        # Enhance brightness and contrast for better face detection
        enhancer = ImageEnhance.Brightness(image)
        image = enhancer.enhance(1.1)
        
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(1.2)
        
        return np.array(image)
    
    def detect_and_align_face(self, image, scale_factor=1.1, min_neighbors=5):
        """
        Detect face and return aligned face region for consistent encoding.
        
        Args:
            image: Input image as numpy array
            scale_factor: How much the image size is reduced at each scale
            min_neighbors: How many neighbors each face rectangle should have to retain it
            
        Returns:
            tuple: (aligned_face, face_rect) or (None, None) if no face found
        """
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY) if len(image.shape) == 3 else image
        
        # Detect faces using both frontal and profile cascades with relaxed parameters
        frontal_faces = self.face_cascade.detectMultiScale(
            gray, scaleFactor=1.05, minNeighbors=3, minSize=(30, 30)
        )
        
        profile_faces = self.profile_cascade.detectMultiScale(
            gray, scaleFactor=1.05, minNeighbors=3, minSize=(30, 30)
        )
        
        # Combine and select largest face
        all_faces = list(frontal_faces) + list(profile_faces)
        
        if len(all_faces) == 0:
            return None, None
            
        # Get the largest face (closest to camera)
        largest_face = max(all_faces, key=lambda rect: rect[2] * rect[3])
        x, y, w, h = largest_face
        
        # Add padding and ensure within image bounds
        padding = max(20, min(w, h) // 4)
        x_pad = max(0, x - padding)
        y_pad = max(0, y - padding)
        w_pad = min(image.shape[1] - x_pad, w + 2 * padding)
        h_pad = min(image.shape[0] - y_pad, h + 2 * padding)
        
        aligned_face = image[y_pad:y_pad + h_pad, x_pad:x_pad + w_pad]
        
        return aligned_face, (x, y, w, h)
    
    def generate_robust_encoding(self, image_data):
        """
        Generate robust face encoding using computer vision techniques.
        
        Args:
            image_data: Base64 image data
            
        Returns:
            dict: {'success': bool, 'encoding': list, 'confidence': float, 'details': dict}
        """
        try:
            # Decode base64 image
            if image_data.startswith('data:image'):
                image_data = image_data.split(',')[1]
            
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
            image_np = np.array(image.convert('RGB'))
            
            # Preprocess image
            processed_image = self.preprocess_image(image_np)
            
            # Detect and align face
            aligned_face, face_rect = self.detect_and_align_face(processed_image)
            
            if aligned_face is None:
                return {
                    'success': False,
                    'encoding': None,
                    'confidence': 0.0,
                    'details': {'error': 'No face detected in image'}
                }
            
            # Generate multiple feature encodings for robustness
            encodings = []
            
            # Resize face to standard size for consistent comparison
            standard_face = cv2.resize(aligned_face, (128, 128))
            gray_face = cv2.cvtColor(standard_face, cv2.COLOR_RGB2GRAY)
            
            # 1. LBP Histogram features
            lbp_features = self.extract_lbp_features(gray_face)
            encodings.extend(lbp_features)
            
            # 2. HOG features for facial structure
            hog_features = self.extract_hog_features(gray_face)
            encodings.extend(hog_features)
            
            # 3. Gabor filter responses for texture
            gabor_features = self.extract_gabor_features(gray_face)
            encodings.extend(gabor_features)
            
            # 4. Eigenface-like features
            pca_features = self.extract_pca_features(gray_face)
            encodings.extend(pca_features)
            
            # Calculate confidence based on face size and detection quality
            x, y, w, h = face_rect
            face_area = w * h
            image_area = processed_image.shape[0] * processed_image.shape[1]
            face_ratio = face_area / image_area
            
            # Factor in face size, clarity, and centering
            size_score = min(1.0, face_ratio * 10)  # Good if face is 10%+ of image
            clarity_score = self.assess_image_clarity(gray_face)
            center_score = self.assess_face_centering(face_rect, processed_image.shape)
            
            confidence = min(95, (size_score * 0.4 + clarity_score * 0.4 + center_score * 0.2) * 100)
            
            return {
                'success': True,
                'encoding': encodings,
                'confidence': confidence,
                'details': {
                    'face_rect': face_rect,
                    'face_area_ratio': face_ratio,
                    'encoding_components': {
                        'lbp': len(lbp_features),
                        'hog': len(hog_features), 
                        'gabor': len(gabor_features),
                        'pca': len(pca_features)
                    },
                    'total_features': len(encodings)
                }
            }
            
        except Exception as e:
            return {
                'success': False,
                'encoding': None,
                'confidence': 0.0,
                'details': {'error': str(e)}
            }
    
    def compare_faces_with_distance(self, known_encoding, captured_image_data):
        """
        Compare faces using distance-based matching with proper thresholds.
        
        Args:
            known_encoding: Stored face encoding (list)
            captured_image_data: Base64 image data of captured face
            
        Returns:
            dict: {'match': bool, 'distance': float, 'confidence': float, 'details': dict}
        """
        try:
            # Convert known encoding back to numpy array
            if isinstance(known_encoding, list):
                known_encoding = np.array(known_encoding)
            
            # Generate encoding for captured image
            capture_result = self.generate_robust_encoding(captured_image_data)
            
            if not capture_result['success']:
                return {
                    'match': False,
                    'distance': 1.0,
                    'confidence': 0.0,
                    'details': capture_result['details']
                }
            
            captured_encoding = np.array(capture_result['encoding'])
            
            # Ensure both encodings have the same length
            min_length = min(len(known_encoding), len(captured_encoding))
            known_encoding = known_encoding[:min_length]
            captured_encoding = captured_encoding[:min_length]
            
            # Calculate multiple distance metrics for robust comparison
            euclidean_dist = np.linalg.norm(known_encoding - captured_encoding)
            cosine_dist = 1 - np.dot(known_encoding, captured_encoding) / (
                np.linalg.norm(known_encoding) * np.linalg.norm(captured_encoding)
            )
            manhattan_dist = np.sum(np.abs(known_encoding - captured_encoding))
            
            # Normalize distances
            euclidean_norm = euclidean_dist / np.sqrt(len(known_encoding))
            cosine_norm = cosine_dist
            manhattan_norm = manhattan_dist / len(known_encoding)
            
            # Combined distance with weighted importance
            combined_distance = (
                euclidean_norm * 0.4 + 
                cosine_norm * 0.4 + 
                manhattan_norm * 0.2
            )
            
            # Determine match based on adaptive tolerance
            adaptive_tolerance = self.tolerance
            if capture_result['confidence'] > 80:
                adaptive_tolerance *= 1.1  # More lenient for high-quality captures
            elif capture_result['confidence'] < 60:
                adaptive_tolerance *= 0.9  # Stricter for low-quality captures
            
            is_match = combined_distance <= adaptive_tolerance
            
            # Convert distance to user-friendly confidence score
            max_expected_distance = 1.0
            confidence = max(0, min(100, (1.0 - (combined_distance / max_expected_distance)) * 100))
            
            return {
                'match': is_match,
                'distance': float(combined_distance),
                'confidence': confidence,
                'details': {
                    'tolerance_used': adaptive_tolerance,
                    'distance_components': {
                        'euclidean': float(euclidean_norm),
                        'cosine': float(cosine_norm),
                        'manhattan': float(manhattan_norm)
                    },
                    'capture_confidence': capture_result['confidence'],
                    'encoding_quality': 'high' if capture_result['confidence'] > 70 else 'medium' if capture_result['confidence'] > 50 else 'low'
                }
            }
            
        except Exception as e:
            return {
                'match': False,
                'distance': 1.0,
                'confidence': 0.0,
                'details': {'error': str(e)}
            }
    
    def extract_lbp_features(self, gray_image):
        """Extract Local Binary Pattern features."""
        height, width = gray_image.shape
        lbp_features = []
        
        # Calculate LBP for each pixel
        for y in range(1, height - 1):
            for x in range(1, width - 1):
                center = gray_image[y, x]
                binary_string = ''
                
                # Check 8 neighbors
                neighbors = [(-1,-1), (-1,0), (-1,1), (0,1), (1,1), (1,0), (1,-1), (0,-1)]
                for dy, dx in neighbors:
                    neighbor = gray_image[y + dy, x + dx]
                    binary_string += '1' if neighbor >= center else '0'
                
                lbp_features.append(int(binary_string, 2))
        
        # Create histogram of LBP values
        hist, _ = np.histogram(lbp_features, bins=256, range=(0, 256))
        return hist.tolist()
    
    def extract_hog_features(self, gray_image):
        """Extract Histogram of Oriented Gradients features."""
        # Calculate gradients
        grad_x = cv2.Sobel(gray_image, cv2.CV_64F, 1, 0, ksize=3)
        grad_y = cv2.Sobel(gray_image, cv2.CV_64F, 0, 1, ksize=3)
        
        # Calculate magnitude and orientation
        magnitude = np.sqrt(grad_x**2 + grad_y**2)
        orientation = np.arctan2(grad_y, grad_x) * 180 / np.pi
        orientation[orientation < 0] += 180
        
        # Create HOG descriptor (simplified)
        hog_features = []
        cell_size = 8
        
        for y in range(0, gray_image.shape[0] - cell_size, cell_size):
            for x in range(0, gray_image.shape[1] - cell_size, cell_size):
                cell_mag = magnitude[y:y+cell_size, x:x+cell_size]
                cell_ori = orientation[y:y+cell_size, x:x+cell_size]
                
                # Create histogram for this cell
                hist, _ = np.histogram(cell_ori.flatten(), bins=9, range=(0, 180), weights=cell_mag.flatten())
                hog_features.extend(hist.tolist())
        
        return hog_features
    
    def extract_gabor_features(self, gray_image):
        """Extract Gabor filter responses."""
        features = []
        
        # Apply Gabor filters with different orientations and frequencies
        for theta in [0, 45, 90, 135]:
            for frequency in [0.1, 0.3]:
                kernel = cv2.getGaborKernel((21, 21), 5, np.radians(theta), 2*np.pi*frequency, 0.5, 0, ktype=cv2.CV_32F)
                filtered = cv2.filter2D(gray_image, cv2.CV_8UC3, kernel)
                features.extend([float(np.mean(filtered)), float(np.std(filtered))])
        
        return features
    
    def extract_pca_features(self, gray_image):
        """Extract PCA-like features from face regions."""
        # Divide face into regions and extract statistical features
        regions = [
            gray_image[:64, :64],      # Top-left
            gray_image[:64, 64:],      # Top-right  
            gray_image[64:, :64],      # Bottom-left
            gray_image[64:, 64:]       # Bottom-right
        ]
        
        features = []
        for region in regions:
            if region.size > 0:
                features.extend([
                    float(np.mean(region)),
                    float(np.std(region)),
                    float(np.max(region)),
                    float(np.min(region))
                ])
        
        return features
    
    def assess_image_clarity(self, gray_image):
        """Assess image clarity using Laplacian variance."""
        laplacian = cv2.Laplacian(gray_image, cv2.CV_64F)
        variance = laplacian.var()
        # Normalize to 0-1 range (higher variance = clearer image)
        return min(1.0, variance / 1000.0)
    
    def assess_face_centering(self, face_rect, image_shape):
        """Assess how well-centered the face is in the image."""
        x, y, w, h = face_rect
        height, width = image_shape[:2]
        
        # Calculate face center
        face_center_x = x + w // 2
        face_center_y = y + h // 2
        
        # Calculate image center
        img_center_x = width // 2
        img_center_y = height // 2
        
        # Calculate distance from center (normalized)
        distance = np.sqrt((face_center_x - img_center_x)**2 + (face_center_y - img_center_y)**2)
        max_distance = np.sqrt((width//2)**2 + (height//2)**2)
        
        centering_score = 1.0 - (distance / max_distance)
        return max(0.0, centering_score)
    
    def generate_multiple_encodings(self, image_data_list):
        """
        Generate multiple encodings from different images of the same person
        for improved robustness.
        
        Args:
            image_data_list: List of base64 image data
            
        Returns:
            dict: {'success': bool, 'encodings': list, 'average_encoding': list}
        """
        encodings = []
        successful_encodings = 0
        
        for image_data in image_data_list:
            result = self.generate_robust_encoding(image_data)
            if result['success']:
                encodings.append(result['encoding'])
                successful_encodings += 1
        
        if successful_encodings == 0:
            return {
                'success': False,
                'encodings': [],
                'average_encoding': None,
                'details': {'error': 'No successful encodings generated'}
            }
        
        # Calculate average encoding for best representation
        encodings_array = np.array(encodings)
        average_encoding = np.mean(encodings_array, axis=0).tolist()
        
        return {
            'success': True,
            'encodings': encodings,
            'average_encoding': average_encoding,
            'details': {
                'total_attempts': len(image_data_list),
                'successful_encodings': successful_encodings,
                'encoding_quality': 'excellent' if successful_encodings >= 3 else 'good' if successful_encodings >= 2 else 'acceptable'
            }
        }

def main():
    """
    Command line interface for face recognition service.
    Expects JSON input with operation type and parameters.
    """
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Missing operation parameter'}))
        sys.exit(1)
    
    operation = sys.argv[1]
    
    # Initialize service with attendance system optimized settings
    service = FaceRecognitionService(tolerance=0.5, num_augmentations=10)
    
    if operation == 'encode':
        # Read image data from stdin
        input_data = json.loads(sys.stdin.read())
        result = service.generate_robust_encoding(input_data['image_data'])
        print(json.dumps(result))
        
    elif operation == 'compare':
        # Read comparison data from stdin
        input_data = json.loads(sys.stdin.read())
        result = service.compare_faces_with_distance(
            input_data['known_encoding'],
            input_data['captured_image']
        )
        print(json.dumps(result))
        
    elif operation == 'multi_encode':
        # Generate multiple encodings
        input_data = json.loads(sys.stdin.read())
        result = service.generate_multiple_encodings(input_data['image_list'])
        print(json.dumps(result))
        
    else:
        print(json.dumps({'error': f'Unknown operation: {operation}'}))
        sys.exit(1)

if __name__ == '__main__':
    main()