import { FaceClient } from '@azure/cognitiveservices-face';
import { ApiKeyCredentials } from '@azure/ms-rest-js';

export class AzureFaceService {
  private client: FaceClient;
  private isAvailable: boolean = false;

  constructor() {
    // Try environment variables first, then fallback to hardcoded values for testing
    const apiKey = process.env.AZURE_FACE_API_KEY || '518Npv7g8HgdyzJWxvPKTEdMQ76IbAyPA0dM0SmV5Ho73dmMCMpiJQQJ99BFACYeBjFXJ3w3AAAKACOGVRM7';
    const endpoint = process.env.AZURE_FACE_ENDPOINT || 'https://clockinpro.cognitiveservices.azure.com/';

    if (!apiKey || !endpoint) {
      console.log('Azure Face API credentials not provided. Service will be unavailable.');
      return;
    }

    console.log(`Initializing Azure Face API with endpoint: ${endpoint}`);

    try {
      const credentials = new ApiKeyCredentials({
        inHeader: { 'Ocp-Apim-Subscription-Key': apiKey }
      });
      
      this.client = new FaceClient(credentials, endpoint);
      this.isAvailable = true;
      console.log('Azure Face API initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Azure Face API:', error);
      this.isAvailable = false;
    }
  }

  /**
   * Check if Azure Face service is available
   */
  public getAvailability(): boolean {
    return this.isAvailable;
  }

  /**
   * Convert base64 image data to buffer
   */
  private imageDataToBuffer(imageData: string): Buffer {
    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    return Buffer.from(base64Data, 'base64');
  }

  /**
   * Detect faces in an image and validate quality
   */
  async detectFaces(imageData: string): Promise<{
    isValid: boolean;
    message: string;
    faceCount: number;
    confidence: number;
    details: any;
  }> {
    if (!this.isAvailable) {
      throw new Error('Azure Face API is not available');
    }

    try {
      const imageBuffer = this.imageDataToBuffer(imageData);
      
      // Detect faces with quality attributes
      const detectedFaces = await this.client.face.detectWithStream(
        imageBuffer,
        {
          returnFaceAttributes: [
            'blur', 'exposure', 'noise', 'qualityForRecognition',
            'headPose', 'glasses', 'facialHair', 'emotion'
          ],
          recognitionModel: 'recognition_04',
          detectionModel: 'detection_03'
        }
      );

      if (detectedFaces.length === 0) {
        return {
          isValid: false,
          message: 'No face detected in the image',
          faceCount: 0,
          confidence: 0,
          details: { reason: 'No faces found' }
        };
      }

      if (detectedFaces.length > 1) {
        return {
          isValid: false,
          message: 'Multiple faces detected. Please ensure only one face is visible',
          faceCount: detectedFaces.length,
          confidence: 0,
          details: { reason: 'Multiple faces detected', count: detectedFaces.length }
        };
      }

      const face = detectedFaces[0];
      const attributes = face.faceAttributes;
      
      if (!attributes) {
        return {
          isValid: false,
          message: 'Unable to analyze face attributes',
          faceCount: 1,
          confidence: 0,
          details: { reason: 'Missing face attributes' }
        };
      }

      // Quality validation
      const qualityIssues = [];
      let qualityScore = 100;

      // Check blur level
      if (attributes.blur && attributes.blur.value > 0.5) {
        qualityIssues.push('Image is too blurry');
        qualityScore -= 30;
      }

      // Check exposure
      if (attributes.exposure) {
        if (attributes.exposure.value < -1.0) {
          qualityIssues.push('Image is underexposed');
          qualityScore -= 20;
        } else if (attributes.exposure.value > 1.0) {
          qualityIssues.push('Image is overexposed');
          qualityScore -= 20;
        }
      }

      // Check noise level
      if (attributes.noise && attributes.noise.value > 0.7) {
        qualityIssues.push('Image has too much noise');
        qualityScore -= 15;
      }

      // Check head pose
      if (attributes.headPose) {
        const { pitch, roll, yaw } = attributes.headPose;
        if (Math.abs(pitch) > 20 || Math.abs(roll) > 20 || Math.abs(yaw) > 20) {
          qualityIssues.push('Head pose is too extreme');
          qualityScore -= 25;
        }
      }

      // Check overall quality for recognition
      if (attributes.qualityForRecognition && 
          attributes.qualityForRecognition !== 'high' && 
          attributes.qualityForRecognition !== 'medium') {
        qualityIssues.push('Overall image quality is too low for recognition');
        qualityScore -= 40;
      }

      const isValid = qualityScore >= 60 && qualityIssues.length === 0;
      const message = isValid 
        ? 'High-quality face image suitable for recognition'
        : `Image quality issues: ${qualityIssues.join(', ')}`;

      return {
        isValid,
        message,
        faceCount: 1,
        confidence: Math.max(0, qualityScore),
        details: {
          qualityScore,
          qualityForRecognition: attributes.qualityForRecognition,
          blur: attributes.blur?.value,
          exposure: attributes.exposure?.value,
          noise: attributes.noise?.value,
          headPose: attributes.headPose,
          issues: qualityIssues
        }
      };

    } catch (error) {
      console.error('Azure Face detection error:', error);
      throw new Error(`Face detection failed: ${error.message}`);
    }
  }

