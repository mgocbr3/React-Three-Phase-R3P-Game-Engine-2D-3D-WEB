import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { PIXLLAND_CONFIG, pixllandClient } from "@/integrations/pixlland/client";
import { ThemeProvider } from "@/components/common/ThemeProvider";
import Index from "./pages/Index";
import PlayPage from "./pages/PlayPage";
import EditorPage from "./pages/EditorPage";
import NotFound from "./pages/NotFound";
import { MenuPreviewPage } from "./pages/MenuPreviewPage";
import { PixllandBridgeInitializer } from "@/components/pixlland/PixllandBridgeInitializer";

const queryClient = new QueryClient();

// Auth initializer component
function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { initialize } = useAuthStore();
  
  // Handle handoff token from Pixlland platform
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const handoffToken = params.get('handoff');
    
    if (handoffToken && PIXLLAND_CONFIG.enabled) {
      console.log('[Auth] Handoff token detected, exchanging for session...');
      
      // Exchange handoff for session
      fetch(`${PIXLLAND_CONFIG.url}/functions/v1/auth-handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'exchange', handoffToken })
      })
      .then(res => res.json())
      .then(data => {
        if (data.accessToken && data.refreshToken) {
          console.log('[Auth] Handoff exchange successful, setting session...');
          pixllandClient.auth.setSession({
            access_token: data.accessToken,
            refresh_token: data.refreshToken
          });
        } else {
          console.error('[Auth] Handoff exchange failed:', data);
        }
      })
      .catch(err => {
        console.error('[Auth] Handoff exchange error:', err);
      });
      
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);
  
  useEffect(() => {
    initialize();
  }, [initialize]);
  
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <AuthInitializer>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <PixllandBridgeInitializer />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/play/:templateId" element={<PlayPage />} />
              <Route path="/editor" element={<EditorPage />} />
              <Route path="/editor/:templateId" element={<EditorPage />} />
              <Route path="/menu-preview" element={<MenuPreviewPage />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthInitializer>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
