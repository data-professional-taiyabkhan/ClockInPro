import { spawn } from 'child_process';
import { join } from 'path';

export class PythonFaceService {
  private pythonPath: string;
  private servicePath: string;

  constructor() {
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
    this.servicePath = join(process.cwd(), 'python_face_service', 'face_recognition_service.py');
  }

  /**
   * Check if Python service is available and working
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.runPythonScript('detect', 'test');
      return !result.error;
    } catch {
      return false;
    }
  }

  /**
   * Detect faces in an image and validate quality
   */
  async detectFaces(imageData: string): Promise<{
    isValid: boolean;
    message: string;
    faceCount: number;
    qualityScore: number;
    details: {
      brightness: number;
      sharpness: number;
      faceSize: number;
    };
  }> {
    try {
      const result = await this.runPythonScript('detect', imageData);
      
      if (result.error) {
        return {
          isValid: false,
          message: result.error,
          faceCount: 0,
          qualityScore: 0,
          details: {
            brightness: 0,
            sharpness: 0,
            faceSize: 0,
          },
        };
      }

      return result;
    } catch (error) {
      console.error('Python face detection error:', error);
      return {
        isValid: false,
        message: 'Face detection service unavailable',
        faceCount: 0,
        qualityScore: 0,
        details: {
          brightness: 0,
          sharpness: 0,
          faceSize: 0,
        },
      };
    }
  }

  /**
   * Compare two face images
   */
  async compareFaces(knownImageData: string, unknownImageData: string): Promise<{
    isMatch: boolean;
    similarity: number;
    confidence: number;
    distance: number;
    message: string;
  }> {
    try {
      const result = await this.runPythonScript('compare', knownImageData, unknownImageData);
      
      if (result.error) {
        return {
          isMatch: false,
          similarity: 0,
          confidence: 0,
          distance: 1.0,
          message: result.error,
        };
      }

      return result;
    } catch (error) {
      console.error('Python face comparison error:', error);
      return {
        isMatch: false,
        similarity: 0,
        confidence: 0,
        distance: 1.0,
        message: 'Face comparison service unavailable',
      };
    }
  }

  /**
   * Run Python script with arguments
   */
  private runPythonScript(...args: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const python = spawn(this.pythonPath, [this.servicePath, ...args]);
      
      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          console.error('Python script error:', stderr);
          reject(new Error(`Python script exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch (parseError) {
          console.error('Failed to parse Python output:', stdout, stderr);
          reject(new Error(`Failed to parse Python output: ${parseError}`));
        }
      });

      python.on('error', (error) => {
        console.error('Failed to start Python process:', error);
        reject(error);
      });
    });
  }
}

export const pythonFaceService = new PythonFaceService();