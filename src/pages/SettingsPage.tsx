import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useUpdateProfile } from '@/hooks/useSupabaseMutations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Lock } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/constants';

export default function SettingsPage() {
  const { profile, userRole } = useAuth();
  const updateProfile = useUpdateProfile();
  const [name, setName] = useState(profile?.name ?? '');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const handleNameSave = () => {
    if (!profile) return;
    updateProfile.mutate({ id: profile.id, name, institution_id: profile.institution_id });
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return; }
    setPwLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      toast.success('Contraseña actualizada');
      setCurrentPw('');
      setNewPw('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Configuración" description="Configuración de tu cuenta" />

      <div className="grid gap-6 max-w-2xl">
        {/* Profile */}
        <div className="bg-card rounded-lg shadow-card p-6 space-y-4">
          <h2 className="text-base font-semibold text-foreground">Perfil</h2>
          <div className="space-y-3">
            <div>
              <Label>Nombre</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={profile?.email ?? ''} disabled className="bg-muted" />
            </div>
            <div>
              <Label>Rol</Label>
              <Input value={ROLE_LABELS[userRole as keyof typeof ROLE_LABELS] ?? userRole ?? ''} disabled className="bg-muted" />
            </div>
            <Button onClick={handleNameSave} disabled={updateProfile.isPending} size="sm">
              <Save className="h-4 w-4 mr-2" />
              {updateProfile.isPending ? 'Guardando...' : 'Guardar nombre'}
            </Button>
          </div>
        </div>

        {/* Password */}
        <div className="bg-card rounded-lg shadow-card p-6 space-y-4">
          <h2 className="text-base font-semibold text-foreground">Cambiar Contraseña</h2>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <div>
              <Label>Nueva contraseña</Label>
              <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} minLength={6} required />
            </div>
            <Button type="submit" disabled={pwLoading} size="sm">
              <Lock className="h-4 w-4 mr-2" />
              {pwLoading ? 'Actualizando...' : 'Cambiar contraseña'}
            </Button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
