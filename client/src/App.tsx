import { Route, Switch } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import LoginPage from "@/pages/login-page";
import EmployeeDashboard from "@/pages/employee-dashboard";
import ManagerDashboard from "@/pages/manager-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import NotFound from "@/pages/not-found";
import { useQuery } from "@tanstack/react-query";

const queryClient = new QueryClient();

function Router() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/user"],
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Show loading only for a brief moment, then show login if there's an auth error
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If there's an auth error or no user, show login
  const isAuthenticated = user && !error;

  return (
    <Switch>
      {!isAuthenticated ? (
        <>
          <Route path="/" component={LoginPage} />
          <Route path="/login" component={LoginPage} />
          <Route component={LoginPage} />
        </>
      ) : (
        <>
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
        </>
      )}
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;