import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PhoneOff, Mic, MicOff, Minimize2, X, Phone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { callService } from "@/services/CallService";
import { toast } from "sonner";

interface CallWindowProps {
  isOpen: boolean;
  contactId: string;
  contactName: string;
  contactAvatar: string | null;
  isIncoming: boolean;
  incomingCallOffer?: RTCSessionDescriptionInit;
  onClose: () => void;
}

const CallWindow: React.FC<CallWindowProps> = ({
  isOpen,
  contactId,
  contactName,
  contactAvatar,
  isIncoming,
  incomingCallOffer,
  onClose
}) => {
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [callState, setCallState] = useState(callService.getState());
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isIncoming && isOpen) {
      callService.startCall(contactId).catch(error => {
        toast.error('Failed to start call: ' + error.message);
        onClose();
      });
    }
  }, [isOpen, isIncoming, contactId, onClose]);

  useEffect(() => {
    const updateState = () => setCallState(callService.getState());
    const events = [
      'call_started',
      'call_accepted',
      'call_ended',
      'state_changed',
      'stream_changed'
    ];

    events.forEach(event => {
      callService.on(event, updateState);
    });

    return () => {
      events.forEach(event => {
        callService.off(event, updateState);
      });
    };
  }, []);

  const answerCall = (accept: boolean) => {
    if (isIncoming && incomingCallOffer) {
      if (accept) {
        callService.answerCall(incomingCallOffer).catch(error => {
          toast.error('Failed to answer call: ' + error.message);
          onClose();
        });
      } else {
        callService.endCall();
        onClose();
      }
    }
  };

  const endCall = () => {
    callService.endCall();
    onClose();
  };

  const toggleMute = () => {
    if (callState.localStream) {
      callState.localStream.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
      toast.info(isMuted ? "Microphone on" : "Microphone off");
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatus = () => {
    if (!callState.isInCall) {
      return isIncoming ? "Incoming call..." : "Calling...";
    }
    
    switch (callState.connectionState) {
      case 'connected': return "In call";
      case 'connecting': return "Connecting...";
      default: return "Call ended";
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        drag
        dragMomentum={false}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ 
          opacity: 1, 
          scale: isMinimized ? 0.7 : 1,
          x: position.x,
          y: position.y
        }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="fixed z-[10000] cursor-move"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)'
        }}
        onDrag={(_, info) => {
          setPosition({ x: info.point.x, y: info.point.y });
        }}
      >
        <Card className={`bg-white shadow-2xl ${isMinimized ? 'w-64' : 'w-96'}`}>
          <div className="flex items-center justify-between p-3 border-b">
            <span className="text-sm font-medium">{getStatus()}</span>
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

          <AnimatePresence>
            {!isMinimized ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-6 text-center">
                  <Avatar className="w-20 h-20 mx-auto mb-4">
                    {contactAvatar ? (
                      <AvatarImage src={contactAvatar} />
                    ) : (
                      <AvatarFallback className="bg-[#33C3F0] text-white">
                        {contactName[0]}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  
                  <h3 className="text-xl font-semibold mb-2">{contactName}</h3>
                  
                  {callState.connectionState === 'connected' && (
                    <p className="text-gray-500 mb-4">
                      {formatDuration(callDuration)}
                    </p>
                  )}

                  <div className="flex justify-center gap-4 mt-6">
                    {isIncoming && !callState.isInCall ? (
                      <>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="rounded-full w-12 h-12"
                          onClick={() => answerCall(false)}
                        >
                          <PhoneOff />
                        </Button>
                        <Button
                          variant="default"
                          size="icon"
                          className="rounded-full w-12 h-12 bg-green-500 hover:bg-green-600"
                          onClick={() => answerCall(true)}
                        >
                          <Phone />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant={isMuted ? "default" : "outline"}
                          size="icon"
                          className="rounded-full w-12 h-12"
                          onClick={toggleMute}
                        >
                          {isMuted ? <MicOff /> : <Mic />}
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="rounded-full w-14 h-14"
                          onClick={endCall}
                        >
                          <PhoneOff />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="p-3 flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  {contactAvatar ? (
                    <AvatarImage src={contactAvatar} />
                  ) : (
                    <AvatarFallback className="bg-[#33C3F0] text-white">
                      {contactName[0]}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium">{contactName}</p>
                  {callState.connectionState === 'connected' && (
                    <p className="text-xs text-gray-500">
                      {formatDuration(callDuration)}
                    </p>
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
          </AnimatePresence>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};

export default CallWindow;
