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
          <Route path="/" component={
            user.role === "admin" ? () => <div>Admin Dashboard - <a href="/admin" className="text-blue-600 underline">Go to Admin Panel</a></div> :
            user.role === "manager" ? ManagerDashboard : 
            EmployeeDashboard
          } />
          <Route path="/admin" component={() => user.role === "admin" ? (() => {
            const AdminDashboard = require("@/pages/admin-dashboard").default;
            return <AdminDashboard />;
          })() : <div>Access Denied</div>} />
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