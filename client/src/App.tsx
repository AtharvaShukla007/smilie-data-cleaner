import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import DashboardLayout from "./components/DashboardLayout";
import Upload from "./pages/Upload";
import Review from "./pages/Review";
import Issues from "./pages/Issues";
import Export from "./pages/Export";
import AuditTrail from "./pages/AuditTrail";
import ApiKeys from "./pages/ApiKeys";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/upload">
        <DashboardLayout>
          <Upload />
        </DashboardLayout>
      </Route>
      <Route path="/review">
        <DashboardLayout>
          <Review />
        </DashboardLayout>
      </Route>
      <Route path="/issues">
        <DashboardLayout>
          <Issues />
        </DashboardLayout>
      </Route>
      <Route path="/export">
        <DashboardLayout>
          <Export />
        </DashboardLayout>
      </Route>
      <Route path="/audit">
        <DashboardLayout>
          <AuditTrail />
        </DashboardLayout>
      </Route>
      <Route path="/api-keys">
        <DashboardLayout>
          <ApiKeys />
        </DashboardLayout>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
