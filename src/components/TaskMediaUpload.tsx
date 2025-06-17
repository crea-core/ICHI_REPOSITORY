
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ImageIcon, VideoIcon, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "@/components/language-provider";

interface TaskMediaUploadProps {
  taskId: string;
  userId: string;
  onMediaUploaded: (urls: string[]) => void;
  existingMedia?: string[];
}

export function TaskMediaUpload({ taskId, userId, onMediaUploaded, existingMedia = [] }: TaskMediaUploadProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;

      const files = Array.from(e.target.files);
      setUploading(true);
      
      const uploadPromises = files.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const filePath = `${userId}/${taskId}/${Math.random()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('task-media')
          .upload(filePath, file);
          
        if (uploadError) throw uploadError;
        
        const { data } = supabase.storage
          .from('task-media')
          .getPublicUrl(filePath);
        
        return data.publicUrl;
      });
      
      const newUrls = await Promise.all(uploadPromises);
      const allUrls = [...existingMedia, ...newUrls];
      
      onMediaUploaded(allUrls);
      toast.success(t('image_uploaded'));
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error(t('failed_to_upload_image'));
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const removeMedia = (urlToRemove: string) => {
    const updatedUrls = existingMedia.filter(url => url !== urlToRemove);
    onMediaUploaded(updatedUrls);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button 
          type="button" 
          size="sm" 
          variant="outline" 
          disabled={uploading}
          className="relative"
        >
          <label className="cursor-pointer flex items-center gap-2">
            {uploading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#33C3F0] border-t-transparent" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {t('upload_media')}
            <input
              type="file"
              className="hidden"
              accept="image/*,video/*"
              multiple
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>
        </Button>
      </div>
      
      {existingMedia.length > 0 && (
        <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
          {existingMedia.map((url, index) => (
            <div key={index} className="relative group">
              {url.includes('.mp4') || url.includes('.mov') || url.includes('.webm') ? (
                <div className="flex items-center gap-1 p-2 bg-muted rounded text-xs">
                  <VideoIcon className="h-3 w-3" />
                  <span className="truncate">Video {index + 1}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 p-2 bg-muted rounded text-xs">
                  <ImageIcon className="h-3 w-3" />
                  <span className="truncate">Image {index + 1}</span>
                </div>
              )}
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeMedia(url)}
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
