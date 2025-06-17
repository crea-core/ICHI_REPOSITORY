import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PhoneOff, Phone, Mic, MicOff } from "lucide-react";
import { callService } from "@/services/CallService";
import { toast } from "sonner";

interface CallModalProps {
  isOpen: boolean;
  contactId: string;
  contactName: string;
  contactAvatar: string | null;
  isIncoming: boolean;
  incomingCallOffer?: RTCSessionDescriptionInit;
  onClose: () => void;
}

const CallModal: React.FC<CallModalProps> = ({
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
  const [callState, setCallState] = useState(callService.getState());

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
        toast.error('Failed to start call');
        onClose();
      });
    }
  }, [isOpen, isIncoming, contactId, onClose]);

  useEffect(() => {
    const updateState = () => setCallState(callService.getState());
    
    callService.on('state_changed', updateState);
    return () => {
      callService.off('state_changed', updateState);
    };
  }, []);

  const answerCall = (accept: boolean) => {
    if (!incomingCallOffer) return;
    
    callService.answerCall(contactId, incomingCallOffer, accept)
      .catch(() => {
        toast.error(accept ? 'Failed to answer call' : 'Failed to reject call');
        onClose();
      });
  };

  const endCall = () => {
    callService.endCall(contactId);
    onClose();
  };

  const toggleMute = () => {
    if (callState.localStream) {
      callState.localStream.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">{getStatus()}</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center p-6 space-y-6">
          <Avatar className="w-24 h-24">
            {contactAvatar ? (
              <AvatarImage src={contactAvatar} />
            ) : (
              <AvatarFallback className="bg-[#33C3F0] text-white">
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
          
          <div className="flex justify-center gap-4">
            {isIncoming && !callState.isInCall ? (
              <>
                <Button
                  variant="destructive"
                  size="icon"
                  className="rounded-full w-14 h-14"
                  onClick={() => answerCall(false)}
                >
                  <PhoneOff />
                </Button>
                <Button
                  variant="default"
                  size="icon"
                  className="rounded-full w-14 h-14 bg-green-500 hover:bg-green-600"
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
      </DialogContent>
    </Dialog>
  );
};

export default CallModal;
