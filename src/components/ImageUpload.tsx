
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Image } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "@/components/language-provider";

interface ImageUploadProps {
  onImageUrl: (url: string) => void;
  userId: string;
}

export function ImageUpload({ onImageUrl, userId }: ImageUploadProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) {
        return;
      }
      
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}/${Math.random()}.${fileExt}`;
      
      setUploading(true);
      
      // Upload file to supabase storage
      const { error: uploadError } = await supabase.storage
        .from('chat_images')
        .upload(filePath, file);
        
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data } = supabase.storage
        .from('chat_images')
        .getPublicUrl(filePath);
      
      // Pass URL back to parent component
      onImageUrl(data.publicUrl);
      
      toast.success(t('image_uploaded'));
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error(t('failed_to_upload_image'));
    } finally {
      setUploading(false);
      // Clear the input
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  return (
    <Button 
      type="button" 
      size="icon" 
      variant="ghost" 
      className="rounded-full" 
      disabled={uploading}
    >
      <label className="cursor-pointer">
        {uploading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#33C3F0] border-t-transparent" />
        ) : (
          <Image className="h-4 w-4" />
        )}
        <input
          type="file"
          className="hidden"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
        />
      </label>
    </Button>
  );
}
