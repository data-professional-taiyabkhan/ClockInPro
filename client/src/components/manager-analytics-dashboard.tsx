import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Clock, Users, TrendingUp, Eye } from "lucide-react";
import { format } from "date-fns";

interface EmployeeAnalytics {
  id: number;
  name: string;
  email: string;
  thisWeekHours: number;
  thisMonthHours: number;
  todayHours: number;
  isCurrentlyWorking: boolean;
  totalRecords: number;
  lastClockIn: string | null;
}

interface EmployeeDetail {
  employee: {
    id: number;
    name: string;
    email: string;
  };
  period: string;
  startDate: string;
  endDate: string;
  summary: {
    totalHours: number;
    totalWholeHours: number;
    totalMinutes: number;
    totalSeconds: number;
    totalDays: number;
    averageHoursPerDay: number;
  };
  dailyRecords: Array<{
    id: number;
    date: string;
    clockInTime: string;
    clockOutTime: string | null;
    hoursWorked: number;
    minutesWorked: number;
    secondsWorked: number;
    totalHours: number;
    isCurrentlyWorking: boolean;
    notes: string | null;
  }>;
}

export function ManagerAnalyticsDashboard() {
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState("week");

  const { data: employeeAnalytics, isLoading } = useQuery<EmployeeAnalytics[]>({
    queryKey: ['/api/analytics/employees'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/employees');
      if (!response.ok) throw new Error('Failed to fetch employee analytics');
      return response.json();
    }
  });

  const { data: employeeDetail } = useQuery<EmployeeDetail>({
    queryKey: ['/api/analytics/employee', selectedEmployee, selectedPeriod],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/employee/${selectedEmployee}?period=${selectedPeriod}`);
      if (!response.ok) throw new Error('Failed to fetch employee details');
      return response.json();
    },
    enabled: !!selectedEmployee
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!employeeAnalytics) {
    return <div>Failed to load employee analytics</div>;
  }

  // Calculate totals
  const totalEmployees = employeeAnalytics.length;
  const currentlyWorking = employeeAnalytics.filter(emp => emp.isCurrentlyWorking).length;
  const totalWeekHours = employeeAnalytics.reduce((sum, emp) => sum + emp.thisWeekHours, 0);
  const totalMonthHours = employeeAnalytics.reduce((sum, emp) => sum + emp.thisMonthHours, 0);

  const periodLabels = {
    week: "This Week",
    month: "This Month", 
    lastMonth: "Last Month"
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Team Analytics</h2>
        <p className="text-muted-foreground">
          Monitor employee attendance and working hours across your team
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEmployees}</div>
            <p className="text-xs text-muted-foreground">
              Active team members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Currently Working</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentlyWorking}</div>
            <p className="text-xs text-muted-foreground">
              {currentlyWorking === 0 ? "All offline" : `${totalEmployees - currentlyWorking} offline`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(totalWeekHours)}h</div>
            <p className="text-xs text-muted-foreground">
              Total team hours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(totalMonthHours)}h</div>
            <p className="text-xs text-muted-foreground">
              Total team hours
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Employee List */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Time Tracking</CardTitle>
          <CardDescription>
            Click on any employee to view detailed time records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {employeeAnalytics.map((employee) => (
              <div
                key={employee.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div>
                    <p className="font-medium">{employee.name}</p>
                    <p className="text-sm text-muted-foreground">{employee.email}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      {employee.isCurrentlyWorking ? (
                        <Badge variant="default" className="text-green-600 bg-green-100">
                          Working
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Offline</Badge>
                      )}
                      {employee.lastClockIn && (
                        <span className="text-xs text-muted-foreground">
                          Last: {format(new Date(employee.lastClockIn), 'HH:mm')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-6">
                  <div className="text-right">
                    <p className="font-medium">Today: {employee.todayHours.toFixed(1)}h</p>
                    <p className="text-sm text-muted-foreground">
                      Week: {employee.thisWeekHours.toFixed(1)}h | Month: {employee.thisMonthHours.toFixed(1)}h
                    </p>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedEmployee(employee.id)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{employee.name} - Time Records</DialogTitle>
                        <DialogDescription>
                          Detailed attendance and working hours breakdown
                        </DialogDescription>
                      </DialogHeader>
                      
                      {selectedEmployee === employee.id && (
                        <div className="space-y-4">
                          {/* Period Selector */}
                          <div className="flex space-x-2">
                            {Object.entries(periodLabels).map(([period, label]) => (
                              <Button
                                key={period}
                                variant={selectedPeriod === period ? "default" : "outline"}
                                onClick={() => setSelectedPeriod(period)}
                                size="sm"
                              >
                                {label}
                              </Button>
                            ))}
                          </div>

                          {employeeDetail && (
                            <>
                              {/* Summary */}
                              <div className="grid gap-4 md:grid-cols-3">
                                <Card>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Total Hours</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="text-xl font-bold">
                                      {employeeDetail.summary.totalWholeHours}h {employeeDetail.summary.totalMinutes}m
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {employeeDetail.summary.totalSeconds}s precision
                                    </p>
                                  </CardContent>
                                </Card>

                                <Card>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Days Worked</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="text-xl font-bold">{employeeDetail.summary.totalDays}</div>
                                    <p className="text-xs text-muted-foreground">
                                      {format(new Date(employeeDetail.startDate), 'MMM dd')} - {format(new Date(employeeDetail.endDate), 'MMM dd')}
                                    </p>
                                  </CardContent>
                                </Card>

                                <Card>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Average/Day</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="text-xl font-bold">{employeeDetail.summary.averageHoursPerDay}h</div>
                                    <p className="text-xs text-muted-foreground">
                                      Per working day
                                    </p>
                                  </CardContent>
                                </Card>
                              </div>

                              {/* Daily Records */}
                              <div className="space-y-2">
                                <h4 className="font-medium">Daily Records</h4>
                                {employeeDetail.dailyRecords.length === 0 ? (
                                  <p className="text-center py-4 text-muted-foreground">
                                    No records for this period
                                  </p>
                                ) : (
                                  employeeDetail.dailyRecords.map((record) => (
                                    <div
                                      key={record.id}
                                      className="flex items-center justify-between p-3 rounded border bg-card"
                                    >
                                      <div>
                                        <p className="font-medium">{format(new Date(record.date), 'MMM dd, yyyy')}</p>
                                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                          <span>In: {format(new Date(record.clockInTime), 'HH:mm:ss')}</span>
                                          {record.clockOutTime && (
                                            <>
                                              <span>•</span>
                                              <span>Out: {format(new Date(record.clockOutTime), 'HH:mm:ss')}</span>
                                            </>
                                          )}
                                          {record.isCurrentlyWorking && (
                                            <Badge variant="outline" className="text-green-600">
                                              Currently Working
                                            </Badge>
                                          )}
                                        </div>
                                        {record.notes && (
                                          <p className="text-xs text-muted-foreground mt-1">
                                            Note: {record.notes}
                                          </p>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <p className="font-medium">
                                          {record.hoursWorked}h {record.minutesWorked}m {record.secondsWorked}s
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                          {record.totalHours} hours
                                        </p>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}