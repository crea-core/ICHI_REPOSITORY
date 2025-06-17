import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { MessageCircle, Phone, MoreVertical, ArrowLeft, UserPlus } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AddContactDialog } from "@/components/AddContactDialog";
import { UserResult } from "@/components/UserSearch";

interface Contact {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string | null;
}

interface Message {
  id: string;
  content: string;
  user_id: string;
  receiver_id: string;
  created_at: string;
  read: boolean;
}

const Chat = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const navigate = useNavigate();
  const { contactId } = useParams<{ contactId: string }>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          console.error("Ошибка при получении пользователя:", error);
          toast.error("Не удалось получить данные пользователя");
          return;
        }
        if (data.user) {
          setCurrentUserId(data.user.id);
          console.log("Current user ID set:", data.user.id);
        }
      } catch (error) {
        console.error("Ошибка при получении пользователя:", error);
        toast.error("Не удалось получить данные пользователя");
      }
    };

    fetchCurrentUser();
  }, []);

  const fetchContacts = useCallback(async () => {
    if (!currentUserId) return;
    
    try {
      setLoading(true);
      console.log("Fetching contacts for user:", currentUserId);
      
      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .select('contact_id')
        .eq('user_id', currentUserId);

      if (contactError) {
        console.error("Ошибка при получении контактов:", contactError);
        toast.error("Не удалось загрузить список контактов");
        return;
      }
      
      console.log("Contact IDs:", contactData);
      
      if (!contactData || contactData.length === 0) {
        console.log("No contacts found");
        setContacts([]);
        return;
      }

      const contactIds = contactData.map(c => c.contact_id);
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, username, email, avatar_url')
        .in('id', contactIds);

      if (profilesError) {
        console.error("Ошибка при получении профилей:", profilesError);
        toast.error("Не удалось загрузить данные профилей");
        return;
      }
      
      console.log("Profiles data:", profilesData);
      
      const formattedContacts = (profilesData || []).map((profile) => ({
        id: profile.id,
        name: profile.full_name || profile.username || profile.email || "Пользователь",
        email: profile.email || "",
        avatar_url: profile.avatar_url,
      }));
      
      console.log("Formatted contacts:", formattedContacts);
      setContacts(formattedContacts);
      
    } catch (error) {
      console.error("Ошибка при получении контактов:", error);
      toast.error("Не удалось загрузить список контактов");
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (currentUserId) {
      fetchContacts();
    }
  }, [currentUserId, fetchContacts]);

  useEffect(() => {
    const setActiveContactFromUrl = async () => {
      console.log("Setting active contact from URL, contactId:", contactId);
      
      if (!contactId || !currentUserId) {
        console.log("No contactId or currentUserId, clearing active contact");
        setActiveContact(null);
        setMessages([]);
        return;
      }

      // First check if contact is in our contacts list
      const existingContact = contacts.find(c => c.id === contactId);
      if (existingContact) {
        console.log("Found contact in contacts list:", existingContact);
        setActiveContact(existingContact);
        return;
      }

      // If not in contacts list, fetch from profiles
      try {
        console.log("Fetching contact profile for:", contactId);
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, username, email, avatar_url")
          .eq("id", contactId)
          .single();

        if (error) {
          console.error("Ошибка при получении данных контакта:", error);
          toast.error("Не удалось загрузить информацию о контакте");
          return;
        }

        if (data) {
          const contact = {
            id: data.id,
            name: data.full_name || data.username || data.email || "Пользователь",
            email: data.email || "",
            avatar_url: data.avatar_url,
          };
          console.log("Setting active contact from profile:", contact);
          setActiveContact(contact);
        }
      } catch (error) {
        console.error("Ошибка при получении данных контакта:", error);
        toast.error("Не удалось загрузить информацию о контакте");
      }
    };

    setActiveContactFromUrl();
  }, [contactId, currentUserId, contacts]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!activeContact || !currentUserId) {
        setMessages([]);
        return;
      }

      try {
        setLoadingMessages(true);
        console.log("Fetching messages between:", currentUserId, "and", activeContact.id);
        
        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .or(
            `and(user_id.eq.${currentUserId},receiver_id.eq.${activeContact.id}),and(user_id.eq.${activeContact.id},receiver_id.eq.${currentUserId})`
          )
          .order("created_at", { ascending: true });

        if (error) {
          console.error("Ошибка при получении сообщений:", error);
          toast.error("Не удалось загрузить сообщения");
          return;
        }

        console.log("Fetched messages:", data);
        if (data) {
          setMessages(data);
        }
      } catch (error) {
        console.error("Ошибка при получении сообщений:", error);
        toast.error("Не удалось загрузить сообщения");
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [activeContact, currentUserId]);

  useEffect(() => {
    if (!activeContact || !currentUserId) return;

    console.log("Setting up real-time subscription for messages");
    
    let channel: any = null;
    
    try {
      // Create channel with a unique name
      channel = supabase
        .channel(`messages_${currentUserId}_${activeContact.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          (payload) => {
            console.log("New message received:", payload);
            const newMessage = payload.new as Message;
            
            // Only add messages that are part of this conversation
            if (
              (newMessage.user_id === currentUserId && newMessage.receiver_id === activeContact.id) ||
              (newMessage.user_id === activeContact.id && newMessage.receiver_id === currentUserId)
            ) {
              setMessages(prev => [...prev, newMessage]);
            }
          }
        )
        .subscribe((status) => {
          console.log("Subscription status:", status);
        });
    } catch (error) {
      console.error("Error setting up real-time subscription:", error);
      // Continue without real-time if it fails
    }

    return () => {
      console.log("Cleaning up real-time subscription");
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (error) {
          console.error("Error removing channel:", error);
        }
      }
    };
  }, [activeContact, currentUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (newMessage.trim() && activeContact && currentUserId) {
      try {
        console.log("Sending message from", currentUserId, "to", activeContact.id);
        
        const { data, error } = await supabase
          .from("messages")
          .insert([
            {
              content: newMessage.trim(),
              user_id: currentUserId,
              receiver_id: activeContact.id,
            },
          ])
          .select()
          .single();

        if (error) {
          console.error("Ошибка при отправке сообщения:", error);
          toast.error("Не удалось отправить сообщение");
          return;
        }

        console.log("Message sent successfully:", data);
        setNewMessage("");
        
      } catch (error) {
        console.error("Ошибка при отправке сообщения:", error);
        toast.error("Не удалось отправить сообщение");
      }
    }
  };

  const initiateCall = (contact: Contact) => {
    document.dispatchEvent(new CustomEvent('openCallModal', {
      detail: {
        contactId: contact.id,
        contactName: contact.name,
        contactAvatar: contact.avatar_url,
        isIncoming: false
      }
    }));
  };

  const handleContactAdded = (user: UserResult) => {
    fetchContacts();
    navigate(`/chat/${user.id}`);
  };

  const handleContactClick = (contact: Contact) => {
    console.log("Contact clicked:", contact);
    navigate(`/chat/${contact.id}`);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Navbar */}
      <header className="flex items-center justify-between py-4 px-6 border-b">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1
            className="text-xl font-bold cursor-pointer"
            onClick={() => navigate("/dashboard")}
          >
            <span className="text-black">Task</span>
            <span className="text-[#33C3F0]">Tide</span>
          </h1>
        </div>
        <div className="flex gap-2">
          <Avatar className="cursor-pointer" onClick={() => navigate("/profile")}>
            <AvatarFallback className="bg-[#33C3F0] text-white">
              ПР
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      <main className="flex-1 flex">
        {/* Contacts sidebar */}
        <aside className="w-80 border-r p-4 bg-gray-50 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Контакты</h2>
            <AddContactDialog
              trigger={
                <Button variant="ghost" size="icon" title="Добавить контакт">
                  <UserPlus className="h-5 w-5" />
                </Button>
              }
              onContactAdded={handleContactAdded}
            />
          </div>
          <div className="space-y-2 overflow-y-auto flex-1">
            {loading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#33C3F0] mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">Загрузка контактов...</p>
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                <p className="text-gray-500">Нет контактов</p>
                <p className="text-sm text-gray-400 mt-1">Добавьте контакты, чтобы начать общение</p>
              </div>
            ) : (
              contacts.map((contact) => (
                <Card
                  key={contact.id}
                  className={`p-3 cursor-pointer hover:bg-gray-100 transition-colors ${
                    activeContact?.id === contact.id ? "bg-blue-50 ring-2 ring-[#33C3F0]" : ""
                  }`}
                  onClick={() => handleContactClick(contact)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      {contact.avatar_url ? (
                        <AvatarImage src={contact.avatar_url} />
                      ) : (
                        <AvatarFallback className="bg-[#33C3F0] text-white">
                          {contact.name[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{contact.name}</h3>
                      {contact.email && (
                        <p className="text-sm text-gray-500 truncate">{contact.email}</p>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </aside>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {activeContact ? (
            <>
              {/* Chat header */}
              <div className="border-b p-4 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <Avatar>
                    {activeContact.avatar_url ? (
                      <AvatarImage src={activeContact.avatar_url} />
                    ) : (
                      <AvatarFallback className="bg-[#33C3F0] text-white">
                        {activeContact.name[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    <h3 className="font-medium">{activeContact.name}</h3>
                    {activeContact.email && (
                      <p className="text-sm text-gray-500">{activeContact.email}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => initiateCall(activeContact)}
                    title="Звонок"
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" title="Меню">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Messages area */}
              <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                <div className="space-y-3">
                  {loadingMessages ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#33C3F0] mx-auto"></div>
                      <p className="mt-2 text-sm text-gray-500">Загрузка сообщений...</p>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageCircle className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                      <p className="text-gray-500">Нет сообщений</p>
                      <p className="text-sm text-gray-400 mt-1">Начните разговор, отправив первое сообщение</p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex flex-col ${
                          message.user_id === currentUserId
                            ? "items-end"
                            : "items-start"
                        }`}
                      >
                        <div
                          className={`rounded-2xl px-4 py-2 max-w-xs lg:max-w-md xl:max-w-lg break-words ${
                            message.user_id === currentUserId
                              ? "bg-[#33C3F0] text-white"
                              : "bg-white text-gray-800 border"
                          }`}
                        >
                          {message.content}
                        </div>
                        <p className="text-xs text-gray-500 mt-1 px-2">
                          {new Date(message.created_at).toLocaleTimeString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Message input */}
              <div className="p-4 border-t bg-white">
                <div className="flex items-center gap-3">
                  <Input
                    type="text"
                    placeholder="Напишите сообщение..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button 
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className="bg-[#33C3F0] hover:bg-[#1EAEDB]"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Отправить
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <Card className="p-8 text-center max-w-md">
                <MessageCircle className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-xl font-medium mb-2">Выберите контакт</h3>
                <p className="text-gray-500 mb-4">
                  Начните общение, выбрав контакт из списка слева.
                </p>
                <AddContactDialog
                  trigger={
                    <Button className="bg-[#33C3F0] hover:bg-[#1EAEDB]">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Добавить контакт
                    </Button>
                  }
                  onContactAdded={handleContactAdded}
                />
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Chat;
