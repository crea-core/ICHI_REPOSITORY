import { Button } from "@/components/ui/button";
import { useTranslation } from "@/components/language-provider";

// Export as both named and default export for backward compatibility
export function LanguageSwitcher() {
  const { language, setLanguage, t } = useTranslation();

  return (
    <Button
      variant="outline"
      onClick={() => setLanguage(language === "ru" ? "en" : "ru")}
    >
      {language === "ru" ? "EN" : "RU"}
    </Button>
  );
}

// Keep default export for backward compatibility
export default LanguageSwitcher;
