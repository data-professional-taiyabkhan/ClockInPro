import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, Camera } from "lucide-react";

interface FaceAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  action: 'in' | 'out';
}

export function FaceAuthModal({ isOpen, onClose, onSuccess, action }: FaceAuthModalProps) {
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVerified(false);
      // Simulate face verification after 2 seconds
      const timer = setTimeout(() => {
        setIsVerified(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    onSuccess();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center flex flex-col items-center">
            <div className="mx-auto h-12 w-12 bg-primary rounded-full flex items-center justify-center mb-4">
              <User className="h-6 w-6 text-white" />
            </div>
            Verify Your Identity
          </DialogTitle>
          <p className="text-center text-gray-600">Position your face within the frame</p>
        </DialogHeader>

        <div className="relative mb-6">
          <div className="aspect-square bg-gray-200 rounded-xl overflow-hidden relative">
            {/* Camera preview placeholder */}
            <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
              <Camera className="h-12 w-12 text-gray-400" />
            </div>
            
            {/* Face detection overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`w-48 h-60 border-4 rounded-2xl transition-colors duration-300 ${
                isVerified ? "border-green-500" : "border-blue-500"
              }`} />
            </div>
            
            {/* Authentication Status */}
            {isVerified && (
              <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-full text-sm font-medium">
                Identity Verified
              </div>
            )}
          </div>
        </div>

        <div className="flex space-x-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!isVerified}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            Clock {action === 'in' ? 'In' : 'Out'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
