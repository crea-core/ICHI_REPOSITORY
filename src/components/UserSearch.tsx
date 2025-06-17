
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Users } from "lucide-react";

interface UserSearchProps {
  currentUserId: string;
  onUserAdd?: (user: UserResult) => void;
}

export type UserResult = {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

export function UserSearch({ currentUserId, onUserAdd }: UserSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingContact, setAddingContact] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Введите текст для поиска");
      return;
    }
    
    try {
      setLoading(true);
      console.log("Searching for:", searchQuery);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, email, avatar_url')
        .or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .neq('id', currentUserId)
        .limit(10);
        
      if (error) {
        console.error("Error searching users:", error);
        toast.error("Ошибка поиска пользователей: " + error.message);
        return;
      }
      
      console.log("Search results:", data);
      setSearchResults(data || []);
      
      if (!data || data.length === 0) {
        toast.info("Пользователи не найдены");
      }
    } catch (error) {
      console.error("Error searching users:", error);
      toast.error("Ошибка поиска пользователей");
    } finally {
      setLoading(false);
    }
  };

  const addContact = async (user: UserResult) => {
    try {
      setAddingContact(user.id);
      console.log("Adding contact:", user.id, "for user:", currentUserId);
      
      // Check if contact already exists
      const { data: existingContact, error: checkError } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', currentUserId)
        .eq('contact_id', user.id)
        .maybeSingle();
        
      if (checkError) {
        console.error("Error checking contact:", checkError);
        toast.error("Ошибка проверки контакта: " + checkError.message);
        return;
      }
      
      if (existingContact) {
        toast.info("Этот пользователь уже в ваших контактах");
        return;
      }
      
      // Add contact
      const contactData = {
        user_id: currentUserId,
        contact_id: user.id
      };
      
      console.log("Inserting contact data:", contactData);
      
      const { error } = await supabase
        .from('contacts')
        .insert(contactData);
        
      if (error) {
        console.error("Error adding contact:", error);
        toast.error("Ошибка добавления контакта: " + error.message);
        return;
      }
      
      toast.success(`${user.full_name || user.username || user.email} добавлен в контакты`);
      
      // Trigger callback if provided
      if (onUserAdd) {
        onUserAdd(user);
      }
    } catch (error) {
      console.error("Error adding contact:", error);
      toast.error("Ошибка добавления контакта");
    } finally {
      setAddingContact(null);
    }
  };

  const getSuggestedContacts = async () => {
    try {
      setLoading(true);
      console.log("Getting suggested contacts for user:", currentUserId);
      
      // Get current user's email domain
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', currentUserId)
        .single();
        
      if (userError) {
        console.error("Error fetching user data:", userError);
        toast.error("Ошибка получения данных пользователя");
        return;
      }
      
      if (userData && userData.email) {
        const emailDomain = userData.email.split('@')[1];
        console.log("Looking for users with domain:", emailDomain);
        
        // Find users with same email domain
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, full_name, email, avatar_url')
          .ilike('email', `%@${emailDomain}`)
          .neq('id', currentUserId)
          .limit(5);
          
        if (error) {
          console.error("Error fetching suggested contacts:", error);
          toast.error("Ошибка получения рекомендуемых контактов");
          return;
        }
        
        console.log("Suggested contacts:", data);
        setSearchResults(data || []);
        
        if (!data || data.length === 0) {
          toast.info("Нет рекомендуемых контактов с вашим доменом email");
        } else {
          toast.success(`Найдено ${data.length} рекомендуемых контактов`);
        }
      } else {
        toast.info("Для получения рекомендаций укажите email в профиле");
      }
    } catch (error) {
      console.error("Error finding suggested contacts:", error);
      toast.error("Ошибка поиска рекомендуемых контактов");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по имени или email..."
            className="pl-10"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <Button 
          onClick={handleSearch}
          className="bg-[#33C3F0] hover:bg-[#1EAEDB]"
          disabled={loading}
        >
          {loading ? "..." : "Поиск"}
        </Button>
        <Button 
          onClick={getSuggestedContacts}
          variant="outline"
          disabled={loading}
          title="Показать пользователей с вашим доменом email"
        >
          <Users className="h-4 w-4" />
        </Button>
      </div>
      
      {loading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#33C3F0] mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">Поиск...</p>
        </div>
      ) : searchResults.length > 0 ? (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {searchResults.map((user) => (
            <div 
              key={user.id}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar>
                  {user.avatar_url ? (
                    <AvatarImage src={user.avatar_url} />
                  ) : (
                    <AvatarFallback className="bg-gray-200">
                      {(user.full_name || user.username || user.email || '?')[0]?.toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {user.full_name || user.username || 'Пользователь'}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    {user.email || 'Нет email'}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => addContact(user)}
                size="sm"
                className="bg-[#33C3F0] hover:bg-[#1EAEDB] shrink-0"
                disabled={addingContact === user.id}
              >
                {addingContact === user.id ? "..." : "Добавить"}
              </Button>
            </div>
          ))}
        </div>
      ) : searchQuery && !loading ? (
        <div className="text-center py-8 text-gray-500">
          <Users className="mx-auto h-12 w-12 text-gray-300 mb-2" />
          <p>Пользователи не найдены</p>
          <p className="text-sm text-gray-400 mt-1">Попробуйте другой запрос</p>
        </div>
      ) : null}
    </div>
  );
}
