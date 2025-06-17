import React, { useState, useEffect } from "react";
import { callService } from "@/services/CallService";
import { supabase } from "@/integrations/supabase/client";
import CallWindow from "./CallWindow";

interface CallData {
  contactId: string;
  contactName: string;
  contactAvatar: string | null;
  isIncoming: boolean;
}

const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [callData, setCallData] = useState<CallData | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setCurrentUserId(data.user.id);
        callService.connect(data.user.id).catch(console.error);
      }
    };

    fetchUser();

    return () => {
      callService.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleIncomingCall = (data: { fromUserId: string }) => {
      setCallData({
        contactId: data.fromUserId,
        contactName: `User ${data.fromUserId.slice(0, 5)}`,
        contactAvatar: null,
        isIncoming: true
      });
    };

    callService.on('incoming_call', handleIncomingCall);

    return () => {
      callService.off('incoming_call', handleIncomingCall);
    };
  }, []);

  const startCall = (contact: {
    id: string;
    name: string;
    avatar?: string | null;
  }) => {
    setCallData({
      contactId: contact.id,
      contactName: contact.name,
      contactAvatar: contact.avatar || null,
      isIncoming: false
    });
  };

  const endCall = () => {
    callService.endCall();
    setCallData(null);
  };

  return (
    <>
      {children}
      
      {callData && (
        <CallWindow
          isOpen={true}
          contactId={callData.contactId}
          contactName={callData.contactName}
          contactAvatar={callData.contactAvatar}
          isIncoming={callData.isIncoming}
          onClose={endCall}
        />
      )}
    </>
  );
};

export default CallProvider;
