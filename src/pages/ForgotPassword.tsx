import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Mail, ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().email("Please enter a valid email address");

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    const validation = emailSchema.safeParse(email);
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (resetError) throw resetError;
      
      setIsSuccess(true);
      toast({
        title: "Email sent!",
        description: "Check your inbox for the password reset link.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to send reset email",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/auth" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </Link>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4">
            <BookOpen className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Reset Password</h1>
          <p className="text-muted-foreground mt-2">
            Enter your email to receive a reset link
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {isSuccess ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-success" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Check Your Email</h3>
                <p className="text-muted-foreground mb-6">
                  We've sent a password reset link to <strong>{email}</strong>
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Didn't receive the email? Check your spam folder or try again.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => setIsSuccess(false)}
                  className="w-full"
                >
                  Send Again
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      disabled={isLoading}
                      autoComplete="email"
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
