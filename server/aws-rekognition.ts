import { RekognitionClient, CompareFacesCommand, DetectFacesCommand } from '@aws-sdk/client-rekognition';

export class AWSRekognitionService {
  private client: RekognitionClient;

  constructor() {
    // AWS Rekognition requires a specific region, not "Global"
    let region = process.env.AWS_REGION || 'us-east-1';
    if (region.toLowerCase() === 'global') {
      region = 'us-east-1'; // Default to us-east-1 for global setting
    }
    
    console.log(`Initializing AWS Rekognition with region: ${region}`);
    
    this.client = new RekognitionClient({
      region: region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  /**
   * Convert base64 image data to buffer for AWS Rekognition
   */
  private imageDataToBuffer(imageData: string): Buffer {
    // Remove data:image/jpeg;base64, prefix if present
    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    return Buffer.from(base64Data, 'base64');
  }

  /**
   * Detect faces in an image and return quality metrics
   */
  async detectFaces(imageData: string): Promise<{
    faceCount: number;
    quality: number;
    confidence: number;
    boundingBox?: any;
    landmarks?: any[];
    isGoodQuality: boolean;
  }> {
    try {
      const imageBuffer = this.imageDataToBuffer(imageData);
      
      const command = new DetectFacesCommand({
        Image: { Bytes: imageBuffer },
        Attributes: ['ALL']
      });

      const response = await this.client.send(command);
      
      if (!response.FaceDetails || response.FaceDetails.length === 0) {
        return {
          faceCount: 0,
          quality: 0,
          confidence: 0,
          isGoodQuality: false
        };
      }

      const face = response.FaceDetails[0];
      const quality = face.Quality || {};
      const confidence = face.Confidence || 0;
      
      // Calculate overall quality score
      const brightnessScore = Math.max(0, Math.min(100, (quality.Brightness || 50)));
      const sharpnessScore = Math.max(0, Math.min(100, (quality.Sharpness || 50)));
      const overallQuality = (confidence + brightnessScore + sharpnessScore) / 3;
      
      // Good quality criteria
      const isGoodQuality = confidence > 90 && 
                           (quality.Brightness || 0) > 30 && 
                           (quality.Sharpness || 0) > 30;

      return {
        faceCount: response.FaceDetails.length,
        quality: overallQuality,
        confidence,
        boundingBox: face.BoundingBox,
        landmarks: face.Landmarks,
        isGoodQuality
      };
    } catch (error) {
      console.error('AWS Rekognition face detection error:', error);
      throw new Error('Face detection failed');
    }
  }

  /**
   * Compare two face images and return similarity score
   */
  async compareFaces(sourceImageData: string, targetImageData: string): Promise<{
    similarity: number;
    confidence: number;
    isMatch: boolean;
    sourceQuality: number;
    targetQuality: number;
  }> {
    try {
      const sourceBuffer = this.imageDataToBuffer(sourceImageData);
      const targetBuffer = this.imageDataToBuffer(targetImageData);

      const command = new CompareFacesCommand({
        SourceImage: { Bytes: sourceBuffer },
        TargetImage: { Bytes: targetBuffer },
        SimilarityThreshold: 70, // Minimum similarity threshold
        QualityFilter: 'AUTO'
      });

      const response = await this.client.send(command);
      
      if (!response.FaceMatches || response.FaceMatches.length === 0) {
        return {
          similarity: 0,
          confidence: 0,
          isMatch: false,
          sourceQuality: 0,
          targetQuality: 0
        };
      }

      const match = response.FaceMatches[0];
      const similarity = match.Similarity || 0;
      const confidence = match.Face?.Confidence || 0;
      
      // Get quality metrics for both images
      const sourceQualityScore = response.SourceImageFace?.Confidence || 0;
      const targetQualityScore = match.Face?.Confidence || 0;

      // Match criteria: high similarity and confidence
      const isMatch = similarity >= 85 && confidence >= 90;

      return {
        similarity,
        confidence,
        isMatch,
        sourceQuality: sourceQualityScore,
        targetQuality: targetQualityScore
      };
    } catch (error) {
      console.error('AWS Rekognition face comparison error:', error);
      throw new Error('Face comparison failed');
    }
  }

  /**
   * Validate if an image is suitable for face registration
   */
  async validateImageForRegistration(imageData: string): Promise<{
    isValid: boolean;
    issues: string[];
    quality: number;
    confidence: number;
  }> {
    const detection = await this.detectFaces(imageData);
    const issues: string[] = [];

    if (detection.faceCount === 0) {
      issues.push('No face detected in image');
    } else if (detection.faceCount > 1) {
      issues.push('Multiple faces detected - please ensure only one person is in the image');
    }

    if (detection.confidence < 90) {
      issues.push('Face detection confidence is too low - please ensure good lighting');
    }

    if (detection.quality < 70) {
      issues.push('Image quality is too low - please ensure the image is clear and well-lit');
    }

    return {
      isValid: issues.length === 0,
      issues,
      quality: detection.quality,
      confidence: detection.confidence
    };
  }
}

export const rekognitionService = new AWSRekognitionService();