
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type StatusType = "online" | "away" | "offline" | "do_not_disturb";

export function useUserStatus(userId: string | null, relaxationMode: boolean = false) {
  const activityTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastActivity = useRef(new Date());

  useEffect(() => {
    if (!userId) return;

    // Initial status setup
    const initialStatus = relaxationMode ? "do_not_disturb" : "online";
    updateUserStatus(userId, initialStatus);

    // Set up activity listeners
    const resetTimer = () => {
      lastActivity.current = new Date();
      
      // If status was "away", update it back to "online" or "do_not_disturb"
      checkAndUpdateStatus(userId, relaxationMode);
      
      // Clear existing timeout
      if (activityTimeout.current) {
        clearTimeout(activityTimeout.current);
      }
      
      // Set new timeout for "away" status after 3 minutes of inactivity
      activityTimeout.current = setTimeout(() => {
        updateUserStatus(userId, "away");
      }, 3 * 60 * 1000); // 3 minutes
    };

    // Activity events to track
    const activityEvents = [
      'mousedown', 'keydown', 'touchstart', 'mousemove'
    ];
    
    // Add event listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer);
    });
    
    // Initialize the timer
    resetTimer();
    
    // Update status when relaxationMode changes
    if (relaxationMode) {
      updateUserStatus(userId, "do_not_disturb");
    } else {
      checkAndUpdateStatus(userId, false);
    }

    // Clean up
    return () => {
      // Remove event listeners
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
      
      // Clear timeout
      if (activityTimeout.current) {
        clearTimeout(activityTimeout.current);
      }
      
      // Set to offline when component unmounts
      updateUserStatus(userId, "offline");
    };
  }, [userId, relaxationMode]);

  // Updates visibility change
  useEffect(() => {
    if (!userId) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (!relaxationMode) {
          updateUserStatus(userId, "away");
        }
      } else {
        checkAndUpdateStatus(userId, relaxationMode);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [userId, relaxationMode]);

  // Check current status and update as appropriate
  const checkAndUpdateStatus = async (userId: string, relaxationMode: boolean) => {
    const now = new Date();
    const timeDiff = (now.getTime() - lastActivity.current.getTime()) / 1000;
    
    if (relaxationMode) {
      updateUserStatus(userId, "do_not_disturb");
    } else if (timeDiff < 180) { // Less than 3 minutes
      updateUserStatus(userId, "online");
    } else {
      updateUserStatus(userId, "away");
    }
  };

  const updateUserStatus = async (userId: string, status: StatusType) => {
    try {
      const statusData = {
        user_id: userId,
        status: status,
        last_active: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('user_status')
        .upsert(statusData, { onConflict: 'user_id' });
        
      if (error) {
        console.error('Error updating user status:', error);
      }
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };
}
