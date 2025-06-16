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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      
      // Simulate face detection after video starts
      const timer = setTimeout(() => {
        setIsDetected(true);
      }, 2000);
      
      return () => clearTimeout(timer);
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
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive",
      });
    }
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
                  {isDetected && (
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-full text-sm font-medium">
                      Face Detected
                    </div>
                  )}
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