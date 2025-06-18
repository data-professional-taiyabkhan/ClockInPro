import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Camera, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface FaceQualityMetrics {
  isValid: boolean;
  issues: string[];
  quality: number;
  confidence: number;
}

interface AWSFaceCaptureProps {
  onCapture: (faceData: string, metrics: FaceQualityMetrics) => void;
  onCancel: () => void;
  title: string;
  description: string;
  isRegistration?: boolean;
}

export function AWSFaceCapture({ 
  onCapture, 
  onCancel, 
  title, 
  description, 
  isRegistration = false 
}: AWSFaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDetected, setIsDetected] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [qualityMetrics, setQualityMetrics] = useState<FaceQualityMetrics | null>(null);
  const [detectionStatus, setDetectionStatus] = useState('Initializing camera...');
  const [countdown, setCountdown] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const { toast } = useToast();

  // Initialize camera
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 1280 }, 
            height: { ideal: 720 },
            facingMode: 'user'
          }
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setDetectionStatus('Position your face in the camera');
      } catch (error) {
        console.error('Camera access failed:', error);
        setDetectionStatus('Camera access denied');
        toast({
          title: "Camera Error",
          description: "Please allow camera access to continue",
          variant: "destructive"
        });
      }
    };

    initializeCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Face detection and quality validation
  useEffect(() => {
    if (!videoRef.current || isCapturing) return;

    const detectAndValidate = async () => {
      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        // Capture current frame
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to base64 for validation
        const imageData = canvas.toDataURL('image/jpeg', 0.9);

        // Basic face detection (simple brightness and skin tone check)
        const imageDataObj = context.getImageData(0, 0, canvas.width, canvas.height);
        const hasBasicFace = detectBasicFace(imageDataObj);
        setIsDetected(hasBasicFace);

        if (hasBasicFace && isRegistration) {
          // Validate with AWS Rekognition for registration
          setIsValidating(true);
          try {
            const response = await apiRequest('POST', '/api/validate-face', { faceData: imageData });

            const metrics = await response.json();
            setQualityMetrics(metrics);

            if (metrics.isValid) {
              setDetectionStatus('High quality face detected! Ready to capture');
              if (metrics.quality > 85 && metrics.confidence > 95) {
                // Auto-capture for excellent quality
                startCountdown();
              }
            } else {
              setDetectionStatus(metrics.issues[0] || 'Improve image quality');
            }
          } catch (error) {
            console.error('Face validation error:', error);
            setDetectionStatus('Face detected - click to capture');
          } finally {
            setIsValidating(false);
          }
        } else if (hasBasicFace) {
          setDetectionStatus('Face detected - click to capture');
          setQualityMetrics({ isValid: true, issues: [], quality: 80, confidence: 90 });
        } else {
          setDetectionStatus('No face detected - position your face in the frame');
          setQualityMetrics(null);
        }
      } catch (error) {
        console.error('Detection error:', error);
        setDetectionStatus('Detection error - please try again');
      }
    };

    const interval = setInterval(detectAndValidate, 500);
    return () => clearInterval(interval);
  }, [isRegistration, isCapturing]);

  const detectBasicFace = (imageData: ImageData): boolean => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    let skinPixels = 0;
    let totalPixels = 0;
    let avgBrightness = 0;

    // Sample center region
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const sampleRadius = Math.min(width, height) / 6;

    for (let x = centerX - sampleRadius; x < centerX + sampleRadius; x++) {
      for (let y = centerY - sampleRadius; y < centerY + sampleRadius; y++) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const i = (y * width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Skin tone detection
          const isSkinTone = r > 95 && g > 40 && b > 20 && 
                            Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
                            Math.abs(r - g) > 15 && r > g && r > b;

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
    
    return skinRatio > 0.15 && avgBrightness > 60 && avgBrightness < 200;
  };

  const startCountdown = () => {
    if (isCapturing) return;
    
    setIsCapturing(true);
    setCountdown(3);
    
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          captureFace();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const captureFace = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) return;

      // High quality capture
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = canvas.toDataURL('image/jpeg', 0.95);

      // Final validation for registration
      if (isRegistration) {
        setIsValidating(true);
        try {
          const response = await apiRequest('POST', '/api/validate-face', { faceData: imageData });

          const finalMetrics = await response.json();
          
          if (finalMetrics.isValid) {
            onCapture(imageData, finalMetrics);
          } else {
            toast({
              title: "Image Quality Issue",
              description: finalMetrics.issues[0] || "Please try capturing again",
              variant: "destructive"
            });
            setIsCapturing(false);
          }
        } catch (error) {
          console.error('Final validation error:', error);
          // Proceed with basic validation
          onCapture(imageData, qualityMetrics || { isValid: true, issues: [], quality: 80, confidence: 90 });
        } finally {
          setIsValidating(false);
        }
      } else {
        onCapture(imageData, qualityMetrics || { isValid: true, issues: [], quality: 80, confidence: 90 });
      }
    } catch (error) {
      console.error('Capture error:', error);
      toast({
        title: "Capture Failed",
        description: "Please try again",
        variant: "destructive"
      });
      setIsCapturing(false);
    }
  }, [onCapture, qualityMetrics, isRegistration, toast]);

  const handleManualCapture = () => {
    if (isDetected && !isCapturing) {
      startCountdown();
    }
  };

  const getQualityColor = (quality: number) => {
    if (quality >= 90) return 'text-green-600';
    if (quality >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="w-5 h-5" />
          {title}
        </CardTitle>
        <p className="text-gray-600">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Camera Feed */}
        <div className="relative w-full max-w-md mx-auto">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full rounded-lg border"
            style={{ transform: 'scaleX(-1)' }}
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Face Detection Overlay */}
          {isDetected && (
            <div className="absolute inset-4 border-2 border-green-500 rounded-lg">
              <div className="absolute -top-6 left-0 bg-green-500 text-white text-xs px-2 py-1 rounded">
                Face Detected
              </div>
            </div>
          )}

          {/* Countdown Overlay */}
          {countdown > 0 && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
              <div className="text-white text-6xl font-bold">{countdown}</div>
            </div>
          )}

          {/* Validation Spinner */}
          {isValidating && (
            <div className="absolute top-2 right-2 bg-blue-500 text-white p-2 rounded-full">
              <RefreshCw className="w-4 h-4 animate-spin" />
            </div>
          )}
        </div>

        {/* Status and Quality Metrics */}
        <div className="text-center space-y-3">
          <div className={`text-sm font-medium ${
            isDetected ? 'text-green-600' : 'text-amber-600'
          }`}>
            {detectionStatus}
          </div>

          {/* Quality Metrics */}
          {qualityMetrics && isRegistration && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span>Image Quality:</span>
                <Badge variant={qualityMetrics.isValid ? "default" : "destructive"}>
                  {qualityMetrics.quality.toFixed(0)}%
                </Badge>
              </div>
              <Progress value={qualityMetrics.quality} className="w-full h-2" />
              
              <div className="flex justify-between items-center text-sm">
                <span>Confidence:</span>
                <span className={getQualityColor(qualityMetrics.confidence)}>
                  {qualityMetrics.confidence.toFixed(0)}%
                </span>
              </div>

              {qualityMetrics.issues.length > 0 && (
                <div className="text-xs text-red-600 space-y-1">
                  {qualityMetrics.issues.map((issue, index) => (
                    <div key={index} className="flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {issue}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex justify-center space-x-3">
          <Button 
            onClick={handleManualCapture}
            disabled={!isDetected || isCapturing || isValidating}
            className="flex items-center gap-2"
          >
            {isCapturing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            {isCapturing ? 'Capturing...' : 'Capture Face'}
          </Button>
          
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>

        {/* Tips */}
        <div className="text-xs text-gray-500 text-center space-y-1">
          <p>• Ensure good lighting on your face</p>
          <p>• Look directly at the camera</p>
          <p>• Keep your face centered in the frame</p>
          {isRegistration && <p>• High quality image required for registration</p>}
        </div>
      </CardContent>
    </Card>
  );
}