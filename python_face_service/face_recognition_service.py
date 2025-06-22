#!/usr/bin/env python3
import sys
import json
import base64
import cv2
import numpy as np
import face_recognition
from io import BytesIO
from PIL import Image
import os

class FaceRecognitionService:
    def __init__(self):
        self.tolerance = 0.4  # Lower is more strict (0.4 is good balance)
        
    def base64_to_image(self, base64_string):
        """Convert base64 string to OpenCV image"""
        # Remove data URL prefix if present
        if base64_string.startswith('data:image'):
            base64_string = base64_string.split(',')[1]
        
        # Decode base64
        image_data = base64.b64decode(base64_string)
        
        # Convert to PIL Image
        pil_image = Image.open(BytesIO(image_data))
        
        # Convert to RGB (face_recognition needs RGB)
        rgb_image = pil_image.convert('RGB')
        
        # Convert to numpy array
        return np.array(rgb_image)
    
    def detect_faces(self, image_data):
        """Detect faces in image and return quality metrics"""
        try:
            image = self.base64_to_image(image_data)
            
            # Find face locations
            face_locations = face_recognition.face_locations(image, model="hog")
            
            if len(face_locations) == 0:
                return {
                    "isValid": False,
                    "message": "No face detected in the image",
                    "faceCount": 0,
                    "qualityScore": 0,
                    "details": {
                        "brightness": 0,
                        "sharpness": 0,
                        "faceSize": 0
                    }
                }
            
            if len(face_locations) > 1:
                return {
                    "isValid": False,
                    "message": "Multiple faces detected. Please ensure only one face is visible",
                    "faceCount": len(face_locations),
                    "qualityScore": 0,
                    "details": {
                        "brightness": 0,
                        "sharpness": 0,
                        "faceSize": 0
                    }
                }
            
            # Analyze image quality
            face_location = face_locations[0]
            top, right, bottom, left = face_location
            
            # Calculate face size (larger is better)
            face_width = right - left
            face_height = bottom - top
            face_area = face_width * face_height
            image_area = image.shape[0] * image.shape[1]
            face_size_ratio = face_area / image_area
            
            # Convert to grayscale for quality analysis
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            face_region = gray[top:bottom, left:right]
            
            # Calculate brightness (0-255, optimal range 80-180)
            brightness = np.mean(face_region)
            brightness_score = min(100, max(0, 100 - abs(brightness - 128) * 0.78))
            
            # Calculate sharpness using Laplacian variance
            laplacian_var = cv2.Laplacian(face_region, cv2.CV_64F).var()
            sharpness_score = min(100, laplacian_var / 10)  # Normalize to 0-100
            
            # Face size score (face should be at least 5% of image)
            face_size_score = min(100, face_size_ratio * 2000)
            
            # Overall quality score
            quality_score = (brightness_score * 0.3 + sharpness_score * 0.4 + face_size_score * 0.3)
            
            # Validation thresholds
            is_valid = (
                brightness_score > 40 and
                sharpness_score > 30 and
                face_size_score > 20 and
                quality_score > 50
            )
            
            message = "High-quality face image suitable for registration" if is_valid else \
                     f"Image quality issues detected (Brightness: {brightness_score:.1f}, Sharpness: {sharpness_score:.1f}, Size: {face_size_score:.1f})"
            
            return {
                "isValid": is_valid,
                "message": message,
                "faceCount": 1,
                "qualityScore": quality_score,
                "details": {
                    "brightness": brightness_score,
                    "sharpness": sharpness_score,
                    "faceSize": face_size_score
                }
            }
            
        except Exception as e:
            return {
                "isValid": False,
                "message": f"Face detection error: {str(e)}",
                "faceCount": 0,
                "qualityScore": 0,
                "details": {
                    "brightness": 0,
                    "sharpness": 0,
                    "faceSize": 0
                }
            }
    
    def compare_faces(self, known_image_data, unknown_image_data):
        """Compare two face images and return similarity metrics"""
        try:
            # Convert images
            known_image = self.base64_to_image(known_image_data)
            unknown_image = self.base64_to_image(unknown_image_data)
            
            # Get face encodings
            known_encodings = face_recognition.face_encodings(known_image)
            unknown_encodings = face_recognition.face_encodings(unknown_image)
            
            if len(known_encodings) == 0:
                return {
                    "isMatch": False,
                    "similarity": 0,
                    "confidence": 0,
                    "message": "No face found in registered image"
                }
            
            if len(unknown_encodings) == 0:
                return {
                    "isMatch": False,
                    "similarity": 0,
                    "confidence": 0,
                    "message": "No face found in captured image"
                }
            
            # Use first face encoding from each image
            known_encoding = known_encodings[0]
            unknown_encoding = unknown_encodings[0]
            
            # Calculate face distance (lower is better)
            face_distance = face_recognition.face_distance([known_encoding], unknown_encoding)[0]
            
            # Convert distance to similarity percentage (0-100)
            similarity = max(0, (1 - face_distance) * 100)
            
            # Check if faces match
            matches = face_recognition.compare_faces([known_encoding], unknown_encoding, tolerance=self.tolerance)
            is_match = matches[0]
            
            # Calculate confidence based on how far from tolerance threshold
            if face_distance <= self.tolerance:
                confidence = min(100, (1 - face_distance / self.tolerance) * 100)
            else:
                confidence = max(0, (1 - (face_distance - self.tolerance) / (1 - self.tolerance)) * 100)
            
            return {
                "isMatch": is_match,
                "similarity": similarity,
                "confidence": confidence,
                "distance": face_distance,
                "message": f"Face comparison completed. Distance: {face_distance:.3f}"
            }
            
        except Exception as e:
            return {
                "isMatch": False,
                "similarity": 0,
                "confidence": 0,
                "distance": 1.0,
                "message": f"Face comparison error: {str(e)}"
            }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing operation parameter"}))
        sys.exit(1)
    
    operation = sys.argv[1]
    service = FaceRecognitionService()
    
    try:
        if operation == "detect":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "Missing image data"}))
                sys.exit(1)
            
            image_data = sys.argv[2]
            result = service.detect_faces(image_data)
            print(json.dumps(result))
            
        elif operation == "compare":
            if len(sys.argv) < 4:
                print(json.dumps({"error": "Missing image data for comparison"}))
                sys.exit(1)
            
            known_image = sys.argv[2]
            unknown_image = sys.argv[3]
            result = service.compare_faces(known_image, unknown_image)
            print(json.dumps(result))
            
        else:
            print(json.dumps({"error": f"Unknown operation: {operation}"}))
            sys.exit(1)
            
    except Exception as e:
        print(json.dumps({"error": f"Service error: {str(e)}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()