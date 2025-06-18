
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';

interface SearchResult {
  id: string;
  title: string;
  description: string;
  type: 'page' | 'contact' | 'task';
  action: () => void;
  icon?: React.ReactNode;
}

const GlobalSearch = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Static pages for search
  const staticPages: Omit<SearchResult, 'id'>[] = [
    {
      title: 'Расслабление',
      description: 'Перейти в режим расслабления',
      type: 'page',
      action: () => navigate('/relaxation')
    },
    {
      title: 'Покой',
      description: 'Время отдохнуть',
      type: 'page',
      action: () => navigate('/relaxation')
    },
    {
      title: 'Чат',
      description: 'Перейти в чат',
      type: 'page',
      action: () => navigate('/chat')
    },
    {
      title: 'Почта',
      description: 'Открыть почту',
      type: 'page',
      action: () => navigate('/mail')
    },
    {
      title: 'Mail',
      description: 'Открыть почту',
      type: 'page',
      action: () => navigate('/mail')
    },
    {
      title: 'Карта мыслей',
      description: 'Открыть карту мыслей',
      type: 'page',
      action: () => navigate('/mindmap')
    },
    {
      title: 'Mind Map',
      description: 'Открыть карту мыслей',
      type: 'page',
      action: () => navigate('/mindmap')
    },
    {
      title: 'Профиль',
      description: 'Открыть профиль',
      type: 'page',
      action: () => navigate('/profile')
    },
    {
      title: 'Profile',
      description: 'Открыть профиль',
      type: 'page',
      action: () => navigate('/profile')
    },
    {
      title: 'Дашборд',
      description: 'Перейти на главную',
      type: 'page',
      action: () => navigate('/dashboard')
    },
    {
      title: 'Dashboard',
      description: 'Перейти на главную',
      type: 'page',
      action: () => navigate('/dashboard')
    }
  ];

  // Search function
  useEffect(() => {
    const performSearch = async () => {
      if (query.length < 1) {
        setSearchResults([]);
        return;
      }

      setIsLoading(true);
      console.log('Searching for:', query);

      try {
        const results: SearchResult[] = [];
        const lowerQuery = query.toLowerCase();

        // Search static pages
        staticPages.forEach((page, index) => {
          if (page.title.toLowerCase().includes(lowerQuery) || 
              page.description.toLowerCase().includes(lowerQuery)) {
            results.push({
              id: `page-${index}`,
              ...page
            });
          }
        });

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Search profiles using simple query
          const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, username, full_name, email, avatar_url')
            .neq('id', user.id)
            .or(`full_name.ilike.%${query}%,username.ilike.%${query}%,email.ilike.%${query}%`)
            .limit(5);

          console.log('Profile search results:', profiles, profileError);

          if (profiles && !profileError) {
            profiles.forEach((profile: any) => {
              results.push({
                id: `contact-${profile.id}`,
                title: profile.full_name || profile.username || profile.email,
                description: `Чат с ${profile.full_name || profile.username}`,
                type: 'contact',
                action: () => navigate(`/chat/${profile.id}`),
                icon: (
                  <Avatar className="h-6 w-6">
                    {profile.avatar_url ? (
                      <AvatarImage src={profile.avatar_url} />
                    ) : (
                      <AvatarFallback className="bg-[#33C3F0] text-white text-xs">
                        {(profile.full_name || profile.username || profile.email)[0]}
                      </AvatarFallback>
                    )}
                  </Avatar>
                )
              });
            });
          }

          // Search tasks using simple query
          const { data: tasks, error: taskError } = await supabase
            .from('tasks')
            .select('id, title, description, status')
            .or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`)
            .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
            .limit(5);

          console.log('Task search results:', tasks, taskError);

          if (tasks && !taskError) {
            tasks.forEach((task: any) => {
              results.push({
                id: `task-${task.id}`,
                title: task.title,
                description: `Задача: ${task.description || 'Без описания'} (${task.status})`,
                type: 'task',
                action: () => navigate('/dashboard'),
                icon: (
                  <div className="h-6 w-6 bg-blue-500 rounded text-white text-xs flex items-center justify-center">
                    T
                  </div>
                )
              });
            });
          }
        }

        console.log('Final search results:', results);
        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(performSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [query, navigate]);

  const handleSelect = (result: SearchResult) => {
    console.log('Selected result:', result);
    result.action();
    setOpen(false);
    setQuery('');
    setSearchResults([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="search"
            placeholder="Поиск по всему интерфейсу..."
            className="pl-10 pr-4 py-2 w-full"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Поиск..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {isLoading && (
              <div className="py-6 text-center text-sm">
                Поиск...
              </div>
            )}
            
            {!isLoading && searchResults.length === 0 && query.length > 0 && (
              <CommandEmpty>Ничего не найдено</CommandEmpty>
            )}
            
            {!isLoading && searchResults.length > 0 && (
              <>
                {searchResults.filter(result => result.type === 'page').length > 0 && (
                  <CommandGroup heading="Страницы">
                    {searchResults
                      .filter(result => result.type === 'page')
                      .map((result) => (
                        <CommandItem
                          key={result.id}
                          onSelect={() => handleSelect(result)}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            {result.icon}
                            <div>
                              <div className="font-medium">{result.title}</div>
                              <div className="text-sm text-muted-foreground">{result.description}</div>
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                )}
                
                {searchResults.filter(result => result.type === 'contact').length > 0 && (
                  <CommandGroup heading="Контакты">
                    {searchResults
                      .filter(result => result.type === 'contact')
                      .map((result) => (
                        <CommandItem
                          key={result.id}
                          onSelect={() => handleSelect(result)}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            {result.icon}
                            <div>
                              <div className="font-medium">{result.title}</div>
                              <div className="text-sm text-muted-foreground">{result.description}</div>
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                )}

                {searchResults.filter(result => result.type === 'task').length > 0 && (
                  <CommandGroup heading="Задачи">
                    {searchResults
                      .filter(result => result.type === 'task')
                      .map((result) => (
                        <CommandItem
                          key={result.id}
                          onSelect={() => handleSelect(result)}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            {result.icon}
                            <div>
                              <div className="font-medium">{result.title}</div>
                              <div className="text-sm text-muted-foreground">{result.description}</div>
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default GlobalSearch;
