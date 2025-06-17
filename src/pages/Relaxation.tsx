
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/components/theme-provider";
import { ModeToggle } from "@/components/mode-toggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslation } from "@/components/language-provider";
import { useUserStatus } from "@/hooks/useUserStatus";

// YouTube livestream IDs
const LIVESTREAMS = [
  "jfKfPfyJRdk", // Lofi Girl
  "5yx6BWlEVcY", // Chillhop
  "4xDzrJKXOOY"  // The Jazz Hop Café
];

const Relaxation = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentStream, setCurrentStream] = useState(LIVESTREAMS[0]);
  
  // Apply dark theme in relaxation mode
  useEffect(() => {
    // Remember original theme
    const originalTheme = theme;
    // Force dark theme when entering relaxation mode
    setTheme("dark");
    
    // Update document title
    const originalTitle = document.title;
    document.title = `${t('quietude')} | ICHI`;
    
    return () => {
      // Restore original theme when leaving
      setTheme(originalTheme);
      // Restore original title
      document.title = originalTitle;
    };
  }, [setTheme, t]);
  
  // Randomize stream on component mount
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * LIVESTREAMS.length);
    setCurrentStream(LIVESTREAMS[randomIndex]);
  }, []);
  
  // Fetch current user for status tracking
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setCurrentUserId(data.user.id);
      }
    };
    
    fetchCurrentUser();
  }, []);
  
  // Track user status - set to 'do not disturb' in relaxation mode
  useUserStatus(currentUserId, true);
  
  // Automatically pause when tab/window loses focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPlaying(false);
      } else {
        setIsPlaying(true);
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="flex items-center justify-between py-4 px-6 border-b border-border">
        <h1 className="text-xl font-bold cursor-pointer" onClick={() => navigate("/dashboard")}>
          <span className="text-foreground">IC</span>
          <span className="text-[#33C3F0]">HI</span>
        </h1>
        <div className="flex gap-2">
          <LanguageSwitcher />
          <ModeToggle />
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            {t('back_to_dashboard')}
          </Button>
          <Avatar className="cursor-pointer" onClick={() => navigate("/profile")}>
            <AvatarFallback className="bg-[#33C3F0] text-foreground">ПР</AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-4xl w-full">
          <h2 className="text-2xl font-bold mb-6 text-center">{t('quietude')}</h2>
          
          <div className="aspect-video w-full bg-black mb-6 rounded-lg overflow-hidden">
            {isPlaying ? (
              <iframe 
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${currentStream}?autoplay=1&mute=0&controls=0`}
                title="Relaxation Radio"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-black text-white">
                <p>{t('playback_paused')}</p>
              </div>
            )}
          </div>
          
          <div className="text-center">
            <Button 
              className="bg-[#33C3F0] hover:bg-[#1EAEDB]" 
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? t('pause') : t('resume')}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Relaxation;
