import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MessageCircle, Phone, PhoneCall, Bell, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCallService, CallState } from "@/services/CallService";

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
  const [callState, setCallState] = useState<CallState>(callService.getState());
  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<number | null>(null);

  // Получаем текущего пользователя
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setCurrentUserId(data.user.id);
      }
    };
    
    fetchCurrentUser();
  }, []);

  // Обновляем состояние звонка
  useEffect(() => {
    const handleCallStarted = (state: CallState) => {
      setCallState(state);
      setCallStatus("calling");
    };
    
    const handleCallAccepted = (state: CallState) => {
      setCallState(state);
      setCallStatus("connected");
      startCallTimer();
      toast.success("Звонок подключен");
    };
    
    const handleCallEnded = (state: CallState) => {
      setCallState(state);
      setCallStatus("ended");
      stopCallTimer();
      toast.info("Звонок завершен");
      
      // Перенаправляем на страницу чата после звонка
      setTimeout(() => {
        navigate("/chat");
      }, 2000);
    };
    
    // Подписываемся на события
    callService.addEventListener('call_started', handleCallStarted);
    callService.addEventListener('call_accepted', handleCallAccepted);
    callService.addEventListener('call_ended', handleCallEnded);
    
    return () => {
      // Отписываемся от событий
      callService.removeEventListener('call_started', handleCallStarted);
      callService.removeEventListener('call_accepted', handleCallAccepted);
      callService.removeEventListener('call_ended', handleCallEnded);
    };
  }, [navigate]);

  // Находим контакт по ID из URL
  useEffect(() => {
    const fetchContact = async () => {
      if (contactId) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, username, email, avatar_url')
            .eq('id', contactId)
            .single();
            
          if (error) {
            throw error;
          }
          
          if (data) {
            setActiveContact({
              id: data.id,
              name: data.full_name || data.username || 'Пользователь',
              email: data.email || '',
              avatar_url: data.avatar_url
            });
            
            // Начинаем звонок, если найден контакт
            if (currentUserId && !callService.getState().isInCall) {
              callService.startCall(data.id).catch(error => {
                console.error('Ошибка при звонке:', error);
                toast.error('Не удалось начать звонок');
              });
            }
          }
        } catch (error) {
          console.error('Ошибка при получении данных контакта:', error);
          toast.error('Не удалось загрузить информацию о контакте');
        }
      }
    };
    
    if (contactId && currentUserId) {
      fetchContact();
    }
  }, [contactId, currentUserId]);

  // Подключаем удаленный аудиопоток
  useEffect(() => {
    if (audioRef.current && callState.remoteStream) {
      audioRef.current.srcObject = callState.remoteStream;
    }
  }, [callState.remoteStream]);

  // Запускаем таймер для отслеживания длительности звонка
  const startCallTimer = () => {
    setCallDuration(0);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    timerRef.current = window.setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  // Останавливаем таймер
  const stopCallTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Форматируем длительность звонка
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Включение/выключение микрофона
  const toggleMute = () => {
    if (callState.localStream) {
      callState.localStream.getAudioTracks().forEach(track => {
        track.enabled = isMuted; // Инвертируем текущее состояние
      });
      
      setIsMuted(!isMuted);
    }
  };

  // Завершение звонка
  const endCall = () => {
    callService.endCall();
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Navbar */}
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

      {/* Скрытый аудио элемент для проигрывания удаленного потока */}
      <audio ref={audioRef} autoPlay />

      {/* Интерфейс звонка */}
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
                {activeContact.email && <p className="text-gray-500 mb-6">{activeContact.email}</p>}
                
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
                        <VolumeX className="h-5 w-5" />
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-full w-12 h-12"
                      >
                        <MessageCircle className="h-5 w-5" />
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
              
              {/* Техническая информация о WebRTC */}
              <div className="mt-12 text-sm text-left p-4 bg-gray-100 rounded-lg">
                <h3 className="font-medium mb-2">Техническая информация:</h3>
                <p>
                  Реализованы голосовые звонки с использованием WebRTC и WebSockets через Supabase Edge Functions.
                  WebRTC позволяет установить прямое peer-to-peer соединение между браузерами для передачи аудио.
                </p>
                <p className="mt-2">
                  Процесс включает:
                </p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>Установление WebSocket-соединения через Supabase Edge Function</li>
                  <li>Обмен SDP-предложениями через сигнальный сервер</li>
                  <li>Установление прямого соединения между браузерами с помощью ICE-кандидатов</li>
                  <li>Передачу аудиопотоков с использованием getUserMedia API</li>
                </ul>
              </div>
            </>
          ) : (
            <div className="text-center">
              <Phone className="mx-auto h-16 w-16 text-gray-300 mb-4" />
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
