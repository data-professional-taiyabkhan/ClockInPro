import { Route, Switch } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import LoginPage from "@/pages/login-page";
import EmployeeDashboard from "@/pages/employee-dashboard";
import ManagerDashboard from "@/pages/manager-dashboard";
import NotFound from "@/pages/not-found";
import { useQuery } from "@tanstack/react-query";

const queryClient = new QueryClient();

function Router() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/user"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <Switch>
      {!user ? (
        <>
          <Route path="/" component={LoginPage} />
          <Route path="/login" component={LoginPage} />
        </>
      ) : (
        <>
          <Route path="/" component={user.role === "employee" ? EmployeeDashboard : ManagerDashboard} />
        </>
      )}
      <Route component={NotFound} />
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