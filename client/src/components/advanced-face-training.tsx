import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, CheckCircle, RotateCcw, RotateCw, Move } from "lucide-react";
import * as faceapi from 'face-api.js';

interface AdvancedFaceTrainingProps {
  onComplete: (trainingData: string) => void;
  onCancel: () => void;
}

type TrainingStep = {
  id: string;
  name: string;
  instruction: string;
  icon: React.ReactNode;
  completed: boolean;
  descriptor?: number[];
};

export function AdvancedFaceTraining({ onComplete, onCancel }: AdvancedFaceTrainingProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  const [trainingSteps, setTrainingSteps] = useState<TrainingStep[]>([
    {
      id: 'center',
      name: 'Center Position',
      instruction: 'Look directly at the camera with your face centered',
      icon: <Camera className="w-5 h-5" />,
      completed: false
    },
    {
      id: 'left',
      name: 'Turn Left',
      instruction: 'Slowly turn your head to the left (your left)',
      icon: <RotateCcw className="w-5 h-5" />,
      completed: false
    },
    {
      id: 'right', 
      name: 'Turn Right',
      instruction: 'Slowly turn your head to the right (your right)',
      icon: <RotateCw className="w-5 h-5" />,
      completed: false
    },
    {
      id: 'up',
      name: 'Look Up',
      instruction: 'Tilt your head slightly upward',
      icon: <Move className="w-5 h-5" />,
      completed: false
    },
    {
      id: 'down',
      name: 'Look Down', 
      instruction: 'Tilt your head slightly downward',
      icon: <Move className="w-5 h-5" />,
      completed: false
    },
    {
      id: 'close',
      name: 'Move Closer',
      instruction: 'Move closer to the camera (fill more of the frame)',
      icon: <Camera className="w-5 h-5" />,
      completed: false
    },
    {
      id: 'far',
      name: 'Move Back',
      instruction: 'Move back from the camera (show more of your shoulders)',
      icon: <Camera className="w-5 h-5" />,
      completed: false
    }
  ]);

  const currentStep = trainingSteps[currentStepIndex];
  const progress = (trainingSteps.filter(step => step.completed).length / trainingSteps.length) * 100;

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models')
        ]);
        setModelsLoaded(true);
      } catch (error) {
        console.error('Failed to load face-api models:', error);
      }
    };

    loadModels();
  }, []);

  useEffect(() => {
    const startCamera = async () => {
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
      } catch (error) {
        console.error('Error accessing camera:', error);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!modelsLoaded || !videoRef.current) return;

    const detectFace = async () => {
      try {
        const detections = await faceapi.detectAllFaces(
          videoRef.current!,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 })
        ).withFaceLandmarks().withFaceDescriptors();

        const hasValidFace = detections.length > 0 && detections[0].detection.score > 0.7;
        setFaceDetected(hasValidFace);

        // Auto-capture when face is well-positioned and stable
        if (hasValidFace && !isCapturing && !currentStep.completed) {
          // Check if face is in good position for current step
          if (isFaceInCorrectPosition(detections[0], currentStep.id)) {
            startCountdown();
          }
        }
      } catch (error) {
        setFaceDetected(false);
      }
    };

    const interval = setInterval(detectFace, 200);
    return () => clearInterval(interval);
  }, [modelsLoaded, currentStepIndex, isCapturing]);

  const isFaceInCorrectPosition = (detection: any, stepId: string): boolean => {
    const landmarks = detection.landmarks;
    const box = detection.detection.box;
    
    // Get key facial landmarks
    const nose = landmarks.getNose()[3]; // Nose tip
    const leftEye = landmarks.getLeftEye()[0];
    const rightEye = landmarks.getRightEye()[3];
    const mouth = landmarks.getMouth()[3];
    
    // Calculate face center and angles
    const eyeCenter = { x: (leftEye.x + rightEye.x) / 2, y: (leftEye.y + rightEye.y) / 2 };
    const faceWidth = box.width;
    const faceHeight = box.height;

    switch (stepId) {
      case 'center':
        // Face should be centered and upright
        const horizontalCenter = Math.abs(nose.x - eyeCenter.x) < faceWidth * 0.1;
        const verticalAlignment = Math.abs(leftEye.y - rightEye.y) < faceHeight * 0.05;
        return horizontalCenter && verticalAlignment;
        
      case 'left':
        // Head turned left (nose should be to the left of eye center)
        return (eyeCenter.x - nose.x) > faceWidth * 0.15;
        
      case 'right':
        // Head turned right (nose should be to the right of eye center)  
        return (nose.x - eyeCenter.x) > faceWidth * 0.15;
        
      case 'up':
        // Head tilted up (nose should be above eye center)
        return (eyeCenter.y - nose.y) > faceHeight * 0.1;
        
      case 'down':
        // Head tilted down (nose should be below eye center)
        return (nose.y - eyeCenter.y) > faceHeight * 0.1;
        
      case 'close':
        // Face should fill more of the frame
        return faceWidth > videoRef.current!.videoWidth * 0.4;
        
      case 'far':
        // Face should be smaller in frame
        return faceWidth < videoRef.current!.videoWidth * 0.25;
        
      default:
        return true;
    }
  };

  const startCountdown = () => {
    if (isCapturing) return;
    
    setIsCapturing(true);
    setCountdown(3);
    
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          captureStep();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const captureStep = async () => {
    if (!videoRef.current || !canvasRef.current || !modelsLoaded) return;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) return;

      // Standardized capture
      canvas.width = 640;
      canvas.height = 480;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Get face descriptor
      const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length > 0) {
        const descriptor = Array.from(detections[0].descriptor);
        
        // Update training step
        setTrainingSteps(prev => prev.map(step => 
          step.id === currentStep.id 
            ? { ...step, completed: true, descriptor }
            : step
        ));

        // Move to next step or complete training
        if (currentStepIndex < trainingSteps.length - 1) {
          setTimeout(() => {
            setCurrentStepIndex(prev => prev + 1);
            setIsCapturing(false);
          }, 1000);
        } else {
          completeTraining();
        }
      }
    } catch (error) {
      console.error('Capture failed:', error);
      setIsCapturing(false);
    }
  };

  const completeTraining = () => {
    // Combine all descriptors into a comprehensive training model
    const completedSteps = trainingSteps.filter(step => step.completed && step.descriptor);
    
    if (completedSteps.length >= 5) {
      // Create averaged descriptor from all captures
      const descriptorLength = completedSteps[0].descriptor!.length;
      const averagedDescriptor = new Array(descriptorLength).fill(0);
      
      completedSteps.forEach(step => {
        step.descriptor!.forEach((val, idx) => {
          averagedDescriptor[idx] += val / completedSteps.length;
        });
      });

      // Create comprehensive training data
      const trainingData = {
        version: 2,
        type: 'advanced-training',
        primaryDescriptor: averagedDescriptor,
        poseDescriptors: completedSteps.map(step => ({
          pose: step.id,
          descriptor: step.descriptor,
          timestamp: Date.now()
        })),
        trainingComplete: true,
        quality: completedSteps.length / trainingSteps.length
      };

      onComplete(JSON.stringify(trainingData));
    }
  };

  const resetStep = () => {
    setTrainingSteps(prev => prev.map(step => 
      step.id === currentStep.id 
        ? { ...step, completed: false, descriptor: undefined }
        : step
    ));
    setIsCapturing(false);
    setCountdown(0);
  };

  if (!modelsLoaded) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Loading face recognition models...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Face Training Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="w-full" />
      </div>

      {/* Current Step */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center mb-4">
            <div className="flex items-center justify-center mb-2">
              {currentStep.icon}
              <h3 className="text-lg font-semibold ml-2">{currentStep.name}</h3>
            </div>
            <p className="text-gray-600">{currentStep.instruction}</p>
          </div>

          {/* Camera Feed */}
          <div className="relative w-full max-w-md mx-auto mb-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-lg border"
              style={{ transform: 'scaleX(-1)' }}
            />
            
            {/* Face Detection Overlay */}
            {faceDetected && (
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

            {/* Step Completed Overlay */}
            {currentStep.completed && (
              <div className="absolute inset-0 bg-green-500 bg-opacity-80 flex items-center justify-center rounded-lg">
                <CheckCircle className="w-16 h-16 text-white" />
              </div>
            )}
          </div>

          {/* Status */}
          <div className="text-center space-y-2">
            {!faceDetected && !isCapturing && (
              <p className="text-amber-600">Position your face according to the instruction above</p>
            )}
            {faceDetected && !isCapturing && !currentStep.completed && (
              <p className="text-green-600">Hold position - capturing automatically...</p>
            )}
            {currentStep.completed && (
              <p className="text-green-600 font-semibold">✓ Step completed successfully!</p>
            )}
          </div>

          {/* Controls */}
          <div className="flex justify-center space-x-3 mt-4">
            {currentStep.completed && currentStepIndex < trainingSteps.length - 1 && (
              <Button onClick={() => {
                setCurrentStepIndex(prev => prev + 1);
                setIsCapturing(false);
              }}>
                Next Step
              </Button>
            )}
            {!currentStep.completed && (
              <Button variant="outline" onClick={resetStep}>
                Reset Step
              </Button>
            )}
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Steps Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {trainingSteps.map((step, index) => (
          <div
            key={step.id}
            className={`p-3 rounded-lg border text-center ${
              step.completed 
                ? 'bg-green-50 border-green-200' 
                : index === currentStepIndex
                ? 'bg-blue-50 border-blue-200'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex justify-center mb-1">
              {step.completed ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                step.icon
              )}
            </div>
            <div className="text-xs font-medium">{step.name}</div>
          </div>
        ))}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}