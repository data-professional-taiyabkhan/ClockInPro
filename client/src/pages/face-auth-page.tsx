import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { User, Camera, ArrowLeft } from "lucide-react";

export default function FaceAuthPage() {
  const [, setLocation] = useLocation();
  const [isDetected, setIsDetected] = useState(false);

  useEffect(() => {
    // Simulate face detection after 2 seconds
    const timer = setTimeout(() => {
      setIsDetected(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleRegister = () => {
    // In a real app, this would register the face data
    setLocation("/auth");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-green-600 rounded-full flex items-center justify-center mb-4">
            <User className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800">Setup Face ID</h2>
          <p className="mt-2 text-gray-600">Position your face within the frame for secure authentication</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="relative mb-6">
              <div className="aspect-square bg-gray-200 rounded-2xl overflow-hidden relative">
                {/* Camera preview placeholder */}
                <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                  <Camera className="h-16 w-16 text-gray-400" />
                </div>
                
                {/* Face detection overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`w-64 h-80 border-4 rounded-3xl transition-colors duration-300 ${
                    isDetected ? "border-green-500" : "border-blue-500"
                  }`} />
                </div>
                
                {/* Corner indicators */}
                <div className={`absolute top-4 left-4 w-8 h-8 border-l-4 border-t-4 rounded-tl-lg transition-colors duration-300 ${
                  isDetected ? "border-green-500" : "border-blue-500"
                }`} />
                <div className={`absolute top-4 right-4 w-8 h-8 border-r-4 border-t-4 rounded-tr-lg transition-colors duration-300 ${
                  isDetected ? "border-green-500" : "border-blue-500"
                }`} />
                <div className={`absolute bottom-4 left-4 w-8 h-8 border-l-4 border-b-4 rounded-bl-lg transition-colors duration-300 ${
                  isDetected ? "border-green-500" : "border-blue-500"
                }`} />
                <div className={`absolute bottom-4 right-4 w-8 h-8 border-r-4 border-b-4 rounded-br-lg transition-colors duration-300 ${
                  isDetected ? "border-green-500" : "border-blue-500"
                }`} />
                
                {/* Status indicator */}
                {isDetected && (
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-full text-sm font-medium">
                    Face Detected
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-800 mb-2">Tips for best results:</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Look directly at the camera</li>
                  <li>• Ensure good lighting</li>
                  <li>• Keep your face within the frame</li>
                  <li>• Remove glasses if possible</li>
                </ul>
              </div>

              <Button 
                onClick={handleRegister}
                disabled={!isDetected}
                className="w-full"
                size="lg"
              >
                <Camera className="mr-2 h-5 w-5" />
                Register My Face
              </Button>

              <Button 
                variant="ghost" 
                onClick={() => setLocation("/auth")}
                className="w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Registration
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
