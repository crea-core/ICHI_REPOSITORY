
import { createContext, useContext, useEffect, useState } from "react";
import { ru } from "@/translations/ru";
import { en } from "@/translations/en";

type Language = "ru" | "en";

interface TranslationContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [language, setLanguage] = useState<Language>(
    () => (localStorage.getItem("language") as Language) || "ru"
  );

  const t = (key: string): string => {
    const translations = language === "ru" ? ru : en;
    return translations[key] || key;
  };

  useEffect(() => {
    localStorage.setItem("language", language);
    document.documentElement.lang = language;
  }, [language]);

  return (
    <TranslationContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </TranslationContext.Provider>
  );
}

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  
  if (context === undefined) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  
  return context;
};
