import * as faceapi from 'face-api.js';

export class FaceRecognitionService {
  private modelsLoaded = false;

  async loadModels() {
    if (this.modelsLoaded) return;
    
    try {
      // Load face-api.js models from CDN
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model';
      
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
      ]);
      
      this.modelsLoaded = true;
      console.log('Face recognition models loaded successfully');
    } catch (error) {
      console.error('Failed to load face recognition models:', error);
      throw new Error('Failed to load face recognition models');
    }
  }

  async detectFaceWithDescriptor(imageElement: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement): Promise<{
    success: boolean;
    descriptor?: number[];
    confidence?: number;
    boundingBox?: { x: number; y: number; width: number; height: number };
    error?: string;
  }> {
    try {
      if (!this.modelsLoaded) {
        await this.loadModels();
      }

      // Detect faces with landmarks and descriptors
      const detections = await faceapi
        .detectAllFaces(imageElement, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        return {
          success: false,
          error: 'No face detected in image'
        };
      }

      // Get the detection with highest confidence
      const bestDetection = detections.reduce((prev, current) => 
        current.detection.score > prev.detection.score ? current : prev
      );

      const descriptor = Array.from(bestDetection.descriptor);
      const box = bestDetection.detection.box;

      return {
        success: true,
        descriptor,
        confidence: bestDetection.detection.score * 100,
        boundingBox: {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height
        }
      };
    } catch (error) {
      console.error('Face detection error:', error);
      return {
        success: false,
        error: `Face detection failed: ${error.message}`
      };
    }
  }

  async generateDescriptorFromImageData(imageData: string): Promise<{
    success: boolean;
    descriptor?: number[];
    confidence?: number;
    error?: string;
  }> {
    try {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = async () => {
          try {
            const result = await this.detectFaceWithDescriptor(img);
            resolve({
              success: result.success,
              descriptor: result.descriptor,
              confidence: result.confidence,
              error: result.error
            });
          } catch (error) {
            resolve({
              success: false,
              error: error.message
            });
          }
        };
        img.onerror = () => {
          resolve({
            success: false,
            error: 'Failed to load image'
          });
        };
        img.src = imageData;
      });
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Live face detection for UX feedback
  async detectLiveFace(video: HTMLVideoElement): Promise<{
    detected: boolean;
    confidence?: number;
    isWellCentered?: boolean;
    isWellLit?: boolean;
    boundingBox?: { x: number; y: number; width: number; height: number };
    feedback?: string;
  }> {
    try {
      if (!this.modelsLoaded) {
        await this.loadModels();
      }

      const detection = await faceapi
        .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
        .withFaceLandmarks();

      if (!detection) {
        return {
          detected: false,
          feedback: 'No face detected - please position your face in the camera'
        };
      }

      const box = detection.detection.box;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      // Check centering (face should be in center 60% of frame)
      const centerX = videoWidth / 2;
      const centerY = videoHeight / 2;
      const faceX = box.x + box.width / 2;
      const faceY = box.y + box.height / 2;
      
      const centerThreshold = Math.min(videoWidth, videoHeight) * 0.3;
      const isWellCentered = Math.sqrt((faceX - centerX) ** 2 + (faceY - centerY) ** 2) < centerThreshold;

      // Check face size (should be at least 20% of frame height)
      const minFaceSize = videoHeight * 0.2;
      const isGoodSize = box.height > minFaceSize;

      // Generate feedback
      let feedback = '';
      if (!isWellCentered) {
        feedback = 'Please center your face in the frame';
      } else if (!isGoodSize) {
        feedback = 'Please move closer to the camera';
      } else {
        feedback = 'Good positioning - click capture when ready';
      }

      return {
        detected: true,
        confidence: detection.detection.score * 100,
        isWellCentered: isWellCentered && isGoodSize,
        boundingBox: {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height
        },
        feedback
      };
    } catch (error) {
      return {
        detected: false,
        feedback: 'Face detection temporarily unavailable'
      };
    }
  }
  // Calculate Euclidean distance between two face descriptors
  static calculateEuclideanDistance(descriptor1: number[], descriptor2: number[]): number {
    if (descriptor1.length !== descriptor2.length) {
      throw new Error('Descriptors must have the same length');
    }
    
    let sum = 0;
    for (let i = 0; i < descriptor1.length; i++) {
      const diff = descriptor1[i] - descriptor2[i];
      sum += diff * diff;
    }
    
    return Math.sqrt(sum);
  }

  // Compare two face descriptors with a standard threshold
  static compareFaceDescriptors(storedDescriptor: number[], capturedDescriptor: number[], threshold: number = 0.6): {
    isMatch: boolean;
    distance: number;
    confidence: number;
  } {
    const distance = this.calculateEuclideanDistance(storedDescriptor, capturedDescriptor);
    const isMatch = distance <= threshold;
    
    // Convert distance to confidence percentage (lower distance = higher confidence)
    const confidence = Math.max(0, Math.min(100, (1 - distance) * 100));
    
    return {
      isMatch,
      distance,
      confidence
    };
  }
}

export const faceRecognition = new FaceRecognitionService();