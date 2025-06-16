import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

export default function ThankYouPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const clockOutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/clock-out"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
    },
  });

  useEffect(() => {
    // Perform clock out when component mounts
    clockOutMutation.mutate();

    // Auto redirect after 3 seconds
    const timer = setTimeout(() => {
      setLocation("/");
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const currentTime = new Date();

  return (
    <div className="min-h-screen flex items-center justify-center p-3 sm:p-4 bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="max-w-md w-full text-center">
        <div className="mb-6 sm:mb-8">
          <div className="mx-auto h-16 w-16 sm:h-20 sm:w-20 bg-purple-600 rounded-full flex items-center justify-center mb-4 sm:mb-6 animate-pulse">
            <Heart className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3 sm:mb-4">Thank You!</h2>
          <p className="text-lg sm:text-xl text-gray-700 mb-2">
            Have a great evening, <span className="font-semibold">{user?.firstName}</span>
          </p>
          <p className="text-gray-600 text-sm sm:text-base">Thank you for your hard work today</p>
        </div>

        <Card className="mb-6 sm:mb-8">
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <span className="text-gray-600 text-sm sm:text-base">Clock Out Time</span>
              <span className="font-semibold text-gray-800 text-sm sm:text-base">
                {format(currentTime, 'h:mm a')}
              </span>
            </div>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <span className="text-gray-600 text-sm sm:text-base">Total Hours Today</span>
              <span className="font-semibold text-green-600 text-sm sm:text-base">8h 30m</span>
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
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
}
