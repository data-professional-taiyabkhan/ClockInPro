import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminLocationManager } from "@/components/admin-location-manager";
import { 
  Users, 
  Clock, 
  MapPin, 
  Shield,
  TrendingUp,
  Building
} from "lucide-react";
import type { User, AttendanceRecord, Location } from "@shared/schema";

export default function AdminDashboard() {
  const { data: employees = [] } = useQuery({
    queryKey: ["/api/employees"],
  });

  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ["/api/attendance"],
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["/api/locations"],
  });

  const totalEmployees = employees.length;
  const totalLocations = locations.length;
  const todayAttendance = attendanceRecords.filter((record: AttendanceRecord) => 
    record.date === new Date().toISOString().split('T')[0]
  ).length;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Manage system settings and monitor overall performance</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Employees</p>
                <p className="text-2xl font-bold text-gray-900">{totalEmployees}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Locations</p>
                <p className="text-2xl font-bold text-gray-900">{totalLocations}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Building className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Check-ins</p>
                <p className="text-2xl font-bold text-gray-900">{todayAttendance}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">System Status</p>
                <p className="text-2xl font-bold text-green-600">Active</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-full">
                <Shield className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="locations" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="locations" className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Location Management
          </TabsTrigger>
          <TabsTrigger value="employees" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Employee Overview
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="locations">
          <AdminLocationManager />
        </TabsContent>

        <TabsContent value="employees">
          <Card>
            <CardHeader>
              <CardTitle>All Employees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {employees.map((employee: User) => (
                  <div key={employee.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-medium">{employee.firstName} {employee.lastName}</h3>
                      <p className="text-sm text-gray-600">{employee.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={employee.role === 'admin' ? 'default' : employee.role === 'manager' ? 'secondary' : 'outline'}>
                          {employee.role}
                        </Badge>
                        {employee.faceImageUrl && (
                          <Badge variant="outline" className="text-green-600">
                            Face Registered
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
                        Assigned Locations: {
                          employee.assignedLocations ? 
                          (typeof employee.assignedLocations === 'string' ? 
                            JSON.parse(employee.assignedLocations).length : 
                            employee.assignedLocations.length) : 0
                        }
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Attendance Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-600 font-medium">Total Check-ins</p>
                      <p className="text-2xl font-bold text-blue-900">{attendanceRecords.length}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-600 font-medium">Face Verified</p>
                      <p className="text-2xl font-bold text-green-900">
                        {attendanceRecords.filter((r: AttendanceRecord) => r.checkInMethod === 'face').length}
                      </p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="text-sm text-purple-600 font-medium">Unique Employees</p>
                      <p className="text-2xl font-bold text-purple-900">
                        {new Set(attendanceRecords.map((r: AttendanceRecord) => r.userId)).size}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {attendanceRecords.slice(0, 10).map((record: AttendanceRecord) => {
                    const employee = employees.find((e: User) => e.id === record.userId);
                    return (
                      <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">
                            {employee?.firstName} {employee?.lastName}
                          </p>
                          <p className="text-sm text-gray-600">
                            {new Date(record.clockInTime).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant={record.checkInMethod === 'face' ? 'default' : 'outline'}>
                            {record.checkInMethod}
                          </Badge>
                          {record.clockOutTime && (
                            <p className="text-sm text-gray-600 mt-1">
                              Duration: {Math.round((new Date(record.clockOutTime).getTime() - new Date(record.clockInTime).getTime()) / (1000 * 60))} min
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}