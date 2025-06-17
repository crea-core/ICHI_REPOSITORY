
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/components/language-provider";
import { Database } from "@/integrations/supabase/types";

type StatusType = "online" | "away" | "offline" | "do_not_disturb";

interface UserStatusProps {
  userId: string;
  className?: string;
}

type UserStatusData = {
  status: StatusType;
  last_active: string | null;
};

export default function UserStatus({ userId, className = "" }: UserStatusProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<StatusType>("offline");
  const [lastActive, setLastActive] = useState<Date | null>(null);
  
  useEffect(() => {
    const fetchUserStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('user_status')
          .select('status, last_active')
          .eq('user_id', userId)
          .single();
          
        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching user status:', error);
          return;
        }
        
        if (data) {
          setStatus(data.status as StatusType);
          if (data.last_active) {
            setLastActive(new Date(data.last_active));
          }
        }
      } catch (error) {
        console.error('Error fetching user status:', error);
      }
    };
    
    fetchUserStatus();
    
    // Subscribe to status changes
    const channel = supabase
      .channel(`user-status-${userId}`)
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'user_status',
          filter: `user_id=eq.${userId}`
        }, 
        (payload) => {
          const newData = payload.new as any;
          setStatus(newData.status as StatusType);
          if (newData.last_active) {
            setLastActive(new Date(newData.last_active));
          }
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
  
  const getStatusColor = () => {
    switch (status) {
      case "online": return "bg-green-500";
      case "away": return "bg-yellow-500";
      case "do_not_disturb": return "bg-red-500";
      case "offline": return "bg-gray-500";
      default: return "bg-gray-500";
    }
  };
  
  const getStatusLabel = () => {
    return t(status);
  };

  return (
    <Badge variant="outline" className={`${className} flex items-center gap-1 border-transparent`}>
      <span className={`h-2 w-2 rounded-full ${getStatusColor()}`} />
      <span className="text-xs font-normal">{getStatusLabel()}</span>
    </Badge>
  );
}
