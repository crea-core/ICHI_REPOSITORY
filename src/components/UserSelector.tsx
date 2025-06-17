
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/components/language-provider";

interface User {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface UserSelectorProps {
  currentUserId: string;
  assignedUserId?: string | null;
  collaborators?: string[];
  onAssignedUserChange: (userId: string | null) => void;
  onCollaboratorsChange: (collaborators: string[]) => void;
}

export function UserSelector({
  currentUserId,
  assignedUserId,
  collaborators = [],
  onAssignedUserChange,
  onCollaboratorsChange
}: UserSelectorProps) {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, [currentUserId]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      
      // Get user's contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('contact_id')
        .eq('user_id', currentUserId);

      if (contactsError) throw contactsError;

      const contactIds = contactsData?.map(c => c.contact_id) || [];
      
      // Add current user to the list
      contactIds.push(currentUserId);

      // Get user profiles
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', contactIds);

      if (usersError) throw usersError;

      setContacts(usersData || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUserDisplayName = (user: User) => {
    return user.full_name || user.username || user.email || 'Anonymous';
  };

  const addCollaborator = (userId: string) => {
    if (!collaborators.includes(userId) && userId !== assignedUserId && userId !== currentUserId) {
      onCollaboratorsChange([...collaborators, userId]);
    }
  };

  const removeCollaborator = (userId: string) => {
    onCollaboratorsChange(collaborators.filter(id => id !== userId));
  };

  const availableUsers = contacts.filter(user => 
    user.id !== currentUserId && 
    user.id !== assignedUserId && 
    !collaborators.includes(user.id)
  );

  return (
    <div className="space-y-4">
      {/* Assigned User */}
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('assign to')}</label>
        <div className="flex gap-2">
          <Select 
            value={assignedUserId || 'unassigned'} 
            onValueChange={(value) => onAssignedUserChange(value === 'unassigned' ? null : value)}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={t('select user')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">{t('no assignment')}</SelectItem>
              {contacts.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      {user.avatar_url ? (
                        <AvatarImage src={user.avatar_url} />
                      ) : (
                        <AvatarFallback className="text-xs">
                          {getUserDisplayName(user)[0]}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <span>{getUserDisplayName(user)}</span>
                    {user.id === currentUserId && (
                      <Badge variant="secondary" className="text-xs">Вы</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            onClick={() => onAssignedUserChange(currentUserId)}
            disabled={assignedUserId === currentUserId}
          >
            {t('assign to self')}
          </Button>
        </div>
      </div>

      {/* Collaborators */}
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('collaborators')}</label>
        
        {/* Current collaborators */}
        {collaborators.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {collaborators.map((collaboratorId) => {
              const user = contacts.find(u => u.id === collaboratorId);
              if (!user) return null;
              
              return (
                <Badge key={collaboratorId} variant="secondary" className="flex items-center gap-1">
                  <Avatar className="h-4 w-4">
                    {user.avatar_url ? (
                      <AvatarImage src={user.avatar_url} />
                    ) : (
                      <AvatarFallback className="text-xs">
                        {getUserDisplayName(user)[0]}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <span className="text-xs">{getUserDisplayName(user)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => removeCollaborator(collaboratorId)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              );
            })}
          </div>
        )}

        {/* Add collaborator */}
        {availableUsers.length > 0 && (
          <Select onValueChange={addCollaborator}>
            <SelectTrigger>
              <SelectValue placeholder={t('add collaborator')} />
            </SelectTrigger>
            <SelectContent>
              {availableUsers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      {user.avatar_url ? (
                        <AvatarImage src={user.avatar_url} />
                      ) : (
                        <AvatarFallback className="text-xs">
                          {getUserDisplayName(user)[0]}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <span>{getUserDisplayName(user)}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
