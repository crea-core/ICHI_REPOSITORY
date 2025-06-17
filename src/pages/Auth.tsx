import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const navigate = useNavigate();
  const {
    t
  } = useTranslation();
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        const {
          error
        } = await supabase.auth.signUp({
          email,
          password
        });
        if (error) throw error;
        toast.success(t("registration successful"));
      } else {
        const {
          error
        } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };
  const handleGoogleSignIn = async () => {
    try {
      const {
        error
      } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message);
    }
  };
  return <motion.div className="flex items-center justify-center min-h-screen bg-white" initial={{
    opacity: 0
  }} animate={{
    opacity: 1
  }} transition={{
    duration: 0.5
  }}>
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            <span className="text-black">IC</span>
            <span className="text-[#33C3F0]">HI</span>
          </CardTitle>
          <CardDescription className="text-center">
            {isRegister ? t("create new account") : t("enter account")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth}>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">{t("password")}</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="********" required />
              </div>
              <Button type="submit" className="w-full bg-[#33C3F0] hover:bg-[#1EAEDB]" disabled={loading}>
                {loading ? t("loading") : isRegister ? t("register") : t("login")}
              </Button>
            </div>
          </form>
          
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">{t("or")}</span>
            </div>
          </div>
          
          <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignIn}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4"><circle cx="12" cy="12" r="10" /><path d="M8 12h8" /><path d="M12 8v8" /></svg>
            {t("login with google")}
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col">
          <Button variant="link" className="px-0 text-sm font-normal text-[#33C3F0]" onClick={() => setIsRegister(!isRegister)}>
            {isRegister ? t("already have account") : t("no account")}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>;
};
export default Auth;