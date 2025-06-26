import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CameraFaceCapture } from "@/components/camera-face-capture";
import { useToast } from "@/hooks/use-toast";

export default function SecurityTestPage() {
  const [testEmail, setTestEmail] = useState("");
  const [testPassword, setTestPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showFaceCapture, setShowFaceCapture] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);
  const { toast } = useToast();

  const handleLogin = async () => {
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail, password: testPassword }),
      });

      if (response.ok) {
        const user = await response.json();
        setCurrentUser(user);
        setIsLoggedIn(true);
        toast({
          title: "Login Successful",
          description: `Logged in as ${user.email}`,
        });
      } else {
        const error = await response.json();
        toast({
          title: "Login Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Login Error",
        description: "Failed to login",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
      setIsLoggedIn(false);
      setCurrentUser(null);
      setTestEmail("");
      setTestPassword("");
      toast({
        title: "Logged Out",
        description: "Successfully logged out",
      });
    } catch (error) {
      toast({
        title: "Logout Error",
        description: "Failed to logout",
        variant: "destructive",
      });
    }
  };

  const handleFaceCapture = async (faceData: string) => {
    try {
      const response = await fetch("/api/verify-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageData: faceData,
          action: "in",
          location: { latitude: "51.43", longitude: "-0.551" }, // Mock location
        }),
      });

      const result = await response.json();
      
      const testResult = {
        timestamp: new Date().toLocaleTimeString(),
        account: currentUser?.email || "Unknown",
        verified: result.verified,
        distance: result.distance,
        securityLevel: result.securityLevel,
        reason: result.reason,
        message: result.message,
        success: response.ok,
      };

      setTestResults(prev => [testResult, ...prev]);
      
      if (result.verified) {
        toast({
          title: "Face Verification SUCCESS",
          description: `Distance: ${result.distance?.toFixed(4)} - ${result.securityLevel}`,
        });
      } else {
        toast({
          title: "Face Verification BLOCKED",
          description: result.message || `Distance: ${result.distance?.toFixed(4)} - Security threshold exceeded`,
          variant: "destructive",
        });
      }
    } catch (error) {
      const testResult = {
        timestamp: new Date().toLocaleTimeString(),
        account: currentUser?.email || "Unknown",
        verified: false,
        error: "Network/Server Error",
        success: false,
      };
      
      setTestResults(prev => [testResult, ...prev]);
      
      toast({
        title: "Test Error",
        description: "Failed to test face verification",
        variant: "destructive",
      });
    }
    
    setShowFaceCapture(false);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Face Recognition Security Test</CardTitle>
          <CardDescription>
            Test the enhanced face recognition security to verify false positives are prevented
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isLoggedIn ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Test Account Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="Enter account email to test"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={testPassword}
                  onChange={(e) => setTestPassword(e.target.value)}
                  placeholder="Enter password"
                />
              </div>
              <Button onClick={handleLogin} className="w-full">
                Login to Test Account
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Currently logged in as: <strong>{currentUser?.email}</strong>
                  <br />
                  Account has face image: <strong>{currentUser?.faceImageUrl ? "YES" : "NO"}</strong>
                </AlertDescription>
              </Alert>
              
              <div className="flex gap-4">
                <Button 
                  onClick={() => setShowFaceCapture(true)}
                  disabled={!currentUser?.faceImageUrl}
                  className="flex-1"
                >
                  Test Face Verification
                </Button>
                <Button onClick={handleLogout} variant="outline" className="flex-1">
                  Logout & Test Another Account
                </Button>
              </div>
              
              {!currentUser?.faceImageUrl && (
                <Alert>
                  <AlertDescription>
                    This account has no registered face image. Face verification cannot be tested.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {showFaceCapture && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Capture Face for Verification</CardTitle>
            <CardDescription>
              Use your actual face to test if the system correctly accepts/rejects you on this account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CameraFaceCapture
              title="Security Test - Face Capture"
              description="Capture your face to test the verification system"
              onCapture={handleFaceCapture}
              onCancel={() => setShowFaceCapture(false)}
            />
          </CardContent>
        </Card>
      )}

      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              Results showing face verification security performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <div 
                  key={index} 
                  className={`p-4 border rounded-lg ${
                    result.verified 
                      ? "border-green-500 bg-green-50 dark:bg-green-900/20" 
                      : "border-red-500 bg-red-50 dark:bg-red-900/20"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium">
                      {result.account} - {result.timestamp}
                    </div>
                    <div className={`px-2 py-1 rounded text-sm font-bold ${
                      result.verified 
                        ? "bg-green-500 text-white" 
                        : "bg-red-500 text-white"
                    }`}>
                      {result.verified ? "ACCEPTED" : "REJECTED"}
                    </div>
                  </div>
                  
                  {result.distance && (
                    <div className="text-sm space-y-1">
                      <div>Distance: <span className="font-mono">{result.distance.toFixed(4)}</span></div>
                      {result.securityLevel && (
                        <div>Security Level: <span className="font-medium">{result.securityLevel}</span></div>
                      )}
                      {result.reason && (
                        <div>Reason: <span className="text-gray-600 dark:text-gray-400">{result.reason}</span></div>
                      )}
                    </div>
                  )}
                  
                  {result.message && (
                    <div className="text-sm mt-2 text-gray-600 dark:text-gray-400">
                      {result.message}
                    </div>
                  )}
                  
                  {result.error && (
                    <div className="text-sm mt-2 text-red-600">
                      Error: {result.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}