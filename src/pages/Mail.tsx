import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Mail, Search, Archive, Trash, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import MailSidebar from "@/components/MailSidebar";

interface Email {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  content: string;
  is_read: boolean;
  created_at: string;
  folder: string;
}

const MailPage = () => {
  const navigate = useNavigate();
  const [activeFolder, setActiveFolder] = useState<"inbox" | "sent" | "archive" | "trash">("inbox");
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState({
    recipient: "",
    subject: "",
    content: ""
  });
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; full_name: string | null; } | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch current user
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
         const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        setCurrentUser({ 
          id: user.id, 
          email: user.email || "",
          full_name: profile?.full_name || user.email?.split('@')[0] || 'User'
        });
      }
    };
    
    fetchCurrentUser();
  }, []);

  // Fetch emails and unread count
  useEffect(() => {
    const fetchEmails = async () => {
      if (!currentUser) return;
      
      try {
        const { data, error } = await supabase
          .from('emails')
          .select('*')
          .eq('user_id', currentUser.id)
          .eq('folder', activeFolder)
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        
        setEmails(data || []);

        // Fetch unread count for inbox
        const { data: unreadData, error: unreadError } = await supabase
          .from('emails')
          .select('id')
          .eq('user_id', currentUser.id)
          .eq('folder', 'inbox')
          .eq('is_read', false);

        if (!unreadError && unreadData) {
          setUnreadCount(unreadData.length);
        }
      } catch (error) {
        console.error('Error fetching emails:', error);
        toast.error('Failed to load emails');
      } finally {
        setLoading(false);
      }
    };
    
    if (currentUser) {
      setLoading(true);
      fetchEmails();
    }
  }, [currentUser, activeFolder]);

  // Subscribe to real-time email updates
  useEffect(() => {
    if (!currentUser) return;
    
    if (typeof window === 'undefined') return;
    
    try {
      const channel = supabase
        .channel('emails-channel')
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'emails',
            filter: `user_id=eq.${currentUser.id}`
          }, 
          (payload) => {
            const newEmail = payload.new as any;
            if (newEmail.folder === activeFolder) {
              setEmails(prev => [newEmail, ...prev]);
            }
            if (newEmail.folder === 'inbox' && !newEmail.is_read) {
              setUnreadCount(prev => prev + 1);
            }
          }
        )
        .subscribe();
        
      return () => {
        supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error("Error setting up realtime subscription:", error);
    }
  }, [currentUser, activeFolder]);

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser || !newEmail.recipient || !newEmail.subject || !newEmail.content) {
      console.error('Please fill all fields'); // Log error to console instead
      setComposeOpen(false);
      setNewEmail({ recipient: "", subject: "", content: "" });
      return;
    }
    
    try {
      const fromName = currentUser.full_name;
      const fromAddress = `${fromName} <${currentUser.email}>`;

      const { error: invokeError } = await supabase.functions.invoke('send-email', {
        body: {
          to: newEmail.recipient,
          from: fromAddress,
          subject: newEmail.subject,
          html: newEmail.content.replace(/\n/g, '<br>')
        }
      });

      if (invokeError) {
        throw invokeError;
      }

      // Insert into sender's sent folder
      const { error: sentError } = await supabase
        .from('emails')
        .insert({
          user_id: currentUser.id,
          sender: currentUser.email,
          recipient: newEmail.recipient,
          subject: newEmail.subject,
          content: newEmail.content,
          folder: 'sent'
        });
        
      if (sentError) throw sentError;
      
      // Find recipient user by email
      const { data: recipientUsers, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', newEmail.recipient)
        .maybeSingle();
      
      if (userError) throw userError;
      
      // If recipient exists in our system, add to their inbox
      if (recipientUsers) {
        const { error: inboxError } = await supabase
          .from('emails')
          .insert({
            user_id: recipientUsers.id,
            sender: currentUser.email,
            recipient: newEmail.recipient,
            subject: newEmail.subject,
            content: newEmail.content,
            folder: 'inbox'
          });
          
        if (inboxError) throw inboxError;
      }
      
      // Refresh emails if we're in sent folder
      if (activeFolder === 'sent') {
        const { data, error } = await supabase
          .from('emails')
          .select('*')
          .eq('user_id', currentUser.id)
          .eq('folder', 'sent')
          .order('created_at', { ascending: false });
          
        if (!error && data) {
          setEmails(data);
        }
      }
    } catch (error) {
      console.error('Error sending email:', error);
    } finally {
      setComposeOpen(false);
      setNewEmail({ recipient: "", subject: "", content: "" });
    }
  };

  const markAsRead = async (email: Email) => {
    if (email.is_read) return;
    
    try {
      const { error } = await supabase
        .from('emails')
        .update({ is_read: true })
        .eq('id', email.id);
        
      if (error) throw error;
      
      setEmails(prev => 
        prev.map(e => e.id === email.id ? { ...e, is_read: true } : e)
      );

      if (email.folder === 'inbox') {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
    } catch (error) {
      console.error('Error marking email as read:', error);
    }
  };

  const moveToFolder = async (email: Email, folder: string) => {
    try {
      const { error } = await supabase
        .from('emails')
        .update({ folder })
        .eq('id', email.id);
        
      if (error) throw error;
      
      setEmails(prev => prev.filter(e => e.id !== email.id));
      toast.success(`Email moved to ${folder}`);
      
    } catch (error) {
      console.error(`Error moving email to ${folder}:`, error);
      toast.error(`Failed to move email to ${folder}`);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Вчера';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { day: '2-digit', month: 'short' });
    }
  };

  // Filter emails based on search term
  const filteredEmails = emails.filter(email =>
    email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    email.sender.toLowerCase().includes(searchTerm.toLowerCase()) ||
    email.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <header className="flex items-center justify-between py-4 px-6 border-b">
        <h1 className="text-xl font-bold cursor-pointer" onClick={() => navigate("/dashboard")}>
          <span className="text-foreground">IC</span>
          <span className="text-[#33C3F0]">HI</span>
        </h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Назад на дашборд
          </Button>
          <Avatar className="cursor-pointer" onClick={() => navigate("/profile")}>
            <AvatarFallback className="bg-[#33C3F0] text-white">ПР</AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Mail Interface */}
      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <MailSidebar
          activeFolder={activeFolder}
          onFolderChange={setActiveFolder}
          unreadCount={unreadCount}
          onComposeClick={() => setComposeOpen(true)}
        />

        {/* Email List and Detail View */}
        <div className="flex-1 flex flex-col">
          {selectedEmail ? (
            // Email Detail View
            <div className="flex-1 flex flex-col">
              <div className="p-4 border-b flex justify-between items-center">
                <Button variant="outline" onClick={() => setSelectedEmail(null)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Назад
                </Button>
                <div className="flex gap-2">
                  {activeFolder !== 'archive' && (
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        moveToFolder(selectedEmail, 'archive');
                        setSelectedEmail(null);
                      }}
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Архивировать
                    </Button>
                  )}
                  {activeFolder !== 'trash' && (
                    <Button 
                      variant="outline"
                      onClick={() => {
                        moveToFolder(selectedEmail, 'trash');
                        setSelectedEmail(null);
                      }}
                    >
                      <Trash className="h-4 w-4 mr-2" />
                      Удалить
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1">
                <h2 className="text-2xl font-bold mb-4">{selectedEmail.subject}</h2>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <p className="font-medium">От: {selectedEmail.sender}</p>
                    <p className="text-sm text-muted-foreground">Кому: {selectedEmail.recipient}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedEmail.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="border-t pt-6">
                  <p className="whitespace-pre-wrap">{selectedEmail.content}</p>
                </div>
              </div>
            </div>
          ) : (
            // Email List View
            <>
              <div className="p-4 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Поиск писем..."
                    className="pl-10 pr-4 py-2 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex justify-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#33C3F0]"></div>
                  </div>
                ) : filteredEmails.length > 0 ? (
                  filteredEmails.map((email) => (
                    <div
                      key={email.id}
                      className={`border-b px-4 py-3 flex items-center cursor-pointer transition-colors ${
                        email.is_read ? "" : "bg-accent/30 font-medium"
                      } hover:bg-accent/50`}
                      onClick={() => {
                        markAsRead(email);
                        setSelectedEmail(email);
                      }}
                    >
                      <div className="mr-4">
                        <Avatar>
                          <AvatarFallback className="bg-secondary">
                            {email.sender[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between">
                          <p className="truncate">{activeFolder === 'sent' ? `Кому: ${email.recipient}` : email.sender}</p>
                          <p className="text-xs text-muted-foreground ml-2 whitespace-nowrap">{formatDate(email.created_at)}</p>
                        </div>
                        <p className="truncate font-medium">{email.subject}</p>
                        <p className="text-sm text-muted-foreground truncate">{email.content}</p>
                      </div>
                      {!email.is_read && (
                        <div className="ml-2 w-2 h-2 bg-[#33C3F0] rounded-full"></div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                    <Mail className="h-12 w-12 text-muted-foreground/50 mb-2" />
                    <p>
                      {searchTerm 
                        ? `Нет писем по запросу "${searchTerm}"` 
                        : `Нет писем в папке ${activeFolder}`
                      }
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Compose Dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Новое письмо</DialogTitle>
            <DialogDescription>
              Создайте и отправьте новое сообщение электронной почты
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSendEmail}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="recipient">Кому</Label>
                <Input
                  id="recipient"
                  type="email"
                  value={newEmail.recipient}
                  onChange={(e) => setNewEmail({...newEmail, recipient: e.target.value})}
                  placeholder="email@example.com"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="subject">Тема</Label>
                <Input
                  id="subject"
                  value={newEmail.subject}
                  onChange={(e) => setNewEmail({...newEmail, subject: e.target.value})}
                  placeholder="Тема письма"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="content">Сообщение</Label>
                <Textarea
                  id="content"
                  value={newEmail.content}
                  onChange={(e) => setNewEmail({...newEmail, content: e.target.value})}
                  placeholder="Введите текст сообщения"
                  rows={8}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setComposeOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" className="bg-[#33C3F0] hover:bg-[#1EAEDB]">
                Отправить
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MailPage;
