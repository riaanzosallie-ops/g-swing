import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import GswingCourseMapperPage from "./pages/GswingCourseMapper.tsx";
import AuthPage from "./pages/Auth.tsx";
import GswingMembershipAdminPage from "./pages/GswingMembershipAdmin.tsx";
import GolfApiSettingsPage from "./pages/GolfApiSettings.tsx";
import GswingRenderingStudioPage from "./pages/GswingRenderingStudio.tsx";
import Courses from "./pages/Courses.tsx";
import CourseDetail from "./pages/CourseDetail.tsx";
import { AppErrorBoundary } from "./components/gswing/AppErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route
            path="/gswing/course-mapper"
            element={
              <AppErrorBoundary label="Course Mapper">
                <GswingCourseMapperPage />
              </AppErrorBoundary>
            }
          />
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/courses"
            element={
              <AppErrorBoundary label="Courses">
                <Courses />
              </AppErrorBoundary>
            }
          />
          <Route
            path="/courses/:giCourseId"
            element={
              <AppErrorBoundary label="Course Detail">
                <CourseDetail />
              </AppErrorBoundary>
            }
          />
          <Route path="/gswing/membership-admin" element={<GswingMembershipAdminPage />} />
          <Route
            path="/gswing/rendering-studio"
            element={
              <AppErrorBoundary label="Rendering Studio">
                <GswingRenderingStudioPage />
              </AppErrorBoundary>
            }
          />
          <Route
            path="/gswing/golf-api"
            element={
              <AppErrorBoundary label="Golf API">
                <GolfApiSettingsPage />
              </AppErrorBoundary>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
