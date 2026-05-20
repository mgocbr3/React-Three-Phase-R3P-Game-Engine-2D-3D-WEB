import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, User } from 'lucide-react';
import { getRuntimeEnv } from '@/components/common/EnvironmentBadge';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const { signIn, signUp, isLoading } = useAuthStore();

  const runtimeEnv = getRuntimeEnv();
  const canUseDevAuth = Boolean(
    import.meta.env.DEV &&
    import.meta.env.VITE_ENABLE_DEV_AUTH === 'true' &&
    import.meta.env.VITE_DEV_AUTH_EMAIL &&
    import.meta.env.VITE_DEV_AUTH_PASSWORD
  );

  const handleDevLogin = async () => {
    const { error } = await signIn(
      import.meta.env.VITE_DEV_AUTH_EMAIL,
      import.meta.env.VITE_DEV_AUTH_PASSWORD
    );

    if (error) {
      toast.error('Erro ao entrar como dev: ' + error.message);
      return;
    }

    toast.success('Modo dev liberado.');
    onOpenChange(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) {
        const isInvalidCreds = /invalid login credentials/i.test(error.message);
        if (isInvalidCreds && runtimeEnv.isPreview) {
          toast.error(
            'Credenciais inválidas. Atenção: no Preview (teste) sua conta pode não existir ainda — o login do site publicado não é compartilhado aqui.'
          );
        } else {
          toast.error('Erro ao entrar: ' + error.message);
        }
      } else {
        toast.success('Bem-vindo de volta!');
        onOpenChange(false);
        resetForm();
      }
    } else {
      const { error } = await signUp(email, password, displayName);
      if (error) {
        toast.error('Erro ao criar conta: ' + error.message);
      } else {
        toast.success('Conta criada com sucesso!');
        onOpenChange(false);
        resetForm();
      }
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            {mode === 'login' ? 'Entrar na sua conta' : 'Criar nova conta'}
          </DialogTitle>
        </DialogHeader>

        {runtimeEnv.isPreview && (
          <p className="text-xs text-muted-foreground text-center">
            Você está no <span className="font-medium text-foreground">Preview (teste)</span>. Logins/projetos do site publicado não são compartilhados aqui.
          </p>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {mode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="displayName">Nome</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="displayName"
                  type="text"
                  placeholder="Seu nome"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="pl-10"
              />
            </div>
          </div>
          
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {mode === 'login' ? 'Entrando...' : 'Criando...'}
              </>
            ) : (
              mode === 'login' ? 'Entrar' : 'Criar conta'
            )}
          </Button>

          {mode === 'login' && canUseDevAuth && (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={isLoading}
              onClick={handleDevLogin}
            >
              Entrar como dev
            </Button>
          )}
        </form>
        
        <div className="mt-4 text-center text-sm text-muted-foreground">
          {mode === 'login' ? (
            <>
              Não tem uma conta?{' '}
              <button
                type="button"
                onClick={toggleMode}
                className="text-primary hover:underline font-medium"
              >
                Criar conta
              </button>
            </>
          ) : (
            <>
              Já tem uma conta?{' '}
              <button
                type="button"
                onClick={toggleMode}
                className="text-primary hover:underline font-medium"
              >
                Entrar
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
