
import React, { useState, useEffect } from "react";
import IncomingCallNotification from "./IncomingCallNotification";
import CallWindow from "./CallWindow";
import { useCallService } from "@/services/CallService";
import { supabase } from "@/integrations/supabase/client";

interface CallWindowData {
  contactId: string;
  contactName: string;
  contactAvatar: string | null;
  isIncoming: boolean;
}

const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [callWindow, setCallWindow] = useState<CallWindowData | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const callService = useCallService();

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setCurrentUserId(data.user.id);
      }
    };
    
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      callService.connect(currentUserId).catch(error => {
        console.error('Ошибка подключения к сервису звонков:', error);
      });
    }
    
    return () => {
      callService.disconnect();
    };
  }, [currentUserId]);

  useEffect(() => {
    const handleOpenCallModal = (event: CustomEvent) => {
      const { contactId, contactName, contactAvatar, isIncoming } = event.detail;
      setCallWindow({
        contactId,
        contactName,
        contactAvatar,
        isIncoming
      });
    };

    document.addEventListener('openCallModal', handleOpenCallModal as EventListener);
    
    return () => {
      document.removeEventListener('openCallModal', handleOpenCallModal as EventListener);
    };
  }, []);

  const closeCallWindow = () => {
    setCallWindow(null);
  };

  return (
    <>
      {children}
      <IncomingCallNotification />
      {callWindow && (
        <CallWindow
          isOpen={true}
          contactId={callWindow.contactId}
          contactName={callWindow.contactName}
          contactAvatar={callWindow.contactAvatar}
          isIncoming={callWindow.isIncoming}
          onClose={closeCallWindow}
        />
      )}
    </>
  );
};

export default CallProvider;
