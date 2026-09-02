import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { AlertTriangle, UserMinus, ShieldAlert } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/constants';

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { id: string; name: string; email: string; role: string } | null;
  availableUsers: { id: string; name: string; email: string; role?: string; user_roles?: any[] }[];
  onConfirm: (targetUserId: string, subrogateUserId: string) => Promise<void>;
  loading: boolean;
}

export function DeleteUserDialog({
  open,
  onOpenChange,
  user,
  availableUsers,
  onConfirm,
  loading,
}: DeleteUserDialogProps) {
  const [subrogateId, setSubrogateId] = useState<string>('');

  useEffect(() => {
    if (open) {
      setSubrogateId('');
    }
  }, [open]);

  if (!user) return null;

  // Filter out the user being deleted
  const candidates = availableUsers.filter((u) => u.id !== user.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subrogateId) return;
    await onConfirm(user.id, subrogateId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-2xl border bg-card p-6 shadow-xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 flex items-center justify-center">
              <UserMinus className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">Eliminar Usuario y Asignar Subrogante</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Reasignación de responsabilidades antes de la eliminación
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-3">
          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20 space-y-2">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-semibold text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Usuario a Eliminar:</span>
            </div>
            <div className="pl-6 text-xs space-y-0.5">
              <p className="font-bold text-foreground">{user.name}</p>
              <p className="text-muted-foreground">{user.email} • Rol: {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role}</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>Seleccionar Usuario Subrogante</span>
              <span className="text-[10px] text-muted-foreground font-normal">* Requerido</span>
            </label>
            <Select value={subrogateId} onValueChange={setSubrogateId}>
              <SelectTrigger className="rounded-xl border-muted/50 bg-background/50 focus:ring-primary/20 h-11">
                <SelectValue placeholder="Elegir usuario subrogante..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-60">
                {candidates.map((cand) => {
                  const roleStr = cand.role || (cand.user_roles?.[0]?.role) || 'usuario';
                  return (
                    <SelectItem key={cand.id} value={cand.id} className="rounded-lg text-xs py-2.5">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{cand.name}</span>
                        <span className="text-[10px] text-muted-foreground">{cand.email} • ({ROLE_LABELS[roleStr as keyof typeof ROLE_LABELS] || roleStr})</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
              Todas las asignaciones como <strong>Informante</strong> y <strong>Revisor</strong> de {user.name} serán transferidas automáticamente al subrogante seleccionado.
            </p>
          </div>

          <DialogFooter className="gap-2 pt-2 sm:gap-0">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="rounded-xl font-semibold bg-rose-600 hover:bg-rose-700 text-white"
              disabled={!subrogateId || loading}
            >
              {loading ? 'Reasignando y eliminando...' : 'Transferir Responsabilidades y Eliminar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
