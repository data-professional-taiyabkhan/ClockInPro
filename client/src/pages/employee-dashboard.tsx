import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Clock, MapPin, Camera, LogOut, Upload } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface UserLocation {
  latitude?: number;
  longitude?: number;
  postcode?: string;
}

export default function EmployeeDashboard() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string>("");
  const [userLocation, setUserLocation] = useState<UserLocation>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user
  const { data: user } = useQuery({
    queryKey: ["/api/user"],
  });

  // Get today's attendance
  const { data: todayAttendance } = useQuery({
    queryKey: ["/api/attendance/today"],
  });

  // Get recent attendance records
  const { data: attendanceRecords } = useQuery({
    queryKey: ["/api/attendance"],
  });

  // Get user location
  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.warn("Location access denied:", error);
        }
      );
    }
  };

  // Face image upload mutation
  const uploadFaceMutation = useMutation({
    mutationFn: async (imageData: string) => {
      return await apiRequest("/api/upload-face-image", {
        method: "POST",
        body: JSON.stringify({ imageData }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Face image uploaded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Face verification mutation
  const verifyFaceMutation = useMutation({
    mutationFn: async (imageData: string) => {
      return await apiRequest("/api/verify-face", {
        method: "POST",
        body: JSON.stringify({ imageData, userLocation }),
      });
    },
    onSuccess: (data) => {
      if (data.verified) {
        clockInMutation.mutate({
          locationPostcode: userLocation.postcode,
          verified: true,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Clock in mutation
  const clockInMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/clock-in", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Clocked in successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Clock In Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Clock out mutation
  const clockOutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/clock-out", {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Clocked out successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Clock Out Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/logout", {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.reload();
    },
  });

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user" } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCapturing(true);
        getUserLocation();
      }
    } catch (error) {
      toast({
        title: "Camera Error",
        description: "Could not access camera",
        variant: "destructive",
      });
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(imageData);
        
        // Stop camera
        const stream = video.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
        setIsCapturing(false);
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        uploadFaceMutation.mutate(imageData);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFaceCheckIn = () => {
    if (capturedImage) {
      verifyFaceMutation.mutate(capturedImage);
      setCapturedImage("");
    }
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Welcome, {user.firstName}</h1>
            <p className="text-gray-600 dark:text-gray-400">
              {format(new Date(), "EEEE, MMMM do, yyyy")}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Face Registration */}
        {!user.faceImageUrl && (
          <Alert>
            <Camera className="h-4 w-4" />
            <AlertDescription>
              You haven't registered your face yet. Please upload a clear photo of your face to enable check-in.
              <div className="mt-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadFaceMutation.isPending}
                  size="sm"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadFaceMutation.isPending ? "Uploading..." : "Upload Face Photo"}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Today's Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Today's Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                <Badge variant={todayAttendance?.isClockedIn ? "default" : "secondary"}>
                  {todayAttendance?.isClockedIn ? "Clocked In" : "Not Clocked In"}
                </Badge>
              </div>
              
              {todayAttendance?.record?.clockInTime && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Clock In Time</p>
                  <p className="font-medium">
                    {format(new Date(todayAttendance.record.clockInTime), "h:mm a")}
                  </p>
                </div>
              )}

              {todayAttendance?.record?.clockOutTime && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Clock Out Time</p>
                  <p className="font-medium">
                    {format(new Date(todayAttendance.record.clockOutTime), "h:mm a")}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2">
              {user.faceImageUrl && !todayAttendance?.isClockedIn && (
                <div className="space-y-2">
                  {!isCapturing && !capturedImage && (
                    <Button onClick={startCamera} className="w-full">
                      <Camera className="h-4 w-4 mr-2" />
                      Start Face Check-In
                    </Button>
                  )}

                  {isCapturing && (
                    <div className="space-y-2">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full max-w-sm mx-auto rounded-lg"
                      />
                      <Button onClick={captureImage} className="w-full">
                        Capture Face
                      </Button>
                    </div>
                  )}

                  {capturedImage && (
                    <div className="space-y-2">
                      <img
                        src={capturedImage}
                        alt="Captured face"
                        className="w-full max-w-sm mx-auto rounded-lg"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={handleFaceCheckIn}
                          disabled={verifyFaceMutation.isPending || clockInMutation.isPending}
                          className="flex-1"
                        >
                          {verifyFaceMutation.isPending || clockInMutation.isPending
                            ? "Processing..."
                            : "Clock In"
                          }
                        </Button>
                        <Button
                          onClick={() => setCapturedImage("")}
                          variant="outline"
                        >
                          Retake
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {todayAttendance?.isClockedIn && (
                <Button
                  onClick={() => clockOutMutation.mutate()}
                  disabled={clockOutMutation.isPending}
                  variant="destructive"
                  className="w-full"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {clockOutMutation.isPending ? "Clocking Out..." : "Clock Out"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Attendance */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Attendance</CardTitle>
            <CardDescription>Your attendance history</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {attendanceRecords?.slice(0, 5).map((record: any) => (
                <div
                  key={record.id}
                  className="flex justify-between items-center p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{record.date}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {format(new Date(record.clockInTime), "h:mm a")}
                      {record.clockOutTime && (
                        <> - {format(new Date(record.clockOutTime), "h:mm a")}</>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    {record.checkInMethod === "manual" && (
                      <Badge variant="outline">Manual</Badge>
                    )}
                    {record.clockOutTime && (
                      <p className="text-sm font-medium">{record.totalHours}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Hidden canvas for image capture */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}