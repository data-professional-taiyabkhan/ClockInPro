#!/usr/bin/env python3
"""
Professional face recognition service with distance-based matching.
Implements proper face_recognition library techniques for attendance systems.
"""

import face_recognition
import cv2
import numpy as np
import base64
import json
import sys
from PIL import Image, ImageEnhance
import io

class FaceRecognitionService:
    def __init__(self, tolerance=0.5, num_jitters=10):
        """
        Initialize face recognition service with attendance-optimized settings.
        
        Args:
            tolerance (float): Distance threshold for face matching (0.5 for stricter matching)
            num_jitters (int): Number of augmentations for robust encoding (5-10 recommended)
        """
        self.tolerance = tolerance
        self.num_jitters = num_jitters
        
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
    
    def detect_and_align_face(self, image, upsample_times=1):
        """
        Detect face and return aligned face region for consistent encoding.
        
        Args:
            image: Input image as numpy array
            upsample_times: Number of times to upsample image for better detection
            
        Returns:
            tuple: (aligned_face, face_locations) or (None, []) if no face found
        """
        # Detect face locations with upsampling for better detection
        face_locations = face_recognition.face_locations(
            image, 
            number_of_times_to_upsample=upsample_times,
            model="hog"  # Use HOG for faster detection, can switch to "cnn" for better accuracy
        )
        
        if not face_locations:
            return None, []
            
        # Get the largest face (closest to camera)
        largest_face = max(face_locations, key=lambda loc: (loc[2] - loc[0]) * (loc[1] - loc[3]))
        
        # Extract face region with some padding
        top, right, bottom, left = largest_face
        padding = 20
        
        height, width = image.shape[:2]
        top = max(0, top - padding)
        right = min(width, right + padding)
        bottom = min(height, bottom + padding)
        left = max(0, left - padding)
        
        aligned_face = image[top:bottom, left:right]
        
        return aligned_face, [largest_face]
    
    def generate_robust_encoding(self, image_data):
        """
        Generate robust face encoding with multiple jitters for better reliability.
        
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
            aligned_face, face_locations = self.detect_and_align_face(processed_image, upsample_times=1)
            
            if aligned_face is None:
                return {
                    'success': False,
                    'encoding': None,
                    'confidence': 0.0,
                    'details': {'error': 'No face detected in image'}
                }
            
            # Generate encoding with jitter for robustness
            face_encodings = face_recognition.face_encodings(
                processed_image,
                known_face_locations=face_locations,
                num_jitters=self.num_jitters,
                model="large"  # Use large model for better accuracy
            )
            
            if not face_encodings:
                return {
                    'success': False,
                    'encoding': None,
                    'confidence': 0.0,
                    'details': {'error': 'Could not generate face encoding'}
                }
            
            # Convert numpy array to list for JSON serialization
            encoding = face_encodings[0].tolist()
            
            # Calculate confidence based on face size and quality
            face_area = (face_locations[0][2] - face_locations[0][0]) * (face_locations[0][1] - face_locations[0][3])
            image_area = processed_image.shape[0] * processed_image.shape[1]
            face_ratio = face_area / image_area
            
            # Higher confidence for larger, clearer faces
            confidence = min(95, 60 + (face_ratio * 100))
            
            return {
                'success': True,
                'encoding': encoding,
                'confidence': confidence,
                'details': {
                    'face_locations': face_locations,
                    'face_area_ratio': face_ratio,
                    'jitters_used': self.num_jitters,
                    'encoding_length': len(encoding)
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
            
            # Calculate face distance (lower = more similar)
            distances = face_recognition.face_distance([known_encoding], captured_encoding)
            distance = distances[0]
            
            # Determine match based on tolerance threshold
            is_match = distance <= self.tolerance
            
            # Convert distance to user-friendly confidence score
            # Distance of 0.0 = 100% confidence, tolerance = 50% confidence
            confidence = max(0, min(100, (1.0 - (distance / (self.tolerance * 2))) * 100))
            
            return {
                'match': is_match,
                'distance': float(distance),
                'confidence': confidence,
                'details': {
                    'tolerance_used': self.tolerance,
                    'distance_threshold': self.tolerance,
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
    service = FaceRecognitionService(tolerance=0.5, num_jitters=10)
    
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