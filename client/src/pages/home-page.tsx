import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, LogOut, User, Calendar, TrendingUp, Camera, AlertCircle } from "lucide-react";
import { FaceAuthModal } from "@/components/face-auth-modal";
import { CameraFaceCapture } from "@/components/camera-face-capture";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AttendanceRecord {
  id: number;
  clockInTime: string;
  clockOutTime?: string;
  date: string;
  totalHours?: string;
}

interface TodayStatus {
  record?: AttendanceRecord;
  isClockedIn: boolean;
}

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showFaceAuth, setShowFaceAuth] = useState(false);
  const [showFaceRegistration, setShowFaceRegistration] = useState(false);
  const [clockAction, setClockAction] = useState<'in' | 'out'>('in');
  const { toast } = useToast();

  const { data: todayStatus, refetch: refetchToday } = useQuery<TodayStatus>({
    queryKey: ["/api/attendance/today"],
  });

  const { data: attendanceRecords = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance"],
  });

  const faceRegistrationMutation = useMutation({
    mutationFn: async (faceData: string) => {
      const res = await apiRequest("POST", "/api/register-face", { faceData });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Face registration failed");
      }
      
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Face Registered",
        description: "Your face has been successfully registered for secure authentication.",
      });
      setShowFaceRegistration(false);
      // Refresh user data to update face registration status
      window.location.reload();
    },
    onError: (error: Error) => {
      let errorMessage = error.message;
      
      if (errorMessage.includes("quality too low")) {
        errorMessage = "Face image quality is too low. Please ensure good lighting and try again.";
      } else if (!errorMessage || errorMessage === "Face registration failed") {
        errorMessage = "Face registration failed. Please ensure good lighting and clear face visibility.";
      }
      
      toast({
        title: "Registration Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleClockAction = (action: 'in' | 'out') => {
    // Check if user has registered face first
    if (!user?.faceRegistered) {
      toast({
        title: "Face Registration Required",
        description: "Please register your face first to use face authentication.",
        variant: "destructive",
      });
      setShowFaceRegistration(true);
      return;
    }
    
    setClockAction(action);
    setShowFaceAuth(true);
  };

  const handleFaceAuthSuccess = () => {
    setShowFaceAuth(false);
    if (clockAction === 'in') {
      setLocation("/welcome");
    } else {
      setLocation("/thank-you");
    }
  };

  const handleFaceRegistration = (faceData: string) => {
    faceRegistrationMutation.mutate(faceData);
  };

  const isClockedIn = todayStatus?.isClockedIn || false;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3 sm:py-4">
            <div className="flex items-center">
              <div className="h-7 w-7 sm:h-8 sm:w-8 bg-primary rounded-full flex items-center justify-center mr-2 sm:mr-3">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <h1 className="text-lg sm:text-xl font-semibold text-gray-800">ClockIn Pro</h1>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <span className="text-xs sm:text-sm text-gray-600 hidden sm:inline">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="text-xs sm:text-sm text-gray-600 sm:hidden">
                {user?.firstName}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Face Registration Alert */}
        {!user?.faceRegistered && (
          <Alert className="mb-4 sm:mb-6 border-orange-200 bg-orange-50">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                <span className="text-sm sm:text-base">Face authentication not set up. Register your face to use secure clock in/out.</span>
                <Button 
                  size="sm" 
                  onClick={() => setShowFaceRegistration(true)}
                  className="sm:ml-4 bg-orange-600 hover:bg-orange-700 w-full sm:w-auto"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Register Face
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Clock In/Out Section */}
        <Card className="mb-6 sm:mb-8">
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
            <div className="text-center">
              <div className="mb-4 sm:mb-6">
                <div className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
                  {currentTime.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                  })}
                </div>
                <div className="text-sm sm:text-base text-gray-600">
                  {format(currentTime, 'EEEE, MMMM d, yyyy')}
                </div>
              </div>

              {/* Status Display */}
              <div className="mb-6 sm:mb-8">
                <Badge 
                  variant={isClockedIn ? "default" : "secondary"} 
                  className={`mb-3 sm:mb-4 px-3 sm:px-4 py-2 text-sm ${
                    isClockedIn 
                      ? "bg-green-100 text-green-800 hover:bg-green-100" 
                      : "bg-red-100 text-red-800 hover:bg-red-100"
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    isClockedIn ? "bg-green-500" : "bg-red-500"
                  }`} />
                  {isClockedIn ? "Clocked In" : "Not Clocked In"}
                </Badge>
                <div className="text-gray-600 text-xs sm:text-sm">
                  {todayStatus?.record ? (
                    isClockedIn ? (
                      `Clocked in at ${format(new Date(todayStatus.record.clockInTime), 'h:mm a')}`
                    ) : (
                      `Last clocked out at ${format(new Date(todayStatus.record.clockOutTime!), 'h:mm a')}`
                    )
                  ) : (
                    "No activity today"
                  )}
                </div>
              </div>

              {/* Clock In/Out Button */}
              <Button 
                onClick={() => handleClockAction(isClockedIn ? 'out' : 'in')}
                size="lg"
                className="w-full max-w-sm mx-auto h-14 sm:h-16 text-base sm:text-lg font-semibold mb-4 sm:mb-6 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <User className="mr-2 sm:mr-3 h-5 w-5 sm:h-6 sm:w-6" />
                <span className="hidden sm:inline">
                  {isClockedIn ? "Clock Out with Face ID" : "Clock In with Face ID"}
                </span>
                <span className="sm:hidden">
                  {isClockedIn ? "Clock Out" : "Clock In"}
                </span>
              </Button>

              <p className="text-xs sm:text-sm text-gray-500">Use Face ID for secure and quick clock in/out</p>
            </div>
          </CardContent>
        </Card>

        {/* Today's Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card>
            <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                </div>
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Hours Today</p>
                  <p className="text-lg sm:text-2xl font-semibold text-gray-900 truncate">
                    {todayStatus?.record?.totalHours || "0h 0m"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
                  <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                </div>
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">This Week</p>
                  <p className="text-lg sm:text-2xl font-semibold text-gray-900 truncate">32h 15m</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                </div>
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">This Month</p>
                  <p className="text-lg sm:text-2xl font-semibold text-gray-900 truncate">128h 45m</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-lg sm:text-xl">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            {attendanceRecords.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-gray-500">
                <div className="text-sm sm:text-base">No attendance records yet. Clock in to get started!</div>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {attendanceRecords.map((record) => (
                  <div key={record.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-center min-w-0 flex-1">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mr-3 flex-shrink-0 ${
                        record.clockOutTime 
                          ? "bg-red-100" 
                          : "bg-green-100"
                      }`}>
                        <LogOut className={`h-3 w-3 sm:h-4 sm:w-4 ${
                          record.clockOutTime 
                            ? "text-red-600" 
                            : "text-green-600"
                        }`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-800 text-sm sm:text-base truncate">
                          {record.clockOutTime ? "Clocked Out" : "Clocked In"}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-600 truncate">
                          {format(new Date(record.date), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="font-medium text-gray-800 text-sm sm:text-base">
                        {record.clockOutTime 
                          ? format(new Date(record.clockOutTime), 'h:mm a')
                          : format(new Date(record.clockInTime), 'h:mm a')
                        }
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600">
                        {record.totalHours || "In progress"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Face Authentication Modal */}
      <FaceAuthModal
        isOpen={showFaceAuth}
        onClose={() => setShowFaceAuth(false)}
        onSuccess={handleFaceAuthSuccess}
        action={clockAction}
      />

      {/* Face Registration Modal */}
      {showFaceRegistration && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <CameraFaceCapture
                onCapture={handleFaceRegistration}
                onCancel={() => setShowFaceRegistration(false)}
                title="Register Your Face"
                description="Set up face authentication for secure and convenient clock in/out"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