  /**
   * Compare two face images using Azure Face API
   */
  async compareFaces(knownImageData: string, unknownImageData: string): Promise<{
    isMatch: boolean;
    confidence: number;
    similarity: number;
    details: any;
  }> {
    if (!this.isAvailable) {
      throw new Error('Azure Face API is not available');
    }

    try {
      const knownBuffer = this.imageDataToBuffer(knownImageData);
      const unknownBuffer = this.imageDataToBuffer(unknownImageData);

      // Detect faces in both images
      const [knownFaces, unknownFaces] = await Promise.all([
        this.client.face.detectWithStream(knownBuffer, {
          recognitionModel: 'recognition_04',
          detectionModel: 'detection_03'
        }),
        this.client.face.detectWithStream(unknownBuffer, {
          recognitionModel: 'recognition_04',
          detectionModel: 'detection_03'
        })
      ]);

      if (knownFaces.length === 0) {
        return {
          isMatch: false,
          confidence: 0,
          similarity: 0,
          details: { error: 'No face found in registered image' }
        };
      }

      if (unknownFaces.length === 0) {
        return {
          isMatch: false,
          confidence: 0,
          similarity: 0,
          details: { error: 'No face found in captured image' }
        };
      }

      if (knownFaces.length > 1 || unknownFaces.length > 1) {
        return {
          isMatch: false,
          confidence: 0,
          similarity: 0,
          details: { error: 'Multiple faces detected in one or both images' }
        };
      }

      // Use the first (and should be only) face from each image
      const knownFaceId = knownFaces[0].faceId;
      const unknownFaceId = unknownFaces[0].faceId;

      if (!knownFaceId || !unknownFaceId) {
        return {
          isMatch: false,
          confidence: 0,
          similarity: 0,
          details: { error: 'Unable to extract face IDs for comparison' }
        };
      }

      // Compare the faces
      const verifyResult = await this.client.face.verifyFaceToFace(knownFaceId, unknownFaceId);

      // Azure returns confidence as a value between 0 and 1
      // Convert to percentage and apply threshold
      const confidence = verifyResult.confidence * 100;
      const similarity = confidence; // Azure confidence can be used as similarity
      
      // Azure's isIdentical is based on their internal threshold
      // We can also apply our own threshold for additional control
      const customThreshold = 0.7; // 70% confidence threshold
      const isMatch = verifyResult.isIdentical && verifyResult.confidence >= customThreshold;

      return {
        isMatch,
        confidence,
        similarity,
        details: {
          azureIsIdentical: verifyResult.isIdentical,
          azureConfidence: verifyResult.confidence,
          customThreshold: customThreshold * 100,
          knownFaceId: knownFaceId,
          unknownFaceId: unknownFaceId
        }
      };

    } catch (error) {
      console.error('Azure Face comparison error:', error);
      throw new Error(`Face comparison failed: ${error.message}`);
    }
  }

  /**
   * Validate image for registration with comprehensive checks
   */
  async validateImageForRegistration(imageData: string): Promise<{
    isValid: boolean;
    message: string;
    qualityScore: number;
    recommendations: string[];
  }> {
    if (!this.isAvailable) {
      throw new Error('Azure Face API is not available');
    }

    try {
      const detectionResult = await this.detectFaces(imageData);
      
      if (!detectionResult.isValid) {
        return {
          isValid: false,
          message: detectionResult.message,
          qualityScore: detectionResult.confidence,
          recommendations: this.generateRecommendations(detectionResult.details)
        };
      }

      return {
        isValid: true,
        message: 'Image is suitable for face registration',
        qualityScore: detectionResult.confidence,
        recommendations: []
      };

    } catch (error) {
      console.error('Azure Face validation error:', error);
      return {
        isValid: false,
        message: 'Image validation failed',
        qualityScore: 0,
        recommendations: ['Please try again with a different image']
      };
    }
  }

  /**
   * Generate recommendations based on face analysis
   */
  private generateRecommendations(details: any): string[] {
    const recommendations = [];

    if (details.blur && details.blur > 0.5) {
      recommendations.push('Hold the camera steady and ensure good focus');
    }

    if (details.exposure && (details.exposure < -1.0 || details.exposure > 1.0)) {
      recommendations.push('Improve lighting conditions');
    }

    if (details.noise && details.noise > 0.7) {
      recommendations.push('Use better lighting to reduce image noise');
    }

    if (details.headPose) {
      const { pitch, roll, yaw } = details.headPose;
      if (Math.abs(pitch) > 20 || Math.abs(roll) > 20 || Math.abs(yaw) > 20) {
        recommendations.push('Look directly at the camera with your head straight');
      }
    }

    if (details.qualityForRecognition === 'low') {
      recommendations.push('Ensure good lighting and clear visibility of your face');
    }

    return recommendations;
  }
}

export const azureFaceService = new AzureFaceService();