
import React, { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PhoneOff, Mic, MicOff, Minimize2, X } from "lucide-react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { useCallService, CallState } from "@/services/CallService";
import { toast } from "sonner";

interface CallWindowProps {
  isOpen: boolean;
  contactId: string;
  contactName: string;
  contactAvatar: string | null;
  isIncoming: boolean;
  onClose: () => void;
}

const CallWindow: React.FC<CallWindowProps> = ({
  isOpen,
  contactId,
  contactName,
  contactAvatar,
  isIncoming,
  onClose
}) => {
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [callState, setCallState] = useState<CallState>();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [hasStartedCall, setHasStartedCall] = useState(false);
  
  const callService = useCallService();
  const audioRef = useRef<HTMLAudioElement>(null);
  const durationTimerRef = useRef<number | null>(null);
  const dragControls = useDragControls();

  useEffect(() => {
    const currentState = callService.getState();
    setCallState(currentState);
    console.log('CallWindow mounted, current state:', currentState);
    
    const handleCallStarted = (event: Event) => {
      const customEvent = event as CustomEvent<CallState>;
      console.log('Call started event:', customEvent.detail);
      setCallState(customEvent.detail);
      toast.info("Звонок инициирован...");
    };
    
    const handleCallConnected = (event: Event) => {
      const customEvent = event as CustomEvent<CallState>;
      console.log('Call connected event:', customEvent.detail);
      setCallState(customEvent.detail);
      startCallTimer();
      toast.success("Звонок подключен!");
    };
    
    const handleCallAccepted = (event: Event) => {
      const customEvent = event as CustomEvent<CallState>;
      console.log('Call accepted event:', customEvent.detail);
      setCallState(customEvent.detail);
      toast.success("Звонок принят");
    };
    
    const handleCallEnded = (event: Event) => {
      const customEvent = event as CustomEvent<CallState>;
      console.log('Call ended event:', customEvent.detail);
      setCallState(customEvent.detail);
      stopCallTimer();
      toast.info("Звонок завершен");
      setTimeout(() => {
        onClose();
        setHasStartedCall(false);
      }, 1000);
    };
    
    const handleCallRejected = (event: Event) => {
      console.log('Call rejected event');
      toast.error("Звонок отклонен");
      setTimeout(() => {
        onClose();
        setHasStartedCall(false);
      }, 1000);
    };
    
    const handleCallFailed = (event: Event) => {
      const customEvent = event as CustomEvent<{message: string}>;
      console.log('Call failed event:', customEvent.detail);
      toast.error(`Ошибка звонка: ${customEvent.detail.message}`);
      setTimeout(() => {
        onClose();
        setHasStartedCall(false);
      }, 1000);
    };
    
    const handleConnectionStateChanged = (event: Event) => {
      const customEvent = event as CustomEvent<CallState>;
      console.log('Connection state changed:', customEvent.detail);
      setCallState(customEvent.detail);
    };
    
    callService.addEventListener('call_started', handleCallStarted);
    callService.addEventListener('call_connected', handleCallConnected);
    callService.addEventListener('call_accepted', handleCallAccepted);
    callService.addEventListener('call_ended', handleCallEnded);
    callService.addEventListener('call_rejected', handleCallRejected);
    callService.addEventListener('call_failed', handleCallFailed);
    callService.addEventListener('connection_state_changed', handleConnectionStateChanged);
    
    return () => {
      callService.removeEventListener('call_started', handleCallStarted);
      callService.removeEventListener('call_connected', handleCallConnected);
      callService.removeEventListener('call_accepted', handleCallAccepted);
      callService.removeEventListener('call_ended', handleCallEnded);
      callService.removeEventListener('call_rejected', handleCallRejected);
      callService.removeEventListener('call_failed', handleCallFailed);
      callService.removeEventListener('connection_state_changed', handleConnectionStateChanged);
    };
  }, [onClose]);

  useEffect(() => {
    if (audioRef.current && callState?.remoteStream) {
      console.log('Setting remote stream to audio element');
      audioRef.current.srcObject = callState.remoteStream;
      audioRef.current.play().catch(error => {
        console.error('Error playing remote audio:', error);
      });
    }
  }, [callState?.remoteStream]);

  useEffect(() => {
    if (isOpen && !isIncoming && contactId && !hasStartedCall) {
      console.log('Initiating outgoing call to:', contactId);
      setHasStartedCall(true);
      initiateCall();
    }
  }, [isOpen, contactId, isIncoming, hasStartedCall]);

  const initiateCall = async () => {
    try {
      console.log('Starting call to:', contactId);
      await callService.startCall(contactId);
      console.log('Call started successfully');
    } catch (error) {
      console.error('Ошибка инициации звонка:', error);
      toast.error('Не удалось начать звонок: ' + (error as Error).message);
      setTimeout(() => {
        onClose();
        setHasStartedCall(false);
      }, 2000);
    }
  };

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

  const toggleMute = () => {
    if (callState?.localStream) {
      callState.localStream.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
      toast.info(isMuted ? "Микрофон включен" : "Микрофон выключен");
    }
  };

  const endCall = () => {
    console.log('Ending call with:', contactId);
    callService.endCall(contactId);
    setHasStartedCall(false);
  };

  const getCallStatus = (): string => {
    if (!callState) return isIncoming ? "Входящий звонок..." : "Подключение...";
    
    if (!callState.isInCall) {
      return isIncoming ? "Входящий звонок..." : "Вызов...";
    }
    
    if (callState.connectionState === 'connected') {
      return "В разговоре";
    }
    
    if (callState.connectionState === 'connecting' || callState.connectionState === 'new') {
      return "Соединение...";
    }
    
    return "Звонок завершен";
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        drag
        dragControls={dragControls}
        dragMomentum={false}
        dragElastic={0}
        onDrag={(event, info) => {
          setPosition({ x: info.offset.x, y: info.offset.y });
        }}
        initial={{ 
          opacity: 0, 
          scale: 0.8,
          x: window.innerWidth / 2 - 200,
          y: window.innerHeight / 2 - 150
        }}
        animate={{ 
          opacity: 1, 
          scale: isMinimized ? 0.7 : 1,
          x: position.x + (window.innerWidth / 2 - 200),
          y: position.y + (window.innerHeight / 2 - 150)
        }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="fixed z-[10000] cursor-move"
        style={{
          left: 0,
          top: 0
        }}
      >
        <Card className={`bg-white shadow-2xl border-2 border-gray-200 ${isMinimized ? 'w-64' : 'w-96'} transition-all duration-300`}>
          {/* Заголовок с кнопками управления */}
          <div 
            className="flex items-center justify-between p-3 bg-gray-50 border-b cursor-move"
            onPointerDown={(e) => dragControls.start(e)}
          >
            <span className="text-sm font-medium text-gray-600">
              {getCallStatus()}
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                <Minimize2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onClose}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Содержимое звонка */}
          <AnimatePresence>
            {!isMinimized && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="p-6 text-center">
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ 
                      repeat: callState?.connectionState !== 'connected' ? Infinity : 0, 
                      duration: 2 
                    }}
                  >
                    <Avatar className="w-20 h-20 mx-auto mb-4">
                      {contactAvatar ? (
                        <AvatarImage src={contactAvatar} />
                      ) : (
                        <AvatarFallback className="bg-[#33C3F0] text-white text-2xl">
                          {contactName[0]}
                        </AvatarFallback>
                      )}
                    </Avatar>
                  </motion.div>
                  
                  <h3 className="text-xl font-semibold mb-2">{contactName}</h3>
                  
                  {callState?.connectionState === 'connected' && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-gray-500 mb-4"
                    >
                      {formatDuration(callDuration)}
                    </motion.p>
                  )}

                  {/* Кнопки управления */}
                  <div className="flex justify-center gap-4 mt-6">
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
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
                    </motion.div>
                    
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="rounded-full w-14 h-14"
                        onClick={endCall}
                      >
                        <PhoneOff className="h-6 w-6" />
                      </Button>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Свернутый вид */}
          {isMinimized && (
            <div className="p-3 flex items-center gap-3">
              <Avatar className="w-8 h-8">
                {contactAvatar ? (
                  <AvatarImage src={contactAvatar} />
                ) : (
                  <AvatarFallback className="bg-[#33C3F0] text-white text-sm">
                    {contactName[0]}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-medium">{contactName}</p>
                {callState?.connectionState === 'connected' && (
                  <p className="text-xs text-gray-500">{formatDuration(callDuration)}</p>
                )}
              </div>
              <Button
                variant="destructive"
                size="icon"
                className="rounded-full w-8 h-8"
                onClick={endCall}
              >
                <PhoneOff className="h-3 w-3" />
              </Button>
            </div>
          )}
        </Card>
        
        {/* Скрытый аудио элемент */}
        <audio ref={audioRef} autoPlay playsInline />
      </motion.div>
    </AnimatePresence>
  );
};

export default CallWindow;
