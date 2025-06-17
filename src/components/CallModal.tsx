
import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PhoneOff, Phone, Mic, MicOff } from "lucide-react";
import { useCallService, CallState } from "@/services/CallService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CallModalProps {
  isOpen: boolean;
  contactId: string | null;
  contactName: string;
  contactAvatar: string | null;
  isIncoming: boolean;
  onClose: () => void;
  incomingCallOffer?: RTCSessionDescriptionInit;
}

const CallModal: React.FC<CallModalProps> = ({
  isOpen,
  contactId,
  contactName,
  contactAvatar,
  isIncoming,
  onClose,
  incomingCallOffer
}) => {
  const callService = useCallService();
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [callState, setCallState] = useState<CallState>(callService.getState());
  const audioRef = useRef<HTMLAudioElement>(null);
  const durationTimerRef = useRef<number | null>(null);

  // Обновляем состояние звонка
  useEffect(() => {
    const handleCallStarted = (event: Event) => {
      const customEvent = event as CustomEvent<CallState>;
      setCallState(customEvent.detail);
      startCallTimer();
    };
    
    const handleCallEnded = (event: Event) => {
      const customEvent = event as CustomEvent<CallState>;
      setCallState(customEvent.detail);
      stopCallTimer();
      setTimeout(onClose, 1000); // Закрываем модальное окно через 1 секунду
    };
    
    const handleConnectionStateChanged = (event: Event) => {
      const customEvent = event as CustomEvent<CallState>;
      setCallState(customEvent.detail);
    };
    
    // Подписываемся на события
    callService.addEventListener('call_started', handleCallStarted);
    callService.addEventListener('call_accepted', handleCallStarted);
    callService.addEventListener('call_ended', handleCallEnded);
    callService.addEventListener('connection_state_changed', handleConnectionStateChanged);
    
    return () => {
      // Отписываемся от событий
      callService.removeEventListener('call_started', handleCallStarted);
      callService.removeEventListener('call_accepted', handleCallStarted);
      callService.removeEventListener('call_ended', handleCallEnded);
      callService.removeEventListener('connection_state_changed', handleConnectionStateChanged);
    };
  }, [onClose]);

  // Подключаем удаленный аудиопоток
  useEffect(() => {
    if (audioRef.current && callState.remoteStream) {
      audioRef.current.srcObject = callState.remoteStream;
    }
  }, [callState.remoteStream]);
  
  // Инициируем звонок при открытии модального окна
  useEffect(() => {
    if (isOpen && contactId && !isIncoming && !callState.isInCall) {
      initiateCall();
    }
  }, [isOpen, contactId, isIncoming]);
  
  // Очищаем ресурсы при закрытии модального окна
  useEffect(() => {
    return () => {
      if (callState.isInCall) {
        callService.endCall();
      }
      
      if (durationTimerRef.current) {
        stopCallTimer();
      }
    };
  }, []);

  // Инициируем исходящий звонок
  const initiateCall = async () => {
    if (!contactId) return;
    
    try {
      await callService.startCall(contactId);
      toast.success(`Звоним ${contactName}...`);
    } catch (error) {
      console.error('Ошибка инициации звонка:', error);
      toast.error('Не удалось начать звонок');
      onClose();
    }
  };

  // Отвечаем на входящий звонок
  const answerCall = async (accept: boolean) => {
    if (!contactId || !incomingCallOffer) return;
    
    try {
      await callService.answerCall(contactId, incomingCallOffer, accept);
      
      if (accept) {
        toast.success(`Звонок с ${contactName} начат`);
      } else {
        toast.info(`Звонок от ${contactName} отклонен`);
        onClose();
      }
    } catch (error) {
      console.error('Ошибка ответа на звонок:', error);
      toast.error('Ошибка при ответе на звонок');
      onClose();
    }
  };

  // Завершаем звонок
  const endCall = () => {
    callService.endCall();
  };

  // Включаем/выключаем микрофон
  const toggleMute = () => {
    if (callState.localStream) {
      callState.localStream.getAudioTracks().forEach(track => {
        track.enabled = isMuted; // Инвертируем состояние
      });
      
      setIsMuted(!isMuted);
    }
  };

  // Запускаем таймер для отслеживания длительности звонка
  const startCallTimer = () => {
    setCallDuration(0);
    
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
    }
    
    durationTimerRef.current = window.setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const stopCallTimer = () => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getCallStatus = (): string => {
    if (!callState.isInCall) return isIncoming ? "Входящий звонок..." : "Вызов...";
    
    if (callState.connectionState === 'connected') {
      return "Разговор";
    }
    
    if (callState.connectionState === 'connecting' || callState.connectionState === 'new') {
      return "Соединение...";
    }
    
    if (callState.connectionState === 'disconnected' || callState.connectionState === 'failed' || callState.connectionState === 'closed') {
      return "Звонок завершен";
    }
    
    return "Вызов...";
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            {getCallStatus()}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center p-6 space-y-6">
          <Avatar className="w-24 h-24">
            {contactAvatar ? (
              <AvatarImage src={contactAvatar} />
            ) : (
              <AvatarFallback className="bg-[#33C3F0] text-white text-3xl">
                {contactName[0]}
              </AvatarFallback>
            )}
          </Avatar>
          
          <div className="text-center">
            <h3 className="text-xl font-semibold">{contactName}</h3>
            {callState.connectionState === 'connected' && (
              <p className="text-gray-500">{formatDuration(callDuration)}</p>
            )}
          </div>
          
          {/* Скрытый аудио элемент для проигрывания удаленного потока */}
          <audio ref={audioRef} autoPlay />
          
          <div className="flex justify-center gap-4">
            {/* Кнопки для управления звонком */}
            {isIncoming && !callState.isInCall ? (
              <>
                {/* Кнопки для входящего звонка */}
                <Button 
                  variant="destructive" 
                  size="icon"
                  className="rounded-full w-14 h-14"
                  onClick={() => answerCall(false)}
                >
                  <PhoneOff className="h-6 w-6" />
                </Button>
                
                <Button 
                  variant="default" 
                  size="icon"
                  className="rounded-full w-14 h-14 bg-green-500 hover:bg-green-600"
                  onClick={() => answerCall(true)}
                >
                  <Phone className="h-6 w-6" />
                </Button>
              </>
            ) : (
              <>
                {/* Кнопки для активного звонка */}
                <Button 
                  variant={isMuted ? "default" : "outline"} 
                  size="icon"
                  className="rounded-full w-12 h-12"
                  onClick={toggleMute}
                >
                  {isMuted ? (
                    <MicOff className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </Button>
                
                <Button 
                  variant="destructive" 
                  size="icon"
                  className="rounded-full w-14 h-14"
                  onClick={endCall}
                >
                  <PhoneOff className="h-6 w-6" />
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CallModal;
