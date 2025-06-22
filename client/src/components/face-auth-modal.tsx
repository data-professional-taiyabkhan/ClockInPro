import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, Camera } from "lucide-react";
import { SimpleFaceCapture } from "./simple-face-capture";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface FaceAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  action: 'in' | 'out';
}

export function FaceAuthModal({ isOpen, onClose, onSuccess, action }: FaceAuthModalProps) {
  const [showCamera, setShowCamera] = useState(false);
  const { toast } = useToast();

  const verifyFaceMutation = useMutation({
    mutationFn: async (faceData: string) => {
      return await apiRequest("/api/verify-face", {
        method: "POST",
        body: JSON.stringify({ faceData })
      });
    },
    onSuccess: () => {
      toast({
        title: "Face Verified",
        description: `Successfully verified for clock ${action}`,
      });
      onSuccess();
    },
    onError: (error: Error) => {
      let errorMessage = error.message;
      
      // Provide user-friendly error messages
      if (errorMessage.includes("face does not match")) {
        errorMessage = "Your face doesn't match the registered profile. Please try again with better lighting or re-register your face.";
      } else if (errorMessage.includes("not registered")) {
        errorMessage = "No face profile found. Please register your face first from the dashboard.";
      } else if (errorMessage.includes("quality too low")) {
        errorMessage = "Face image quality is too low. Please improve lighting and try again.";
      } else if (!errorMessage || errorMessage === "Face verification failed") {
        errorMessage = "Face verification failed. Please ensure good lighting and try again.";
      }
      
      toast({
        title: "Verification Failed",
        description: errorMessage,
        variant: "destructive",
      });
      setShowCamera(false);
    },
  });

  useEffect(() => {
    if (isOpen) {
      setShowCamera(true);
    } else {
      setShowCamera(false);
    }
  }, [isOpen]);

  const handleFaceCapture = (faceData: string) => {
    verifyFaceMutation.mutate(faceData);
  };

  const handleCancel = () => {
    setShowCamera(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-w-[95vw] max-h-[95vh] overflow-y-auto">
        <DialogHeader className="px-4 sm:px-6">
          <DialogTitle className="text-lg sm:text-xl">
            {action === 'in' ? 'Clock In' : 'Clock Out'} - Face Verification
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            Use face authentication to securely {action === 'in' ? 'clock in' : 'clock out'} for your attendance.
          </DialogDescription>
        </DialogHeader>
        <div className="px-4 sm:px-6 pb-4 sm:pb-6">
          {showCamera ? (
            <SimpleFaceCapture
              onCapture={handleFaceCapture}
              onCancel={handleCancel}
              title={`Verify Identity for Clock ${action === 'in' ? 'In' : 'Out'}`}
              description="Position your face within the frame to verify your identity"
            />
          ) : (
            <div className="text-center p-4 sm:p-6">
              <div className="mx-auto h-10 w-10 sm:h-12 sm:w-12 bg-primary rounded-full flex items-center justify-center mb-3 sm:mb-4">
                <User className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold mb-2">Face Verification</h3>
              <p className="text-gray-600 mb-4 sm:mb-6 text-sm sm:text-base">Prepare for face authentication</p>
              <Button onClick={() => setShowCamera(true)} className="w-full">
                Start Face Verification
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
