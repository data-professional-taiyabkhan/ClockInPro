import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, Camera } from "lucide-react";
import { CameraFaceCapture } from "./camera-face-capture";
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
      const res = await apiRequest("POST", "/api/verify-face", { faceData });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Face Verified",
        description: `Successfully verified for clock ${action}`,
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Face Verification Failed",
        description: error.message,
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
      <DialogContent className="sm:max-w-lg">
        {showCamera ? (
          <CameraFaceCapture
            onCapture={handleFaceCapture}
            onCancel={handleCancel}
            title={`Verify Identity for Clock ${action === 'in' ? 'In' : 'Out'}`}
            description="Position your face within the frame to verify your identity"
            isVerification={true}
          />
        ) : (
          <div className="text-center p-6">
            <div className="mx-auto h-12 w-12 bg-primary rounded-full flex items-center justify-center mb-4">
              <User className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Face Verification</h3>
            <p className="text-gray-600 mb-6">Prepare for face authentication</p>
            <Button onClick={() => setShowCamera(true)} className="w-full">
              Start Face Verification
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
