import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

export default function WelcomePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const clockInMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/clock-in"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
    },
  });

  useEffect(() => {
    // Perform clock in when component mounts
    clockInMutation.mutate();

    // Auto redirect after 3 seconds
    const timer = setTimeout(() => {
      setLocation("/");
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const currentTime = new Date();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 to-blue-50">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="mx-auto h-20 w-20 bg-green-600 rounded-full flex items-center justify-center mb-6 animate-pulse">
            <Check className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Welcome!</h2>
          <p className="text-xl text-gray-700 mb-2">
            Good {currentTime.getHours() < 12 ? "morning" : currentTime.getHours() < 18 ? "afternoon" : "evening"}, <span className="font-semibold">{user?.firstName}</span>
          </p>
          <p className="text-gray-600">You've successfully clocked in</p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-600">Clock In Time</span>
              <span className="font-semibold text-gray-800">
                {format(currentTime, 'h:mm a')}
              </span>
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
          Continue to Dashboard
        </Button>
      </div>
    </div>
  );
}
