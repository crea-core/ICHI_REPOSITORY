import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PhoneOff, Phone, Mic, MicOff } from "lucide-react";
import { callService, CallState } from "@/services/CallService";
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
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [callState, setCallState] = useState<CallState>(callService.getState());
  const audioRef = useRef<HTMLAudioElement>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Update call state when it changes
  useEffect(() => {
    const handleStateChange = (state: CallState) => {
      setCallState(state);
      
      if (state.callStatus === 'active') {
        startCallTimer();
      } else if (state.callStatus === 'ended') {
        stopCallTimer();
        setTimeout(onClose, 1000);
      }
    };

    callService.on('state_changed', handleStateChange);
    return () => {
      callService.off('state_changed', handleStateChange);
    };
  }, [onClose]);

  // Handle remote audio stream
  useEffect(() => {
    if (audioRef.current && callState.remoteStream) {
      audioRef.current.srcObject = callState.remoteStream;
    }
  }, [callState.remoteStream]);

  // Initiate call when modal opens for outgoing calls
  useEffect(() => {
    if (isOpen && contactId && !isIncoming && !callState.isInCall) {
      initiateCall();
    }
  }, [isOpen, contactId, isIncoming, callState.isInCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callState.isInCall) {
        callService.endCall(contactId  undefined);
      }
      stopCallTimer();
    };
  }, [callState.isInCall, contactId]);

  const initiateCall = async () => {
    if (!contactId) return;
    
    try {
      await callService.startCall(contactId);
      toast.success(`Calling ${contactName}...`);
    } catch (error) {
      console.error('Call initiation failed:', error);
      toast.error('Failed to start call');
      onClose();
    }
  };

  const answerCall = async (accept: boolean) => {
    if (!contactId  !incomingCallOffer) return;
    
    try {
      await callService.answerCall(contactId, incomingCallOffer, accept);
      
      if (accept) {
        toast.success(Call with ${contactName} started);
      } else {
        toast.info(Call from ${contactName} declined);
        onClose();
      }
    } catch (error) {
      console.error('Error answering call:', error);
      toast.error('Failed to answer call');
      onClose();
    }
  };

  const endCall = () => {
    callService.endCall(contactId || undefined);
  };

  const toggleMute = () => {
    const newMuteState = callService.toggleMute();
    setIsMuted(newMuteState);
  };

  const startCallTimer = () => {
    setCallDuration(0);
    stopCallTimer();
    durationTimerRef.current = setInterval(() => {
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
    return ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')};
  };
const getCallStatus = (): string => {
    if (!callState.isInCall) return isIncoming ? "Incoming call..." : "Calling...";
    
    switch (callState.connectionState) {
      case 'connected':
        return "In call";
      case 'connecting':
      case 'new':
        return "Connecting...";
      case 'disconnected':
      case 'failed':
      case 'closed':
        return "Call ended";
      default:
        return "Calling...";
    }
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
          
          <audio ref={audioRef} autoPlay playsInline />
          
          <div className="flex justify-center gap-4">
            {isIncoming && !callState.isInCall ? (
              <>
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
