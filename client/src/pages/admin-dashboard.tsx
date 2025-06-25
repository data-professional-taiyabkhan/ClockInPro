import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, UserPlus, Clock, MapPin, Calendar, Upload, Building2, UserCheck, LogOut, Plus, Edit, Trash2 } from "lucide-react";
import type { User, AttendanceRecord, Location, InsertLocation, EmployeeInvitation, EmployeeLocation } from "@shared/schema";
import { format } from "date-fns";

export default function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);

  const { data: user } = useQuery({
    queryKey: ["/api/user"],
    queryFn: () => apiRequest("/api/user"),
  });

  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ["/api/employees"],
    queryFn: () => apiRequest("/api/employees"),
  });

  const { data: locations = [], isLoading: locationsLoading } = useQuery({
    queryKey: ["/api/locations"],
    queryFn: () => apiRequest("/api/locations"),
  });

  const { data: employeeLocations = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ["/api/employee-locations"],
    queryFn: () => apiRequest("/api/employee-locations"),
  });

  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ["/api/attendance"],
    queryFn: () => apiRequest("/api/attendance"),
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ["/api/invitations"],
    queryFn: () => apiRequest("/api/invitations"),
  });

  const assignLocationMutation = useMutation({
    mutationFn: async ({ userId, locationId }: { userId: number; locationId: number }) => {
      return await apiRequest("/api/employee-locations", {
        method: "POST",
        body: JSON.stringify({ userId, locationId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-locations"] });
      setSelectedEmployeeId(null);
      setSelectedLocationId(null);
      toast({
        title: "Success",
        description: "Employee assigned to location successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeLocationMutation = useMutation({
    mutationFn: async ({ userId, locationId }: { userId: number; locationId: number }) => {
      return await apiRequest(`/api/employee-locations/${userId}/${locationId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-locations"] });
      toast({
        title: "Success",
        description: "Employee removed from location",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createLocationMutation = useMutation({
    mutationFn: async (data: InsertLocation) => {
      return await apiRequest("/api/locations", { method: "POST", body: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      setIsLocationDialogOpen(false);
      setEditingLocation(null);
      toast({
        title: "Success",
        description: "Location created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateLocationMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Location> & { id: number }) => {
      return await apiRequest(`/api/locations/${id}`, { method: "PUT", body: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      setIsLocationDialogOpen(false);
      setEditingLocation(null);
      toast({
        title: "Success",
        description: "Location updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/locations/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({
        title: "Success",
        description: "Location deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/logout", { method: "POST" });
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/";
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const locationData = {
      name: formData.get("name") as string,
      postcode: formData.get("postcode") as string,
      address: formData.get("address") as string,
      latitude: formData.get("latitude") ? parseFloat(formData.get("latitude") as string) : undefined,
      longitude: formData.get("longitude") ? parseFloat(formData.get("longitude") as string) : undefined,
      radiusMeters: parseInt(formData.get("radiusMeters") as string) || 100,
    };

    if (editingLocation) {
      updateLocationMutation.mutate({ id: editingLocation.id, ...locationData });
    } else {
      createLocationMutation.mutate(locationData);
    }
  };

  const openLocationDialog = (location?: Location) => {
    setEditingLocation(location || null);
    setIsLocationDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Welcome back, {user?.firstName} {user?.lastName}
            </p>
            <div className="flex gap-4 mt-2">
              <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {employees.length} Total Employees
              </span>
              <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                {locations.length} Office Locations
              </span>
              <span className="text-sm bg-purple-100 text-purple-800 px-2 py-1 rounded">
                {employeeLocations.length} Location Assignments
              </span>
            </div>
          </div>
          <Button variant="outline" onClick={() => logoutMutation.mutate()}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="assignments" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="assignments">Location Assignments</TabsTrigger>
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
          </TabsList>

          {/* Location Assignments Tab */}
          <TabsContent value="assignments">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Employee Location Assignments
                </CardTitle>
                <CardDescription>
                  Assign employees to office locations where they can check in
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Assignment Form */}
                  <div className="border rounded-lg p-6 bg-gray-50 dark:bg-gray-800">
                    <h3 className="font-medium mb-4 text-lg">Assign Employee to Location</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="employee-select">Select Employee</Label>
                        <Select 
                          value={selectedEmployeeId?.toString() || ""} 
                          onValueChange={(value) => setSelectedEmployeeId(parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose an employee..." />
                          </SelectTrigger>
                          <SelectContent>
                            {employees.filter((emp: User) => emp.role === 'employee').length === 0 ? (
                              <SelectItem value="no-employees" disabled>No employees available</SelectItem>
                            ) : (
                              employees.filter((emp: User) => emp.role === 'employee').map((employee: User) => (
                                <SelectItem key={employee.id} value={employee.id.toString()}>
                                  {employee.firstName} {employee.lastName} ({employee.email})
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="location-select">Select Location</Label>
                        <Select 
                          value={selectedLocationId?.toString() || ""} 
                          onValueChange={(value) => setSelectedLocationId(parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a location..." />
                          </SelectTrigger>
                          <SelectContent>
                            {locations.length === 0 ? (
                              <SelectItem value="no-locations" disabled>No locations available</SelectItem>
                            ) : (
                              locations.map((location: Location) => (
                                <SelectItem key={location.id} value={location.id.toString()}>
                                  {location.name} ({location.postcode})
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-end">
                        <Button 
                          onClick={() => {
                            if (selectedEmployeeId && selectedLocationId) {
                              assignLocationMutation.mutate({ 
                                userId: selectedEmployeeId, 
                                locationId: selectedLocationId 
                              });
                            }
                          }}
                          disabled={!selectedEmployeeId || !selectedLocationId || assignLocationMutation.isPending}
                          className="w-full"
                        >
                          {assignLocationMutation.isPending ? "Assigning..." : "Assign Location"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Current Assignments */}
                  <div>
                    <h3 className="font-medium mb-4 text-lg">Current Location Assignments</h3>
                    {assignmentsLoading ? (
                      <div className="text-center py-8">Loading assignments...</div>
                    ) : employeeLocations.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No location assignments yet. Assign employees to locations above.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Postcode</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {employeeLocations.map((assignment: any) => (
                            <TableRow key={`${assignment.userId}-${assignment.locationId}`}>
                              <TableCell>
                                {assignment.user.firstName} {assignment.user.lastName}
                                <div className="text-sm text-gray-500">{assignment.user.email}</div>
                              </TableCell>
                              <TableCell>{assignment.location.name}</TableCell>
                              <TableCell>{assignment.location.postcode}</TableCell>
                              <TableCell>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    if (confirm(`Remove ${assignment.user.firstName} ${assignment.user.lastName} from ${assignment.location.name}?`)) {
                                      removeLocationMutation.mutate({
                                        userId: assignment.userId,
                                        locationId: assignment.locationId
                                      });
                                    }
                                  }}
                                  disabled={removeLocationMutation.isPending}
                                >
                                  Remove
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Employees Tab */}
          <TabsContent value="employees">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Employee Management
                </CardTitle>
                <CardDescription>
                  View and manage all employees and their information
                </CardDescription>
              </CardHeader>
              <CardContent>
                {employeesLoading ? (
                  <div className="text-center py-8">Loading employees...</div>
                ) : employees.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No employees found. Invite employees using the Invitations tab.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Face Registered</TableHead>
                        <TableHead>Assigned Locations</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((employee: User) => {
                        const assignedLocations = employeeLocations
                          .filter((assignment: any) => assignment.userId === employee.id)
                          .map((assignment: any) => assignment.location);

                        return (
                          <TableRow key={employee.id}>
                            <TableCell className="font-medium">
                              {employee.firstName} {employee.lastName}
                            </TableCell>
                            <TableCell>{employee.email}</TableCell>
                            <TableCell>
                              <Badge variant={employee.role === 'admin' ? 'destructive' : employee.role === 'manager' ? 'default' : 'secondary'}>
                                {employee.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={employee.faceImageUrl ? 'default' : 'secondary'}>
                                {employee.faceImageUrl ? 'Yes' : 'No'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {assignedLocations.length > 0 ? (
                                <div className="space-y-1">
                                  {assignedLocations.map((location: Location) => (
                                    <div key={location.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                      {location.name} ({location.postcode})
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-500 text-sm">None</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm">
                                  <Upload className="h-4 w-4" />
                                  Update Face
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Locations Tab */}
          <TabsContent value="locations">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      Office Locations
                    </CardTitle>
                    <CardDescription>
                      Manage office locations where employees can check in
                    </CardDescription>
                  </div>
                  <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={() => openLocationDialog()} size="lg" className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Add New Location
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>
                          {editingLocation ? "Edit Location" : "Add New Location"}
                        </DialogTitle>
                        <DialogDescription>
                          {editingLocation ? "Update location details" : "Create a new office location"}
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <Label htmlFor="name">Location Name</Label>
                          <Input
                            id="name"
                            name="name"
                            defaultValue={editingLocation?.name || ""}
                            placeholder="Main Office"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="postcode">Postcode</Label>
                          <Input
                            id="postcode"
                            name="postcode"
                            defaultValue={editingLocation?.postcode || ""}
                            placeholder="SW1A 1AA"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="address">Address</Label>
                          <Textarea
                            id="address"
                            name="address"
                            defaultValue={editingLocation?.address || ""}
                            placeholder="Full address of the office"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="latitude">Latitude</Label>
                            <Input
                              id="latitude"
                              name="latitude"
                              type="number"
                              step="any"
                              defaultValue={editingLocation?.latitude || ""}
                              placeholder="51.5074"
                            />
                          </div>
                          <div>
                            <Label htmlFor="longitude">Longitude</Label>
                            <Input
                              id="longitude"
                              name="longitude"
                              type="number"
                              step="any"
                              defaultValue={editingLocation?.longitude || ""}
                              placeholder="-0.1278"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="radiusMeters">Check-in Radius (meters)</Label>
                          <Input
                            id="radiusMeters"
                            name="radiusMeters"
                            type="number"
                            defaultValue={editingLocation?.radiusMeters || 100}
                            placeholder="100"
                            required
                          />
                        </div>
                        <div className="flex justify-end space-x-2 pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setIsLocationDialogOpen(false);
                              setEditingLocation(null);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={createLocationMutation.isPending || updateLocationMutation.isPending}
                            className={editingLocation ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"}
                          >
                            {(createLocationMutation.isPending || updateLocationMutation.isPending) ? 
                              "Processing..." : 
                              editingLocation ? "Update Location" : "Create Location"
                            }
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {locationsLoading ? (
                  <div className="flex justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="min-w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Postcode</TableHead>
                          <TableHead>Address</TableHead>
                          <TableHead>Radius</TableHead>
                          <TableHead>Employees</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right min-w-[120px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {locations.map((location: Location) => {
                          const assignedCount = employeeLocations?.filter(
                            (assignment: any) => assignment.location.id === location.id
                          ).length || 0;
                          
                          return (
                            <TableRow key={location.id}>
                              <TableCell className="font-medium">{location.name}</TableCell>
                              <TableCell>{location.postcode}</TableCell>
                              <TableCell className="max-w-xs truncate">{location.address || '-'}</TableCell>
                              <TableCell>{location.radiusMeters}m</TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {assignedCount} employee(s)
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={location.isActive ? "default" : "secondary"}>
                                  {location.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openLocationDialog(location)}
                                    title="Edit location"
                                  >
                                    <Edit className="h-4 w-4" />
                                    <span className="ml-1 hidden sm:inline">Edit</span>
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                      if (confirm(`Are you sure you want to delete "${location.name}"? This action cannot be undone.`)) {
                                        deleteLocationMutation.mutate(location.id);
                                      }
                                    }}
                                    disabled={deleteLocationMutation.isPending}
                                    title="Delete location"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span className="ml-1 hidden sm:inline">Delete</span>
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Attendance Records
                </CardTitle>
                <CardDescription>
                  View and manage employee attendance records
                </CardDescription>
              </CardHeader>
              <CardContent>
                {attendanceRecords.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No attendance records found.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Clock In</TableHead>
                        <TableHead>Clock Out</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceRecords.slice(0, 20).map((record: AttendanceRecord) => {
                        const employee = employees.find((emp: User) => emp.id === record.userId);
                        return (
                          <TableRow key={record.id}>
                            <TableCell>
                              {employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown'}
                            </TableCell>
                            <TableCell>{record.date}</TableCell>
                            <TableCell>
                              {record.clockInTime ? format(new Date(record.clockInTime), 'HH:mm') : '-'}
                            </TableCell>
                            <TableCell>
                              {record.clockOutTime ? format(new Date(record.clockOutTime), 'HH:mm') : '-'}
                            </TableCell>
                            <TableCell>
                              {record.clockInTime && record.clockOutTime ? 
                                `${Math.round((new Date(record.clockOutTime).getTime() - new Date(record.clockInTime).getTime()) / (1000 * 60 * 60 * 100)) / 100}h` : 
                                '-'
                              }
                            </TableCell>
                            <TableCell>
                              <Badge variant={record.manuallyApprovedBy ? 'default' : 'secondary'}>
                                {record.manuallyApprovedBy ? 'Verified' : 'Pending'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invitations Tab */}
          <TabsContent value="invitations">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  Employee Invitations
                </CardTitle>
                <CardDescription>
                  Send invitations to new employees and managers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="border rounded-lg p-6 bg-gray-50 dark:bg-gray-800">
                    <h3 className="font-medium mb-4 text-lg">Send New Invitation</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Input placeholder="First Name" />
                      <Input placeholder="Last Name" />
                      <Input type="email" placeholder="Email Address" />
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Employee</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="mt-4">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Send Invitation
                    </Button>
                  </div>

                  {invitations.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No pending invitations.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Sent</TableHead>
                          <TableHead>Expires</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invitations.map((invitation: EmployeeInvitation) => (
                          <TableRow key={invitation.id}>
                            <TableCell>{invitation.email}</TableCell>
                            <TableCell>
                              <Badge variant={invitation.role === 'manager' ? 'default' : 'secondary'}>
                                {invitation.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={invitation.used ? 'default' : 'secondary'}>
                                {invitation.used ? 'Used' : 'Pending'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {invitation.createdAt ? format(new Date(invitation.createdAt), 'MMM d, yyyy') : '-'}
                            </TableCell>
                            <TableCell>
                              {format(new Date(invitation.expiresAt), 'MMM d, yyyy')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}