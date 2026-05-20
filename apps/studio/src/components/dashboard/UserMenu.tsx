import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { usePixllandUserStore } from '@/stores/pixllandUserStore';
import { AuthModal } from '@/components/auth/AuthModal';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogIn, LogOut, User, Settings } from 'lucide-react';
import { toast } from 'sonner';

export function UserMenu() {
  const { user, profile, signOut, isLoading } = useAuthStore();
  const platformProfile = usePixllandUserStore((s) => s.profile);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    toast.success('Você saiu da conta');
  };

  const getInitials = (email: string) => email.substring(0, 2).toUpperCase();

  const displayName = platformProfile.displayName || profile.displayName || (user?.user_metadata?.full_name as string | undefined);
  const username = platformProfile.username || undefined;
  const avatarUrl = platformProfile.avatarUrl || profile.avatarUrl || (user?.user_metadata?.avatar_url as string | undefined);
  const coins = platformProfile.wallet.coins;
  const level = platformProfile.level;

  if (!user) {
    return (
      <>
        <Button 
          onClick={() => setAuthModalOpen(true)} 
          variant="default"
          className="gap-2"
        >
          <LogIn className="w-4 h-4" />
          Entrar
        </Button>
        <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {getInitials(user.email || 'US')}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <div className="flex items-center justify-start gap-2 p-2">
          <div className="flex flex-col space-y-1 leading-none">
            {displayName && (
              <p className="font-medium">{displayName}</p>
            )}
            {username && (
              <p className="text-xs text-muted-foreground">@{username}</p>
            )}
            <p className="w-[200px] truncate text-sm text-muted-foreground">
              {user.email}
            </p>
          </div>
        </div>
        {typeof coins === 'number' && (
          <div className="px-3 pb-2 text-sm text-primary font-semibold">{coins} moedas</div>
        )}
        {typeof level === 'number' && (
          <div className="px-3 pb-2 text-xs text-muted-foreground">Level {level}</div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer">
          <User className="mr-2 h-4 w-4" />
          Meu Perfil
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer">
          <Settings className="mr-2 h-4 w-4" />
          Configurações
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className="cursor-pointer text-destructive focus:text-destructive"
          onClick={handleSignOut}
          disabled={isLoading}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
