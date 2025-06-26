import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, TrendingUp, User } from "lucide-react";
import { format } from "date-fns";

interface PersonalAnalytics {
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
    isCurrentlyWorking: boolean;
    currentSessionStart: string | null;
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
    clockInFormatted: string;
    clockOutFormatted: string | null;
    dateFormatted: string;
    notes: string | null;
  }>;
}

export function EmployeeAnalyticsDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState("week");

  const { data: analytics, isLoading } = useQuery<PersonalAnalytics>({
    queryKey: ['/api/analytics/personal', selectedPeriod],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/personal?period=${selectedPeriod}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    }
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

  if (!analytics) {
    return <div>Failed to load analytics</div>;
  }

  const periodLabels = {
    week: "This Week",
    month: "This Month", 
    lastMonth: "Last Month"
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">My Work Hours</h2>
          <p className="text-muted-foreground">
            Track your attendance and working hours
          </p>
        </div>
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
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.summary.totalWholeHours}h {analytics.summary.totalMinutes}m
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.summary.totalSeconds}s precision
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Days Worked</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.totalDays}</div>
            <p className="text-xs text-muted-foreground">
              {format(new Date(analytics.startDate), 'MMM dd')} - {format(new Date(analytics.endDate), 'MMM dd')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average/Day</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.averageHoursPerDay}h</div>
            <p className="text-xs text-muted-foreground">
              Per working day
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.summary.isCurrentlyWorking ? (
                <Badge variant="default" className="text-green-600 bg-green-100">Working</Badge>
              ) : (
                <Badge variant="secondary">Off duty</Badge>
              )}
            </div>
            {analytics.summary.currentSessionStart && (
              <p className="text-xs text-muted-foreground">
                Since {format(new Date(analytics.summary.currentSessionStart), 'HH:mm')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Records */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Time Records</CardTitle>
          <CardDescription>
            Detailed breakdown of your daily attendance for {periodLabels[selectedPeriod as keyof typeof periodLabels]}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.dailyRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No attendance records for this period
              </div>
            ) : (
              analytics.dailyRecords.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center space-x-4">
                    <div>
                      <p className="font-medium">{record.dateFormatted}</p>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <span>In: {record.clockInFormatted}</span>
                        {record.clockOutFormatted && (
                          <>
                            <span>•</span>
                            <span>Out: {record.clockOutFormatted}</span>
                          </>
                        )}
                        {record.isCurrentlyWorking && (
                          <Badge variant="outline" className="text-green-600">
                            Currently Working
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {record.hoursWorked}h {record.minutesWorked}m {record.secondsWorked}s
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {record.totalHours} hours total
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}