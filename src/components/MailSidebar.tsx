
import { Button } from "@/components/ui/button";
import { 
  Inbox, 
  Send, 
  Archive, 
  Trash, 
  Pencil, 
  Star,
  AlertCircle 
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface MailSidebarProps {
  activeFolder: "inbox" | "sent" | "archive" | "trash";
  onFolderChange: (folder: "inbox" | "sent" | "archive" | "trash") => void;
  unreadCount: number;
  onComposeClick: () => void;
}

const MailSidebar = ({ activeFolder, onFolderChange, unreadCount, onComposeClick }: MailSidebarProps) => {
  const folders = [
    {
      id: "inbox" as const,
      name: "Входящие",
      icon: Inbox,
      count: unreadCount
    },
    {
      id: "sent" as const,
      name: "Отправленные",
      icon: Send,
      count: 0
    },
    {
      id: "archive" as const,
      name: "Архив",
      icon: Archive,
      count: 0
    },
    {
      id: "trash" as const,
      name: "Корзина",
      icon: Trash,
      count: 0
    }
  ];

  return (
    <div className="w-64 border-r overflow-y-auto p-4 bg-background">
      <Button 
        onClick={onComposeClick}
        className="w-full mb-6 bg-[#33C3F0] hover:bg-[#1EAEDB]"
      >
        <Pencil className="mr-2 h-4 w-4" /> 
        Новое письмо
      </Button>
      
      <nav className="space-y-1">
        {folders.map((folder) => {
          const Icon = folder.icon;
          return (
            <button
              key={folder.id}
              className={`flex items-center w-full px-3 py-2 rounded-lg transition-colors ${
                activeFolder === folder.id 
                  ? "bg-accent text-accent-foreground" 
                  : "hover:bg-accent/50"
              }`}
              onClick={() => onFolderChange(folder.id)}
            >
              <Icon className="mr-2 h-4 w-4" />
              <span className="flex-1 text-left">{folder.name}</span>
              {folder.count > 0 && (
                <span className="bg-[#33C3F0] text-white text-xs px-2 py-0.5 rounded-full">
                  {folder.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-8 pt-4 border-t">
        <div className="text-xs text-muted-foreground mb-2">Быстрые действия</div>
        <div className="space-y-1">
          <button className="flex items-center w-full px-3 py-2 text-sm rounded-lg hover:bg-accent/50">
            <Star className="mr-2 h-3 w-3" />
            Избранное
          </button>
          <button className="flex items-center w-full px-3 py-2 text-sm rounded-lg hover:bg-accent/50">
            <AlertCircle className="mr-2 h-3 w-3" />
            Важные
          </button>
        </div>
      </div>
    </div>
  );
};

export default MailSidebar;
