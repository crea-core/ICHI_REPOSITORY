
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from '@/components/language-provider';

interface Contact {
  id: string;
  full_name: string;
  username: string;
  email: string;
  avatar_url: string | null;
}

interface SearchResult {
  id: string;
  title: string;
  description: string;
  type: 'page' | 'contact' | 'email';
  action: () => void;
  icon?: React.ReactNode;
}

const GlobalSearch = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Fetch contacts on component mount
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .neq('id', user.id);

        if (error) throw error;
        if (data) setContacts(data);
      } catch (error) {
        console.error('Error fetching contacts:', error);
      }
    };

    fetchContacts();
  }, []);

  // Define static pages for search
  const staticPages: Omit<SearchResult, 'id'>[] = [
    {
      title: t('relaxation'),
      description: t('click to enter relaxation mode'),
      type: 'page',
      action: () => navigate('/relaxation')
    },
    {
      title: t('quietude'),
      description: t('time to relax'),
      type: 'page',
      action: () => navigate('/relaxation')
    },
    {
      title: t('покой'),
      description: t('time to relax'),
      type: 'page',
      action: () => navigate('/relaxation')
    },
    {
      title: t('chat'),
      description: t('go to chat'),
      type: 'page',
      action: () => navigate('/chat')
    },
    {
      title: t('чат'),
      description: t('go to chat'),
      type: 'page',
      action: () => navigate('/chat')
    },
    {
      title: t('mail'),
      description: 'Открыть почту',
      type: 'page',
      action: () => navigate('/mail')
    },
    {
      title: 'почта',
      description: 'Открыть почту',
      type: 'page',
      action: () => navigate('/mail')
    },
    {
      title: t('mind map'),
      description: t('click to open mind map'),
      type: 'page',
      action: () => navigate('/mindmap')
    },
    {
      title: 'карта мыслей',
      description: t('click to open mind map'),
      type: 'page',
      action: () => navigate('/mindmap')
    },
    {
      title: t('profile'),
      description: 'Открыть профиль',
      type: 'page',
      action: () => navigate('/profile')
    },
    {
      title: 'профиль',
      description: 'Открыть профиль',
      type: 'page',
      action: () => navigate('/profile')
    }
  ];

  // Filter results based on query
  useEffect(() => {
    if (query.length < 1) {
      setSearchResults([]);
      return;
    }

    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    // Search in static pages
    staticPages.forEach((page, index) => {
      if (page.title.toLowerCase().includes(lowerQuery) || 
          page.description.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: `page-${index}`,
          ...page
        });
      }
    });

    // Search in contacts
    contacts.forEach((contact) => {
      const searchableText = [
        contact.full_name || '',
        contact.username || '',
        contact.email || ''
      ].join(' ').toLowerCase();

      if (searchableText.includes(lowerQuery)) {
        results.push({
          id: `contact-${contact.id}`,
          title: contact.full_name || contact.username || contact.email,
          description: `Перейти в чат с ${contact.full_name || contact.username}`,
          type: 'contact',
          action: () => navigate(`/chat/${contact.id}`),
          icon: (
            <Avatar className="h-6 w-6">
              {contact.avatar_url ? (
                <AvatarImage src={contact.avatar_url} />
              ) : (
                <AvatarFallback className="bg-[#33C3F0] text-white text-xs">
                  {(contact.full_name || contact.username || contact.email)[0]}
                </AvatarFallback>
              )}
            </Avatar>
          )
        });
      }
    });

    setSearchResults(results.slice(0, 8)); // Limit to 8 results
  }, [query, contacts, navigate, t]);

  const handleSelect = (result: SearchResult) => {
    result.action();
    setOpen(false);
    setQuery('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="search"
            placeholder={`${t('search')}...`}
            className="pl-10 pr-4 py-2 w-full"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder={`${t('search')}...`}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>Ничего не найдено</CommandEmpty>
            {searchResults.length > 0 && (
              <>
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
                
                {searchResults.some(result => result.type === 'contact') && (
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
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default GlobalSearch;
