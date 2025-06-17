import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PhoneCall, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCallService } from "@/services/CallService";

interface Contact {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string | null;
}

const Calls = () => {
  const [searchParams] = useSearchParams();
  const contactId = searchParams.get("contact");
  const [callStatus, setCallStatus] = useState<"calling" | "connected" | "ended">("calling");
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const navigate = useNavigate();
  const callService = useCallService();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setCurrentUserId(data.user.id);
        callService.connect(data.user.id).catch(error => {
          console.error("Ошибка подключения к звонкам:", error);
          toast.error("Не удалось подключиться к сервису звонков");
        });
      }
    };
    
    fetchCurrentUser();
    
    return () => {
      callService.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleCallStarted = () => {
      setCallStatus("calling");
      toast.info("Вызов начат...");
    };
    
    const handleCallAccepted = () => {
      setCallStatus("connected");
      startCallTimer();
      toast.success("Звонок подключен!");
    };
    
    const handleCallEnded = () => {
      setCallStatus("ended");
      stopCallTimer();
      toast.info("Звонок завершен");
      
      setTimeout(() => {
        navigate("/chat");
      }, 2000);
    };
    
    const handleStreamChanged = () => {
      const state = callService.getState();
      if (audioRef.current && state.remoteStream) {
        audioRef.current.srcObject = state.remoteStream;
        audioRef.current.play().catch(error => {
          console.error("Ошибка воспроизведения аудио:", error);
        });
      }
    };
    
    callService.on('call_started', handleCallStarted);
    callService.on('call_accepted', handleCallAccepted);
    callService.on('call_ended', handleCallEnded);
    callService.on('stream_changed', handleStreamChanged);
    
    return () => {
      callService.off('call_started', handleCallStarted);
      callService.off('call_accepted', handleCallAccepted);
      callService.off('call_ended', handleCallEnded);
      callService.off('stream_changed', handleStreamChanged);
    };
  }, [navigate]);

  useEffect(() => {
    const fetchContact = async () => {
      if (contactId) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, username, email, avatar_url')
            .eq('id', contactId)
            .single();
            
          if (error) throw error;
          
          if (data) {
            setActiveContact({
              id: data.id,
              name: data.full_name || data.username || 'Пользователь',
              email: data.email || '',
              avatar_url: data.avatar_url
            });
            
            if (currentUserId) {
              try {
                await callService.startCall(data.id);
              } catch (error) {
                console.error('Ошибка при звонке:', error);
                toast.error('Не удалось начать звонок');
                setTimeout(() => navigate("/chat"), 2000);
              }
            }
          }
        } catch (error) {
          console.error('Ошибка при получении данных контакта:', error);
          toast.error('Не удалось загрузить информацию о контакте');
          setTimeout(() => navigate("/chat"), 2000);
        }
      }
    };
    
    if (contactId && currentUserId) {
      fetchContact();
    }
  }, [contactId, currentUserId]);

  const startCallTimer = () => {
    setCallDuration(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const stopCallTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleMute = () => {
    const state = callService.getState();
    if (state.localStream) {
      state.localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!state.localStream.getAudioTracks()[0].enabled);
      toast.info(isMuted ? "Микрофон включен" : "Микрофон выключен");
    }
  };

  const endCall = () => {
    callService.endCall();
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="flex items-center justify-between py-4 px-6 border-b">
        <h1 className="text-xl font-bold cursor-pointer" onClick={() => navigate("/dashboard")}>
          <span className="text-black">Task</span>
          <span className="text-[#33C3F0]">Tide</span>
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/chat")}>
            Назад в чаты
          </Button>
          <Avatar className="cursor-pointer" onClick={() => navigate("/profile")}>
            <AvatarFallback className="bg-[#33C3F0] text-white">ПР</AvatarFallback>
          </Avatar>
        </div>
      </header>

      <audio ref={audioRef} autoPlay playsInline />

      <main className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <Card className="w-full max-w-md p-6 text-center">
          {activeContact ? (
            <>
              <div className="flex flex-col items-center">
                <Avatar className="w-24 h-24 mb-4">
                  {activeContact.avatar_url ? (
                    <AvatarImage src={activeContact.avatar_url} />
                  ) : (
                    <AvatarFallback className="text-2xl bg-[#33C3F0] text-white">
                      {activeContact.name[0]}
                    </AvatarFallback>
                  )}
                </Avatar>
                <h2 className="text-2xl font-semibold">{activeContact.name}</h2>
                
                {callStatus === "calling" && (
                  <p className="text-lg mb-6 animate-pulse">Вызов...</p>
                )}
                
                {callStatus === "connected" && (
                  <>
                    <p className="text-lg text-green-600 mb-2">Подключено</p>
                    <p className="text-gray-500 mb-6">
                      {formatDuration(callDuration)}
                    </p>
                  </>
                )}
                
                {callStatus === "ended" && (
                  <p className="text-lg text-gray-600 mb-6">Звонок завершен</p>
                )}

                <div className="flex justify-center gap-4 mt-4">
                  {callStatus !== "ended" && (
                    <>
                      <Button
                        variant={isMuted ? "default" : "outline"}
                        size="icon"
                        className="rounded-full w-12 h-12"
                        onClick={toggleMute}
                      >
                        {isMuted ? <VolumeX className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                      </Button>
                      
                      <Button
                        variant="destructive"
                        size="icon"
                        className="rounded-full w-12 h-12"
                        onClick={endCall}
                      >
                        <PhoneCall className="h-5 w-5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center">
              <PhoneCall className="mx-auto h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-xl font-medium">Контакт не найден</h3>
              <p className="text-gray-500 mt-2">Невозможно найти пользователя для звонка</p>
              <Button 
                className="mt-6 bg-[#33C3F0] hover:bg-[#1EAEDB]"
                onClick={() => navigate("/chat")}
              >
                Вернуться к чатам
              </Button>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};

export default Calls;
