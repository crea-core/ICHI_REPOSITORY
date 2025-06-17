
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserSearch, UserResult } from "./UserSearch";
import { supabase } from "@/integrations/supabase/client";

interface AddContactDialogProps {
  trigger: React.ReactNode;
  onContactAdded?: (user: UserResult) => void;
}

export function AddContactDialog({ trigger, onContactAdded }: AddContactDialogProps) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setCurrentUserId(data.user.id);
      }
    };
    
    fetchCurrentUser();
  }, []);

  const handleContactAdded = (user: UserResult) => {
    // Close dialog after adding contact
    setOpen(false);
    // Trigger callback to refresh contacts list
    if (onContactAdded) {
      onContactAdded(user);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Добавить новый контакт</DialogTitle>
          <DialogDescription>
            Найдите пользователей по имени или email, чтобы добавить их в свои контакты.
          </DialogDescription>
        </DialogHeader>
        
        {currentUserId ? (
          <UserSearch 
            currentUserId={currentUserId} 
            onUserAdd={handleContactAdded}
          />
        ) : (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#33C3F0] mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Загрузка...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
