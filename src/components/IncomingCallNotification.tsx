
import React, { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Phone, PhoneOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useCallService } from "@/services/CallService";

interface IncomingCallData {
  fromUserId: string;
  offer: RTCSessionDescriptionInit;
}

interface CallerProfile {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
}

const IncomingCallNotification: React.FC = () => {
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [callerProfile, setCallerProfile] = useState<CallerProfile | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const callService = useCallService();

  useEffect(() => {
    // Слушаем событие входящего звонка
    const handleIncomingCall = (event: CustomEvent) => {
      const { fromUserId, offer } = event.detail;
      setIncomingCall({ fromUserId, offer });
      fetchCallerProfile(fromUserId);
      setIsVisible(true);
    };

    document.addEventListener('incomingCall', handleIncomingCall as EventListener);
    
    return () => {
      document.removeEventListener('incomingCall', handleIncomingCall as EventListener);
    };
  }, []);

  const fetchCallerProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .eq('id', userId)
        .single();
        
      if (error) throw error;
      setCallerProfile(data);
    } catch (error) {
      console.error('Ошибка загрузки профиля звонящего:', error);
    }
  };

  const acceptCall = async () => {
    if (!incomingCall || !callerProfile) return;
    
    try {
      await callService.answerCall(incomingCall.fromUserId, incomingCall.offer, true);
      
      // Открываем окно звонка
      document.dispatchEvent(new CustomEvent('openCallModal', {
        detail: {
          contactId: callerProfile.id,
          contactName: callerProfile.full_name || callerProfile.username,
          contactAvatar: callerProfile.avatar_url,
          isIncoming: true
        }
      }));
      
      closeNotification();
    } catch (error) {
      console.error('Ошибка принятия звонка:', error);
    }
  };

  const rejectCall = async () => {
    if (!incomingCall) return;
    
    try {
      await callService.answerCall(incomingCall.fromUserId, incomingCall.offer, false);
      closeNotification();
    } catch (error) {
      console.error('Ошибка отклонения звонка:', error);
    }
  };

  const closeNotification = () => {
    setIsVisible(false);
    setTimeout(() => {
      setIncomingCall(null);
      setCallerProfile(null);
    }, 300);
  };

  if (!incomingCall || !callerProfile) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -100, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -100, scale: 0.8 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="fixed top-4 right-4 z-[9999]"
        >
          <Card className="p-4 shadow-2xl border-2 border-blue-200 bg-white min-w-[300px]">
            <div className="flex items-center gap-3 mb-4">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <Avatar className="w-12 h-12">
                  {callerProfile.avatar_url ? (
                    <AvatarImage src={callerProfile.avatar_url} />
                  ) : (
                    <AvatarFallback className="bg-[#33C3F0] text-white">
                      {(callerProfile.full_name || callerProfile.username)[0]}
                    </AvatarFallback>
                  )}
                </Avatar>
              </motion.div>
              
              <div className="flex-1">
                <h3 className="font-semibold text-lg">
                  {callerProfile.full_name || callerProfile.username}
                </h3>
                <p className="text-sm text-gray-600 animate-pulse">
                  Входящий звонок...
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 justify-center">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  variant="destructive"
                  size="icon"
                  className="rounded-full w-12 h-12"
                  onClick={rejectCall}
                >
                  <PhoneOff className="h-5 w-5" />
                </Button>
              </motion.div>
              
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                <Button
                  variant="default"
                  size="icon"
                  className="rounded-full w-12 h-12 bg-green-500 hover:bg-green-600"
                  onClick={acceptCall}
                >
                  <Phone className="h-5 w-5" />
                </Button>
              </motion.div>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IncomingCallNotification;
