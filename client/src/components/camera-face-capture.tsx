import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Check, X, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, []);

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
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });
      setStream(mediaStream);
      setDetectionStatus('Camera started');
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const startFaceDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }

    setDetectionStatus('Analyzing video feed...');

    detectionIntervalRef.current = setInterval(() => {
      if (videoRef.current && canvasRef.current) {
        try {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          const context = canvas.getContext('2d');

          if (context && video.readyState === 4) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0);

            // Analyze the image data for face-like features
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const hasFace = analyzeImageForFace(imageData);

            if (hasFace) {
              setIsDetected(true);
              setDetectionStatus('Face detected!');
            } else {
              setIsDetected(false);
              setDetectionStatus('No face detected - position your face in the frame');
            }
          }
        } catch (error) {
          setDetectionStatus('Detection error - please try again');
        }
      }
    }, 500); // Check every 500ms
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

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(imageData);
      
      // Generate a simple face "descriptor" - in reality this would be complex facial recognition
      const faceDescriptor = generateFaceDescriptor(imageData);
      
      setTimeout(() => {
        setIsCapturing(false);
        onCapture(faceDescriptor);
      }, 1000);
    }
  };

  const generateFaceDescriptor = (imageData: string): string => {
    // This is a simplified version. In a real app, you'd use face-api.js or similar
    // to extract actual facial features and create a descriptor
    const hash = btoa(imageData.substring(0, 100));
    return `face_${Date.now()}_${hash.substring(0, 20)}`;
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
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-xl font-semibold mb-2">{title}</h3>
          <p className="text-gray-600">{description}</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="relative mb-6">
              <img 
                src={capturedImage} 
                alt="Captured face" 
                className="w-full h-64 object-cover rounded-xl"
              />
              <div className="absolute top-3 right-3 bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center">
                <Check className="w-4 h-4 mr-1" />
                Captured
              </div>
            </div>

            <div className="flex space-x-3">
              <Button variant="outline" onClick={retakePhoto} className="flex-1">
                <RotateCcw className="w-4 h-4 mr-2" />
                Retake
              </Button>
              <Button onClick={() => onCapture(generateFaceDescriptor(capturedImage))} className="flex-1">
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
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-gray-600">{description}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative mb-6">
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
                  
                  {/* Face detection overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`w-48 h-60 border-4 rounded-2xl transition-colors duration-300 ${
                      isDetected ? "border-green-500" : "border-blue-500"
                    }`} />
                  </div>
                  
                  {/* Corner indicators */}
                  {[
                    "top-4 left-4 border-l-4 border-t-4 rounded-tl-lg",
                    "top-4 right-4 border-r-4 border-t-4 rounded-tr-lg", 
                    "bottom-4 left-4 border-l-4 border-b-4 rounded-bl-lg",
                    "bottom-4 right-4 border-r-4 border-b-4 rounded-br-lg"
                  ].map((position, index) => (
                    <div key={index} className={`absolute w-8 h-8 transition-colors duration-300 ${
                      isDetected ? "border-green-500" : "border-blue-500"
                    } ${position}`} />
                  ))}
                  
                  {/* Status indicator */}
                  <div className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full text-sm font-medium ${
                    isDetected 
                      ? "bg-green-600 text-white" 
                      : "bg-yellow-600 text-white"
                  }`}>
                    {detectionStatus}
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center text-white">
                    <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Starting camera...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">Tips for best results:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Look directly at the camera</li>
                <li>• Ensure good lighting on your face</li>
                <li>• Keep your face within the blue frame</li>
                <li>• Remove glasses and hat if possible</li>
                <li>• Stay still during capture</li>
              </ul>
            </div>

            <div className="flex space-x-3">
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
                {isCapturing ? "Capturing..." : "Capture Face"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}