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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="mx-auto h-20 w-20 bg-purple-600 rounded-full flex items-center justify-center mb-6 animate-pulse">
            <Heart className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Thank You!</h2>
          <p className="text-xl text-gray-700 mb-2">
            Have a great evening, <span className="font-semibold">{user?.firstName}</span>
          </p>
          <p className="text-gray-600">Thank you for your hard work today</p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-600">Clock Out Time</span>
              <span className="font-semibold text-gray-800">
                {format(currentTime, 'h:mm a')}
              </span>
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-600">Total Hours Today</span>
              <span className="font-semibold text-green-600">8h 30m</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Date</span>
              <span className="font-semibold text-gray-800">
                {format(currentTime, 'EEEE, MMM d, yyyy')}
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
