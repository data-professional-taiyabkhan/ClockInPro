import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, MapPin, Clock, Plus, LogOut } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterData } from "@shared/schema";

export default function ManagerDashboard() {
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user
  const { data: user } = useQuery({
    queryKey: ["/api/user"],
  });

  // Get employees
  const { data: employees } = useQuery({
    queryKey: ["/api/employees"],
  });

  // Get locations
  const { data: locations } = useQuery({
    queryKey: ["/api/locations"],
  });

  // Get attendance records
  const { data: attendanceRecords } = useQuery({
    queryKey: ["/api/attendance"],
  });

  // Employee registration form
  const employeeForm = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      password: "",
      confirmPassword: "",
      role: "employee",
    },
  });

  // Add employee mutation
  const addEmployeeMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      return await apiRequest("/api/register", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Employee added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsAddingEmployee(false);
      employeeForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Registration Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add location mutation
  const addLocationMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/locations", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Location added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      setIsAddingLocation(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Location Creation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Manual clock-in mutation
  const manualClockInMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/manual-clock-in", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Manual clock-in recorded",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Manual Clock-in Failed",
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

  const handleAddEmployee = (data: RegisterData) => {
    addEmployeeMutation.mutate(data);
  };

  const handleAddLocation = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const locationData = {
      name: formData.get("name"),
      postcode: formData.get("postcode"),
      latitude: formData.get("latitude"),
      longitude: formData.get("longitude"),
      radiusMeters: parseInt(formData.get("radiusMeters") as string) || 100,
    };
    addLocationMutation.mutate(locationData);
  };

  const handleManualClockIn = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const clockInData = {
      userId: parseInt(formData.get("userId") as string),
      date: formData.get("date"),
      clockInTime: new Date(formData.get("clockInTime") as string),
      locationId: parseInt(formData.get("locationId") as string) || null,
      notes: formData.get("notes"),
    };
    manualClockInMutation.mutate(clockInData);
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Manager Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage employees and attendance - {format(new Date(), "EEEE, MMMM do, yyyy")}
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

        <Tabs defaultValue="attendance" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          </TabsList>

          {/* Attendance Tab */}
          <TabsContent value="attendance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Attendance Records
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {attendanceRecords?.map((record: any) => (
                    <div
                      key={record.id}
                      className="flex justify-between items-center p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">Employee ID: {record.userId}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {record.date} - {format(new Date(record.clockInTime), "h:mm a")}
                          {record.clockOutTime && (
                            <> to {format(new Date(record.clockOutTime), "h:mm a")}</>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={record.checkInMethod === "manual" ? "secondary" : "default"}>
                          {record.checkInMethod}
                        </Badge>
                        {record.clockOutTime && (
                          <p className="text-sm font-medium mt-1">{record.totalHours}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Employees Tab */}
          <TabsContent value="employees" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Employee Management</h2>
              <Dialog open={isAddingEmployee} onOpenChange={setIsAddingEmployee}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Employee
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Employee</DialogTitle>
                    <DialogDescription>
                      Create a new employee account
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={employeeForm.handleSubmit(handleAddEmployee)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">First Name</Label>
                        <Input {...employeeForm.register("firstName")} />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input {...employeeForm.register("lastName")} />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input type="email" {...employeeForm.register("email")} />
                    </div>

                    <div>
                      <Label htmlFor="role">Role</Label>
                      <Select 
                        value={employeeForm.watch("role")} 
                        onValueChange={(value) => employeeForm.setValue("role", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Employee</SelectItem>
                          {user.role === "admin" && (
                            <SelectItem value="manager">Manager</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="password">Password</Label>
                        <Input type="password" {...employeeForm.register("password")} />
                      </div>
                      <div>
                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                        <Input type="password" {...employeeForm.register("confirmPassword")} />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={addEmployeeMutation.isPending}
                      className="w-full"
                    >
                      {addEmployeeMutation.isPending ? "Adding..." : "Add Employee"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="text-lg font-medium">
                    Total Employees: {employees?.length || 0}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {employees?.map((employee: any) => (
                      <div
                        key={employee.id}
                        className="p-4 border rounded-lg space-y-2"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium">
                              {employee.firstName} {employee.lastName}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {employee.email}
                            </p>
                            <p className="text-xs text-gray-500">
                              ID: {employee.id}
                            </p>
                          </div>
                          <Badge variant={employee.role === "manager" ? "secondary" : "default"}>
                            {employee.role}
                          </Badge>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              employee.faceImageUrl ? "bg-green-500" : "bg-yellow-500"
                            }`} />
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {employee.faceImageUrl ? "Face registered" : "No face image"}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              employee.isActive ? "bg-green-500" : "bg-red-500"
                            }`} />
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {employee.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </div>

                        {employee.faceImageUrl && (
                          <div className="mt-2">
                            <img 
                              src={employee.faceImageUrl} 
                              alt="Employee face"
                              className="w-16 h-16 rounded-full object-cover border"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Locations Tab */}
          <TabsContent value="locations" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Location Management</h2>
              {user.role === "admin" && (
                <Dialog open={isAddingLocation} onOpenChange={setIsAddingLocation}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Location
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Location</DialogTitle>
                      <DialogDescription>
                        Add a new work location for check-in restrictions
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddLocation} className="space-y-4">
                      <div>
                        <Label htmlFor="name">Location Name</Label>
                        <Input name="name" placeholder="e.g., Main Office" required />
                      </div>
                      
                      <div>
                        <Label htmlFor="postcode">UK Postcode</Label>
                        <Input name="postcode" placeholder="e.g., SW1A 1AA" required />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="latitude">Latitude (optional)</Label>
                          <Input name="latitude" type="number" step="any" />
                        </div>
                        <div>
                          <Label htmlFor="longitude">Longitude (optional)</Label>
                          <Input name="longitude" type="number" step="any" />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="radiusMeters">Check-in Radius (meters)</Label>
                        <Input name="radiusMeters" type="number" defaultValue="100" />
                      </div>

                      <Button
                        type="submit"
                        disabled={addLocationMutation.isPending}
                        className="w-full"
                      >
                        {addLocationMutation.isPending ? "Adding..." : "Add Location"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {locations?.map((location: any) => (
                    <div
                      key={location.id}
                      className="p-4 border rounded-lg space-y-2"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium">{location.name}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {location.postcode}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {location.radiusMeters}m radius
                        </Badge>
                      </div>
                      {location.latitude && location.longitude && (
                        <p className="text-xs text-gray-500">
                          {parseFloat(location.latitude).toFixed(4)}, {parseFloat(location.longitude).toFixed(4)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Manual Entry Tab */}
          <TabsContent value="manual" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Manual Clock-In</CardTitle>
                <CardDescription>
                  Manually record attendance for employees who had issues with face recognition
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleManualClockIn} className="space-y-4">
                  <div>
                    <Label htmlFor="userId">Employee</Label>
                    <Select name="userId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees?.map((employee: any) => (
                          <SelectItem key={employee.id} value={employee.id.toString()}>
                            {employee.firstName} {employee.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="date">Date</Label>
                      <Input 
                        name="date" 
                        type="date" 
                        defaultValue={format(new Date(), "yyyy-MM-dd")}
                        required 
                      />
                    </div>
                    <div>
                      <Label htmlFor="clockInTime">Clock-in Time</Label>
                      <Input 
                        name="clockInTime" 
                        type="datetime-local" 
                        required 
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="locationId">Location (optional)</Label>
                    <select name="locationId" className="w-full p-2 border rounded">
                      <option value="">Select location</option>
                      {locations?.map((location: any) => (
                        <option key={location.id} value={location.id.toString()}>
                          {location.name} ({location.postcode})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea 
                      name="notes" 
                      placeholder="Reason for manual entry..."
                      rows={3}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={manualClockInMutation.isPending}
                    className="w-full"
                  >
                    {manualClockInMutation.isPending ? "Recording..." : "Record Manual Clock-In"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}