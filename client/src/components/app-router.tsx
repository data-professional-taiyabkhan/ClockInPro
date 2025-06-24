import { Route, Switch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import LoginPage from "@/pages/login-page";
import EmployeeDashboard from "@/pages/employee-dashboard";
import ManagerDashboard from "@/pages/manager-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import NotFound from "@/pages/not-found";

export function AppRouter() {
  const [showLogin, setShowLogin] = useState(false);
  
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/user"],
    retry: false,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  // Force show login after 3 seconds if still loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading && !user) {
        setShowLogin(true);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [isLoading, user]);

  // Show login if forced, has error, or no user
  if (showLogin || error || (!isLoading && !user)) {
    return (
      <Switch>
        <Route path="/" component={LoginPage} />
        <Route path="/login" component={LoginPage} />
        <Route component={LoginPage} />
      </Switch>
    );
  }

  // Show loading for a brief period
  if (isLoading && !showLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Show authenticated routes
  if (user) {
    return (
      <Switch>
        <Route path="/" component={
          user.role === "admin" ? AdminDashboard :
          user.role === "manager" ? ManagerDashboard : 
          EmployeeDashboard
        } />
        <Route path="/manager" component={() => 
          user.role === "manager" || user.role === "admin" ? ManagerDashboard : 
          () => <div className="p-8 text-center">Access Denied - Manager role required</div>
        } />
        <Route path="/admin" component={() => 
          user.role === "admin" ? AdminDashboard : 
          () => <div className="p-8 text-center">Access Denied - Admin role required</div>
        } />
        <Route component={NotFound} />
      </Switch>
    );
  }

  // Fallback to login
  return <LoginPage />;
}