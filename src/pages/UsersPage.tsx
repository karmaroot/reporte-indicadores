import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Pencil, Plus, Trash2, UserCheck } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/constants';
import { useProfiles } from '@/hooks/useSupabaseQuery';
import { useUpdateUserRole, useUpdateProfile, useDeleteUser } from '@/hooks/useSupabaseMutations';
import { Skeleton } from '@/components/ui/skeleton';
import { UserEditDialog } from '@/components/dialogs/UserEditDialog';
import { CreateUserDialog } from '@/components/dialogs/CreateUserDialog';
import { DeleteConfirmDialog } from '@/components/dialogs/DeleteConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export default function UsersPage() {
  const { data: users, isLoading } = useProfiles();
  const updateRole = useUpdateUserRole();
  const updateProfile = useUpdateProfile();
  const deleteUser = useDeleteUser();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);

  const userMap = Object.fromEntries((users ?? []).map((u: any) => [u.id, u.name]));

  const filtered = (users ?? []).filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (values: { 
    id: string; 
    name: string; 
    email: string;
    institution_id: string | null; 
    role: string; 
    institution_ids?: string[];
    subrogate_id?: string | null;
    is_subrogating?: boolean;
  }) => {
    const currentRole = editing?.role;

    try {
      const res = await supabase.functions.invoke('update-user', {
        body: {
          userId: values.id,
          email: values.email,
          name: values.name,
          role: values.role,
          institution_id: values.institution_id,
          subrogate_id: values.subrogate_id,
          is_subrogating: values.is_subrogating
        }
      });
      if (res.error || res.data?.error) {
        console.warn("Edge function update-user return error, falling back to direct update:", res.error || res.data?.error);
        await updateProfile.mutateAsync({ 
          id: values.id, 
          name: values.name, 
          email: values.email,
          institution_id: values.institution_id,
          subrogate_id: values.subrogate_id,
          is_subrogating: values.is_subrogating
        });
        if (values.role !== currentRole) {
          await updateRole.mutateAsync({ userId: values.id, role: values.role as any });
        }
      }
    } catch (err) {
      console.warn("Error invoking update-user edge function, falling back to direct update:", err);
      await updateProfile.mutateAsync({ 
        id: values.id, 
        name: values.name, 
        email: values.email,
        institution_id: values.institution_id,
        subrogate_id: values.subrogate_id,
        is_subrogating: values.is_subrogating
      });
      if (values.role !== currentRole) {
        await updateRole.mutateAsync({ userId: values.id, role: values.role as any });
      }
    }

    // Sync user_institutions table
    const { error: delError } = await supabase
      .from('user_institutions')
      .delete()
      .eq('user_id', values.id);
    if (delError) console.error("Error deleting user_institutions:", delError);

    if (values.role === 'jefatura' && values.institution_ids && values.institution_ids.length > 0) {
      const records = values.institution_ids.map(instId => ({
        user_id: values.id,
        institution_id: instId
      }));
      const { error: insError } = await supabase
        .from('user_institutions')
        .insert(records);
      if (insError) console.error("Error inserting user_institutions:", insError);
    }

    qc.invalidateQueries({ queryKey: ['profiles'] });
    toast.success('Usuario actualizado exitosamente');
    setDialogOpen(false);
  };

  const handleCreateUser = async (values: { email: string; password: string; name: string; role: string; institution_id: string | null; institution_ids?: string[] }) => {
    setCreating(true);
    try {
      const res = await supabase.functions.invoke('create-user', {
        body: { 
          email: values.email, 
          password: values.password, 
          name: values.name,
          role: values.role,
          institution_id: values.institution_id,
          institution_ids: values.institution_ids
        },
      });
      if (res.error) throw new Error(res.error.message ?? 'Error al crear usuario');
      if (res.data?.error) throw new Error(res.data.error);

      qc.invalidateQueries({ queryKey: ['profiles'] });
      toast.success('Usuario creado exitosamente');
      setCreateOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Error al crear usuario');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (u: any) => {
    const role = u.user_roles?.[0]?.role ?? 'informant';
    setEditing({ 
      id: u.id, 
      name: u.name, 
      email: u.email, 
      institution_id: u.institution_id, 
      role,
      institution_ids: (u.user_institutions ?? []).map((ui: any) => ui.institution_id),
      subrogate_id: u.subrogate_id ?? null,
      is_subrogating: u.is_subrogating ?? false
    });
    setDialogOpen(true);
  };

  const openDelete = (u: any) => {
    setUserToDelete(u);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    await deleteUser.mutateAsync(userToDelete.id);
    setDeleteOpen(false);
    setUserToDelete(null);
  };

  return (
    <AppLayout>
      <PageHeader title="Usuarios" description="Gestión de usuarios y subrogancias del sistema">
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />Nuevo Usuario</Button>
      </PageHeader>

      <div className="bg-card rounded-lg shadow-card">
        <div className="p-4 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar usuarios..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">Nombre</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">Email</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">Rol</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">Subrogancia</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((u) => {
                  const role = (u as any).user_roles?.[0]?.role ?? 'informant';
                  const hasSubrogate = (u as any).is_subrogating && (u as any).subrogate_id;
                  const subrogateName = hasSubrogate ? userMap[(u as any).subrogate_id] : null;

                  return (
                    <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-medium text-primary">{u.name.split(' ').map((n: string) => n[0]).join('')}</span>
                          </div>
                          <span className="text-sm font-medium text-foreground">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                          {ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {hasSubrogate && subrogateName ? (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] font-semibold py-1 px-2.5 rounded-lg flex items-center gap-1.5 w-fit">
                            <UserCheck className="h-3 w-3" />
                            <span>Subrogante: {subrogateName}</span>
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Editar usuario y subrogancia">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40" 
                          onClick={() => openDelete(u)} 
                          title="Eliminar usuario"
                        >
                          <Trash2 className="h-4 w-4 text-rose-500" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <UserEditDialog open={dialogOpen} onOpenChange={setDialogOpen} user={editing} onSave={handleSave} loading={updateProfile.isPending || updateRole.isPending} />
      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onSave={handleCreateUser} loading={creating} />
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="¿Eliminar usuario?"
        description={`Estás seguro de que deseas eliminar al usuario ${userToDelete?.name ?? ''}? Esta acción no se puede deshacer.`}
        onConfirm={handleConfirmDelete}
        loading={deleteUser.isPending}
      />
    </AppLayout>
  );
}