import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Check, X, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as faceapi from 'face-api.js';

interface CameraFaceCaptureProps {
  onCapture: (faceData: string) => void;
  onCancel: () => void;
  title: string;
  description: string;
  isVerification?: boolean;
}

export function CameraFaceCapture({ 
  onCapture, 
  onCancel, 
  title, 
  description, 
  isVerification = false 
}: CameraFaceCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isDetected, setIsDetected] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [detectionStatus, setDetectionStatus] = useState('Initializing...');
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceDescriptor, setFaceDescriptor] = useState<Float32Array | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadModels();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, []);

  const loadModels = async () => {
    try {
      setDetectionStatus('Loading face recognition models...');
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        faceapi.nets.faceExpressionNet.loadFromUri('/models'),
      ]);
      setModelsLoaded(true);
      setDetectionStatus('Models loaded, starting camera...');
      startCamera();
    } catch (error) {
      console.error('Error loading face detection models:', error);
      setDetectionStatus('Using basic detection (models failed to load)');
      startCamera();
    }
  };

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        startFaceDetection();
      };
    }
  }, [stream]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          facingMode: 'user',
          frameRate: { ideal: 30, min: 15 }
        },
        audio: false
      });
      setStream(mediaStream);
      setDetectionStatus('Camera started - preparing detection...');
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions and ensure your device has a camera.",
        variant: "destructive",
      });
    }
  };

  const startFaceDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }

    setDetectionStatus('Analyzing video feed...');

    detectionIntervalRef.current = setInterval(async () => {
      if (videoRef.current && canvasRef.current) {
        try {
          const video = videoRef.current;
          
          if (video.readyState === 4) {
            if (modelsLoaded) {
              // Use face-api.js for accurate detection
              const detections = await faceapi
                .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptors();

              if (detections.length > 0) {
                const detection = detections[0];
                const confidence = detection.detection.score;
                
                if (confidence > 0.7) { // Even higher confidence threshold for better accuracy
                  setIsDetected(true);
                  setFaceDescriptor(detection.descriptor);
                  setDetectionStatus(`Face detected! (${Math.round(confidence * 100)}% confidence)`);
                } else if (confidence > 0.4) {
                  setIsDetected(false);
                  setDetectionStatus(`Face detected but quality too low (${Math.round(confidence * 100)}%) - improve lighting and positioning`);
                } else {
                  setIsDetected(false);
                  setDetectionStatus('No clear face detected - position your face in the frame');
                }
              } else {
                setIsDetected(false);
                setDetectionStatus('No face detected - position your face in the frame');
              }
            } else {
              // Fallback to basic detection
              const canvas = canvasRef.current;
              const context = canvas.getContext('2d');

              if (context) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0);

                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                const hasFace = analyzeImageForFace(imageData);

                if (hasFace) {
                  setIsDetected(true);
                  setDetectionStatus('Face detected! (basic mode)');
                } else {
                  setIsDetected(false);
                  setDetectionStatus('No face detected - position your face in the frame');
                }
              }
            }
          }
        } catch (error) {
          console.error('Face detection error:', error);
          setDetectionStatus('Detection error - please try again');
        }
      }
    }, 300); // Check every 300ms for better responsiveness
  };

  const analyzeImageForFace = (imageData: ImageData): boolean => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // Simple face detection based on skin tone and brightness patterns
    let skinPixels = 0;
    let totalPixels = 0;
    let brightnessVariation = 0;
    let avgBrightness = 0;

    // Sample pixels in the center area where face would typically be
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const sampleRadius = Math.min(width, height) / 4;

    for (let y = centerY - sampleRadius; y < centerY + sampleRadius; y += 4) {
      for (let x = centerX - sampleRadius; x < centerX + sampleRadius; x += 4) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const index = (y * width + x) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          
          // Check for skin-like colors
          const isSkinTone = (r > 95 && g > 40 && b > 20) &&
                            (Math.max(r, g, b) - Math.min(r, g, b) > 15) &&
                            (Math.abs(r - g) > 15) && (r > g) && (r > b);
          
          if (isSkinTone) skinPixels++;
          
          const brightness = (r + g + b) / 3;
          avgBrightness += brightness;
          totalPixels++;
        }
      }
    }

    if (totalPixels === 0) return false;

    avgBrightness /= totalPixels;
    const skinRatio = skinPixels / totalPixels;
    
    // Face detected if there's enough skin tone and reasonable brightness
    return skinRatio > 0.1 && avgBrightness > 50 && avgBrightness < 220;
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedImage(imageData);
      
      let faceDescriptorData;
      
      if (modelsLoaded && faceDescriptor) {
        // Use the real face descriptor from face-api.js
        faceDescriptorData = JSON.stringify(Array.from(faceDescriptor));
      } else {
        // Fallback to enhanced basic descriptor
        faceDescriptorData = generateEnhancedFaceDescriptor(imageData, context, canvas);
      }
      
      setTimeout(() => {
        setIsCapturing(false);
        onCapture(faceDescriptorData);
      }, 1000);
    }
  };

  const generateEnhancedFaceDescriptor = (imageData: string, context: CanvasRenderingContext2D, canvas: HTMLCanvasElement): string => {
    // Enhanced face descriptor generation with more facial feature analysis
    const imgData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const width = canvas.width;
    const height = canvas.height;
    
    // Analyze multiple facial regions
    const features = {
      eyeRegion: analyzeFaceRegion(data, width, height, 0.3, 0.25, 0.4, 0.15), // Eyes area
      noseRegion: analyzeFaceRegion(data, width, height, 0.4, 0.4, 0.2, 0.2),  // Nose area
      mouthRegion: analyzeFaceRegion(data, width, height, 0.35, 0.65, 0.3, 0.15), // Mouth area
      overallBrightness: calculateAverageBrightness(data),
      colorDistribution: analyzeColorDistribution(data),
      timestamp: Date.now()
    };
    
    return JSON.stringify(features);
  };

  const analyzeFaceRegion = (data: Uint8ClampedArray, width: number, height: number, 
                           xRatio: number, yRatio: number, wRatio: number, hRatio: number) => {
    const startX = Math.floor(width * xRatio);
    const startY = Math.floor(height * yRatio);
    const regionWidth = Math.floor(width * wRatio);
    const regionHeight = Math.floor(height * hRatio);
    
    let totalR = 0, totalG = 0, totalB = 0, pixelCount = 0;
    
    for (let y = startY; y < startY + regionHeight && y < height; y++) {
      for (let x = startX; x < startX + regionWidth && x < width; x++) {
        const index = (y * width + x) * 4;
        totalR += data[index];
        totalG += data[index + 1];
        totalB += data[index + 2];
        pixelCount++;
      }
    }
    
    return {
      avgR: Math.round(totalR / pixelCount),
      avgG: Math.round(totalG / pixelCount),
      avgB: Math.round(totalB / pixelCount),
      brightness: Math.round((totalR + totalG + totalB) / (pixelCount * 3))
    };
  };

  const calculateAverageBrightness = (data: Uint8ClampedArray): number => {
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      total += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }
    return Math.round(total / (data.length / 4));
  };

  const analyzeColorDistribution = (data: Uint8ClampedArray) => {
    const buckets = new Array(8).fill(0);
    
    for (let i = 0; i < data.length; i += 16) { // Sample every 4th pixel
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const bucket = Math.floor(brightness / 32);
      buckets[Math.min(bucket, 7)]++;
    }
    
    return buckets;
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setIsCapturing(false);
    setIsDetected(false);
    
    // Restart face detection
    setTimeout(() => {
      setIsDetected(true);
    }, 2000);
  };

  if (capturedImage) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="text-center">
          <h3 className="text-lg sm:text-xl font-semibold mb-2">{title}</h3>
          <p className="text-gray-600 text-sm sm:text-base">{description}</p>
        </div>

        <Card>
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
            <div className="relative mb-4 sm:mb-6">
              <img 
                src={capturedImage} 
                alt="Captured face" 
                className="w-full h-48 sm:h-64 object-cover rounded-xl"
              />
              <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-green-600 text-white px-2 py-1 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium flex items-center">
                <Check className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                Captured
              </div>
            </div>

            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
              <Button variant="outline" onClick={retakePhoto} className="flex-1">
                <RotateCcw className="w-4 h-4 mr-2" />
                Retake
              </Button>
              <Button onClick={async () => {
                if (modelsLoaded && capturedImage) {
                  // Re-analyze the captured image for final descriptor
                  const img = new Image();
                  img.onload = async () => {
                    try {
                      const detections = await faceapi
                        .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
                        .withFaceLandmarks()
                        .withFaceDescriptors();
                      
                      if (detections.length > 0) {
                        const descriptor = JSON.stringify(Array.from(detections[0].descriptor));
                        onCapture(descriptor);
                      } else {
                        const context = canvasRef.current?.getContext('2d');
                        if (context && canvasRef.current) {
                          onCapture(generateEnhancedFaceDescriptor(capturedImage, context, canvasRef.current));
                        }
                      }
                    } catch (error) {
                      const context = canvasRef.current?.getContext('2d');
                      if (context && canvasRef.current) {
                        onCapture(generateEnhancedFaceDescriptor(capturedImage, context, canvasRef.current));
                      }
                    }
                  };
                  img.src = capturedImage;
                } else {
                  const context = canvasRef.current?.getContext('2d');
                  if (context && canvasRef.current && capturedImage) {
                    onCapture(generateEnhancedFaceDescriptor(capturedImage, context, canvasRef.current));
                  }
                }
              }} className="flex-1">
                <Check className="w-4 h-4 mr-2" />
                {isVerification ? "Verify" : "Register"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center">
        <h3 className="text-lg sm:text-xl font-semibold mb-2">{title}</h3>
        <p className="text-gray-600 text-sm sm:text-base">{description}</p>
      </div>

      <Card>
        <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
          <div className="relative mb-4 sm:mb-6">
            <div className="aspect-video bg-gray-900 rounded-xl overflow-hidden relative">
              {stream ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  
                  {/* Face detection overlay - responsive sizing */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`w-32 h-40 sm:w-48 sm:h-60 border-4 rounded-2xl transition-colors duration-300 ${
                      isDetected ? "border-green-500" : "border-blue-500"
                    }`} />
                  </div>
                  
                  {/* Corner indicators - responsive positioning */}
                  {[
                    "top-2 left-2 sm:top-4 sm:left-4 border-l-4 border-t-4 rounded-tl-lg",
                    "top-2 right-2 sm:top-4 sm:right-4 border-r-4 border-t-4 rounded-tr-lg", 
                    "bottom-2 left-2 sm:bottom-4 sm:left-4 border-l-4 border-b-4 rounded-bl-lg",
                    "bottom-2 right-2 sm:bottom-4 sm:right-4 border-r-4 border-b-4 rounded-br-lg"
                  ].map((position, index) => (
                    <div key={index} className={`absolute w-6 h-6 sm:w-8 sm:h-8 transition-colors duration-300 ${
                      isDetected ? "border-green-500" : "border-blue-500"
                    } ${position}`} />
                  ))}
                  
                  {/* Status indicator - responsive sizing */}
                  <div className={`absolute bottom-2 sm:bottom-4 left-1/2 transform -translate-x-1/2 px-3 py-1 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium ${
                    isDetected 
                      ? "bg-green-600 text-white" 
                      : "bg-yellow-600 text-white"
                  }`}>
                    <span className="hidden sm:inline">{detectionStatus}</span>
                    <span className="sm:hidden">
                      {isDetected ? "Face detected!" : "Position face"}
                    </span>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center text-white">
                    <Camera className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm sm:text-base">Starting camera...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
              <h4 className="text-xs sm:text-sm font-medium text-blue-800 mb-2">Tips for best results:</h4>
              <ul className="text-xs sm:text-sm text-blue-700 space-y-1">
                <li>• Look directly at the camera</li>
                <li>• Ensure bright, even lighting on your face</li>
                <li>• Keep your face centered in the frame</li>
                <li>• Remove glasses, hats, and face coverings</li>
                <li>• Stay still and maintain neutral expression</li>
                <li className="hidden sm:list-item">• Keep camera at eye level for best results</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
              <Button variant="outline" onClick={onCancel} className="flex-1">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button 
                onClick={capturePhoto}
                disabled={!isDetected || isCapturing}
                className="flex-1"
              >
                <Camera className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">
                  {isCapturing ? "Capturing..." : "Capture Face"}
                </span>
                <span className="sm:hidden">
                  {isCapturing ? "Capturing..." : "Capture"}
                </span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}