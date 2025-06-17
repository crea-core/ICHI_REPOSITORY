import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AddContactDialog } from "@/components/AddContactDialog";
import { UserSearch } from "@/components/UserSearch";
import GlobalSearch from "@/components/GlobalSearch";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { NotificationCenter } from "@/components/NotificationCenter";
import { UseCaseDiagramGenerator } from "@/components/UseCaseDiagramGenerator";
import { ModeToggle } from "@/components/mode-toggle";
import { CheckCircle, Clock, MessageCircle, Mail, Brain, Phone, Waves, LogOut, User as UserIcon } from "lucide-react";
import { useTranslation } from "@/components/language-provider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cleanupAuthState } from "@/components/AuthWrapper";
interface Task {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
}
interface Contact {
  id: string;
  full_name: string;
  username: string;
  email: string;
  avatar_url: string | null;
}
const Dashboard = () => {
  const navigate = useNavigate();
  const {
    t
  } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data
      } = await supabase.auth.getUser();
      if (data.user) {
        setCurrentUserId(data.user.id);
      }
    };
    fetchUser();
  }, []);
  useEffect(() => {
    if (currentUserId) {
      fetchTasks();
      fetchContacts();
    }
  }, [currentUserId]);
  const handleLogout = async () => {
    try {
      cleanupAuthState();
      // Attempt global sign out
      await supabase.auth.signOut({
        scope: 'global'
      });
      // Force page reload for a clean state
      window.location.href = '/auth';
    } catch (error: any) {
      toast.error(error.message);
    }
  };
  const fetchTasks = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('tasks').select('id, title, status').or(`user_id.eq.${currentUserId},assigned_to.eq.${currentUserId}`);
      if (error) throw error;

      // Ensure status values match the Task interface
      const typedTasks: Task[] = (data || []).map(task => ({
        ...task,
        status: task.status as "todo" | "in_progress" | "done" || "todo"
      }));
      setTasks(typedTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error(t('failed to load tasks'));
    } finally {
      setLoading(false);
    }
  };
  const fetchContacts = async () => {
    try {
      const {
        data: contactData,
        error
      } = await supabase.from('contacts').select(`
          contact_id,
          profiles!contacts_contact_id_fkey (
            id,
            full_name,
            username,
            email,
            avatar_url
          )
        `).eq('user_id', currentUserId);
      if (error) throw error;
      const contactProfiles = contactData?.map((contact: any) => contact.profiles).filter(Boolean) || [];
      setContacts(contactProfiles);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast.error(t('failed to load contacts'));
    }
  };
  const completedTasks = tasks.filter(task => task.status === 'done').length;
  const currentTasks = tasks.filter(task => task.status !== 'done').length;
  return <div className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="flex items-center justify-between py-4 px-6 border-b">
        <h1 className="text-xl font-bold">
          <span className="text-foreground">IC</span>
          <span className="text-sky-500">HI</span>
        </h1>
        <div className="flex-1 max-w-md mx-8">
          <GlobalSearch />
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {currentUserId && <NotificationCenter userId={currentUserId} />}
          <ModeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="cursor-pointer">
                <AvatarFallback className="bg-green-500 dark:bg-green-600 text-white">ПР</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Мой аккаунт</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/profile")}>
                <UserIcon className="mr-2 h-4 w-4" />
                <span>Профиль</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Выйти</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto p-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Quietude Card */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border-blue-200 dark:border-blue-800" onClick={() => navigate("/relaxation")}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Waves className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <CardTitle className="text-blue-700 dark:text-blue-300">{t('quietude')}</CardTitle>
              </div>
              <CardDescription className="text-blue-600 dark:text-blue-400">
                {t('time to relax')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t('click to enter relaxation mode')}
              </p>
            </CardContent>
          </Card>

          {/* Tasks Statistics */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-green-700 dark:text-green-400">Задачи</CardTitle>
                <Brain className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{t('completed tasks')}</span>
                  </div>
                  <span className="font-bold text-green-600">{completedTasks}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-500" />
                    <span className="text-sm">{t('current tasks')}</span>
                  </div>
                  <span className="font-bold text-orange-600">{currentTasks}</span>
                </div>
              </div>
              <Button onClick={() => navigate("/mindmap")} className="w-full mt-4 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600">
                {t('click to open mind map')}
              </Button>
            </CardContent>
          </Card>

          {/* Communication */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-blue-700 dark:text-blue-400">Общение</CardTitle>
                <MessageCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button onClick={() => navigate("/chat")} className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600">
                  {t('go to chat')}
                </Button>
                <Button onClick={() => navigate("/calls")} variant="outline" className="w-full">
                  <Phone className="h-4 w-4 mr-2" />
                  Звонки
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Email */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-purple-700 dark:text-purple-400">Почта</CardTitle>
                <Mail className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/mail")} className="w-full bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600">
                {t('open mail')}
              </Button>
            </CardContent>
          </Card>

          {/* Contacts */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>{t('contacts')}</CardTitle>
                <span className="text-2xl font-bold text-green-600">{contacts.length}</span>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? <p className="text-sm text-muted-foreground">{t('loading contacts')}</p> : contacts.length === 0 ? <p className="text-sm text-muted-foreground">{t('no contacts')}</p> : <div className="space-y-2 max-h-32 overflow-y-auto">
                  {contacts.slice(0, 3).map(contact => <div key={contact.id} className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="bg-green-500 text-white text-xs">
                          {(contact.full_name || contact.username || contact.email)[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate">
                        {contact.full_name || contact.username || contact.email}
                      </span>
                    </div>)}
                  {contacts.length > 3 && <p className="text-xs text-muted-foreground">
                      +{contacts.length - 3} больше
                    </p>}
                </div>}
              <AddContactDialog trigger={<Button variant="outline" className="w-full mt-3">
                    {t('add contact')}
                  </Button>} onContactAdded={fetchContacts} />
            </CardContent>
          </Card>

          {/* Documentation */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-gray-700 dark:text-gray-400">Документации</CardTitle>
            </CardHeader>
            <CardContent>
              <UseCaseDiagramGenerator />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>;
};
export default Dashboard;