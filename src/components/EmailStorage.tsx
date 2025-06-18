
import { supabase } from '@/integrations/supabase/client';

export interface EmailData {
  from: string;
  to: string;
  subject: string;
  content: string;
  timestamp: string;
}

export const saveEmailToStorage = async (emailData: EmailData, userId: string): Promise<boolean> => {
  try {
    const filename = `${userId}/sent/${Date.now()}-${emailData.subject.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    
    const emailContent = JSON.stringify({
      ...emailData,
      id: crypto.randomUUID(),
      type: 'sent'
    }, null, 2);

    const { error } = await supabase.storage
      .from('emails')
      .upload(filename, emailContent, {
        contentType: 'application/json',
        upsert: false
      });

    if (error) {
      console.error('Error saving email to storage:', error);
      return false;
    }

    console.log('Email saved to storage:', filename);
    return true;
  } catch (error) {
    console.error('Error in saveEmailToStorage:', error);
    return false;
  }
};

export const getStoredEmails = async (userId: string, folder: 'sent' | 'inbox' = 'sent') => {
  try {
    const { data: files, error } = await supabase.storage
      .from('emails')
      .list(`${userId}/${folder}`, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (error) {
      console.error('Error listing emails from storage:', error);
      return [];
    }

    if (!files || files.length === 0) {
      return [];
    }

    const emails = [];
    for (const file of files) {
      try {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('emails')
          .download(`${userId}/${folder}/${file.name}`);

        if (!downloadError && fileData) {
          const text = await fileData.text();
          const emailData = JSON.parse(text);
          emails.push(emailData);
        }
      } catch (err) {
        console.error('Error reading email file:', file.name, err);
      }
    }

    return emails.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (error) {
    console.error('Error in getStoredEmails:', error);
    return [];
  }
};
