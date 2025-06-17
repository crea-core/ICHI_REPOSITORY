
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Toggle } from "@/components/ui/toggle";

const Profile = () => {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [relaxationMode, setRelaxationMode] = useState(false);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const getProfile = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          setCurrentUserId(user.id);
          setEmail(user.email || "");
          
          // Fetch profile from profiles table
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
            
          if (error && error.code !== 'PGRST116') {
            throw error;
          }
          
          if (data) {
            setUsername(data.username || "");
            setFullname(data.full_name || "");
            setAvatarUrl(data.avatar_url);
          }
          
          // Check user metadata for relaxation mode setting
          const metadata = user.user_metadata || {};
          setRelaxationMode(metadata.relaxation_mode === true);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        toast.error('Не удалось загрузить профиль');
      } finally {
        setLoading(false);
      }
    };

    getProfile();
  }, []);

  const uploadAvatar = async () => {
    if (!avatar || !currentUserId) return null;
    
    try {
      // Upload to Storage
      const fileExt = avatar.name.split('.').pop();
      const fileName = `${currentUserId}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatar);
        
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
        
      return urlData.publicUrl;
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error('Не удалось загрузить аватар');
      return null;
    }
  };

  const handleUpdateProfile = async () => {
    if (!currentUserId) {
      toast.error('Пользователь не найден');
      return;
    }

    try {
      setLoading(true);
      
      // Upload avatar if selected
      let newAvatarUrl = avatarUrl;
      if (avatar) {
        const uploadedUrl = await uploadAvatar();
        if (uploadedUrl) {
          newAvatarUrl = uploadedUrl;
        }
      }
      
      // Update user metadata for relaxation mode
      const { error: authError } = await supabase.auth.updateUser({
        data: { relaxation_mode: relaxationMode }
      });
      
      if (authError) throw authError;
      
      // Update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: currentUserId,
          username: username.trim(),
          full_name: fullname.trim(),
          avatar_url: newAvatarUrl,
          email: email,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUserId);
        
      if (profileError) throw profileError;

      // Update local state with new avatar URL
      setAvatarUrl(newAvatarUrl);
      setAvatar(null); // Clear the file input
      
      toast.success("Профиль успешно обновлен");
    } catch (error: any) {
      console.error('Update profile error:', error);
      toast.error(error.message || "Не удалось обновить профиль");
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Файл слишком большой. Максимальный размер: 5MB');
        return;
      }
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Пожалуйста, выберите файл изображения');
        return;
      }
      
      // Preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      setAvatar(file);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <header className="flex items-center justify-between py-4 px-6 border-b">
        <h1 className="text-xl font-bold cursor-pointer" onClick={() => navigate("/dashboard")}>
          <span className="text-black">Task</span>
          <span className="text-[#33C3F0]">Tide</span>
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Назад на дашборд
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto py-10 px-4 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Настройки профиля</CardTitle>
            <CardDescription>Управляйте своими персональными данными и настройками</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="w-24 h-24">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} />
                ) : (
                  <AvatarFallback className="bg-[#33C3F0] text-white text-2xl">
                    {fullname ? fullname[0]?.toUpperCase() : username[0]?.toUpperCase() || 'У'}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex items-center">
                <label htmlFor="avatar-upload" className="cursor-pointer">
                  <div className="bg-gray-100 hover:bg-gray-200 py-1 px-3 rounded-md text-sm">
                    Изменить фото
                  </div>
                  <input 
                    id="avatar-upload" 
                    type="file" 
                    accept="image/*" 
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={email} disabled />
                <p className="text-sm text-gray-500">Ваш email не может быть изменен</p>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="username">Имя пользователя</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Введите имя пользователя"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="fullname">Полное имя</Label>
                <Input
                  id="fullname"
                  value={fullname}
                  onChange={(e) => setFullname(e.target.value)}
                  placeholder="Введите полное имя"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Режим отдыха</h3>
                  <p className="text-sm text-gray-500">Включите режим отдыха, чтобы уменьшить уведомления</p>
                </div>
                <Toggle 
                  pressed={relaxationMode}
                  onPressedChange={setRelaxationMode}
                  className="data-[state=on]:bg-[#33C3F0]"
                >
                  {relaxationMode ? "Вкл" : "Выкл"}
                </Toggle>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              Отмена
            </Button>
            <Button 
              className="bg-[#33C3F0] hover:bg-[#1EAEDB]" 
              onClick={handleUpdateProfile} 
              disabled={loading}
            >
              {loading ? "Сохранение..." : "Применить"}
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
};

export default Profile;
