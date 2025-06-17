
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Chat from "./pages/Chat";
import Calls from "./pages/Calls";
import Mail from "./pages/Mail";
import Relaxation from "./pages/Relaxation";
import NotFound from "./pages/NotFound";
import MindMap from "./pages/MindMap";
import AuthWrapper from "./components/AuthWrapper";
import WelcomeAnimation from "./components/WelcomeAnimation";
import CallProvider from "./components/CallProvider";
import { useState, useEffect } from "react";
import PageTransition from "./components/PageTransition";
import { ThemeProvider } from "./components/theme-provider";
import { LanguageProvider } from "./components/language-provider";

const queryClient = new QueryClient();

const AnimatedRoutes = () => {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Auth />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={
          <PageTransition>
            <AuthWrapper><Dashboard /></AuthWrapper>
          </PageTransition>
        } />
        <Route path="/profile" element={
          <PageTransition>
            <AuthWrapper><Profile /></AuthWrapper>
          </PageTransition>
        } />
        <Route path="/chat" element={
          <PageTransition>
            <AuthWrapper><Chat /></AuthWrapper>
          </PageTransition>
        } />
        <Route path="/chat/:contactId" element={
          <PageTransition>
            <AuthWrapper><Chat /></AuthWrapper>
          </PageTransition>
        } />
        <Route path="/calls" element={
          <PageTransition>
            <AuthWrapper><Calls /></AuthWrapper>
          </PageTransition>
        } />
        <Route path="/mail" element={
          <PageTransition>
            <AuthWrapper><Mail /></AuthWrapper>
          </PageTransition>
        } />
        <Route path="/relaxation" element={
          <PageTransition>
            <AuthWrapper><Relaxation /></AuthWrapper>
          </PageTransition>
        } />
        <Route path="/mindmap" element={
          <PageTransition>
            <AuthWrapper><MindMap /></AuthWrapper>
          </PageTransition>
        } />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => {
  const [showWelcome, setShowWelcome] = useState(true);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcome(false);
    }, 2500);
    
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <CallProvider>
              <BrowserRouter>
                {showWelcome ? (
                  <WelcomeAnimation />
                ) : (
                  <AnimatedRoutes />
                )}
              </BrowserRouter>
            </CallProvider>
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
