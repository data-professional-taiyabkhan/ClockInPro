import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { SimpleFaceCapture } from "@/components/simple-face-capture";

export default function WelcomePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [showFaceRegistration, setShowFaceRegistration] = useState(false);

  const clockInMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/clock-in"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
    },
  });

  const registerFaceMutation = useMutation({
    mutationFn: (faceData: string) => apiRequest("POST", "/api/register-face", { faceData }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setShowFaceRegistration(false);
      setLocation("/");
    },
  });

  useEffect(() => {
    // Check if user needs face registration
    if (!user?.faceRegistered) {
      setShowFaceRegistration(true);
      return;
    }

    // Perform clock in when component mounts
    clockInMutation.mutate();

    // Auto redirect after 3 seconds
    const timer = setTimeout(() => {
      setLocation("/");
    }, 3000);

    return () => clearTimeout(timer);
  }, [user?.faceRegistered, clockInMutation, setLocation]);

  const currentTime = new Date();

  const handleFaceCapture = (faceData: string) => {
    registerFaceMutation.mutate(faceData);
  };

  if (showFaceRegistration) {
    return (
      <div className="min-h-screen flex items-center justify-center p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="w-full max-w-2xl">
          <SimpleFaceCapture
            title="Register Your Face"
            description="To use face authentication for attendance, please register your face"
            onCapture={handleFaceCapture}
            onCancel={() => setLocation("/")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-3 sm:p-4 bg-gradient-to-br from-green-50 to-blue-50">
      <div className="max-w-md w-full text-center">
        <div className="mb-6 sm:mb-8">
          <div className="mx-auto h-16 w-16 sm:h-20 sm:w-20 bg-green-600 rounded-full flex items-center justify-center mb-4 sm:mb-6 animate-pulse">
            <Check className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3 sm:mb-4">Welcome!</h2>
          <p className="text-lg sm:text-xl text-gray-700 mb-2">
            Good {currentTime.getHours() < 12 ? "morning" : currentTime.getHours() < 18 ? "afternoon" : "evening"}, <span className="font-semibold">{user?.firstName}</span>
          </p>
          <p className="text-gray-600 text-sm sm:text-base">You've successfully clocked in</p>
        </div>

        <Card className="mb-6 sm:mb-8">
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <span className="text-gray-600 text-sm sm:text-base">Clock In Time</span>
              <span className="font-semibold text-gray-800 text-sm sm:text-base">
                {format(currentTime, 'h:mm a')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm sm:text-base">Date</span>
              <span className="font-semibold text-gray-800 text-sm sm:text-base">
                <span className="hidden sm:inline">{format(currentTime, 'EEEE, MMM d, yyyy')}</span>
                <span className="sm:hidden">{format(currentTime, 'MMM d, yyyy')}</span>
              </span>
            </div>
          </CardContent>
        </Card>

        <Button 
          onClick={() => setLocation("/")}
          className="w-full"
          size="lg"
        >
          Continue to Dashboard
        </Button>
      </div>
    </div>
  );
}
