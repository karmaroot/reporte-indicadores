import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROLE_LABELS } from '@/lib/constants';
import { useInstitutions, useProfiles } from '@/hooks/useSupabaseQuery';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { UserCheck, ShieldAlert } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: {
    id: string;
    name: string;
    email: string | null;
    institution_id: string | null;
    role: string;
    institution_ids?: string[];
    subrogate_id?: string | null;
    is_subrogating?: boolean;
  } | null;
  onSave: (values: {
    id: string;
    name: string;
    email: string;
    institution_id: string | null;
    role: string;
    institution_ids?: string[];
    subrogate_id?: string | null;
    is_subrogating?: boolean;
  }) => void;
  loading?: boolean;
}

export function UserEditDialog({ open, onOpenChange, user, onSave, loading }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('informant');
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [institutionIds, setInstitutionIds] = useState<string[]>([]);
  const [subrogateId, setSubrogateId] = useState<string | null>(null);
  const [isSubrogating, setIsSubrogating] = useState<boolean>(false);

  const { data: institutions } = useInstitutions();
  const { data: allProfiles } = useProfiles();

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email ?? '');
      setRole(user.role);
      setInstitutionId(user.institution_id);
      setInstitutionIds(user.institution_ids ?? []);
      setSubrogateId(user.subrogate_id ?? null);
      setIsSubrogating(user.is_subrogating ?? false);
    }
  }, [user, open]);

  // Candidates for subrogate (excluding the current user being edited)
  const candidateSubrogates = (allProfiles ?? []).filter((p: any) => p.id !== user?.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    onSave({ 
      id: user.id, 
      name, 
      email,
      institution_id: role === 'jefatura' ? null : institutionId, 
      role,
      institution_ids: role === 'jefatura' ? institutionIds : [],
      subrogate_id: subrogateId,
      is_subrogating: isSubrogating
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-2xl border bg-card p-6 shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">Editar Usuario</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Nombre</Label>
              <Input value={name} onChange={e => setName(e.target.value)} required className="rounded-xl mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="rounded-xl mt-1" />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">Rol del Sistema</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-xl">
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-semibold">{role === 'jefatura' ? 'Centros de Responsabilidad' : 'Centro de Responsabilidad'}</Label>
            {role === 'jefatura' ? (
              <div className="mt-1 space-y-2 border rounded-xl p-3 max-h-36 overflow-y-auto bg-background/50">
                {(institutions ?? []).map(i => (
                  <div key={i.id} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`inst-${i.id}`} 
                      checked={institutionIds.includes(i.id)} 
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setInstitutionIds([...institutionIds, i.id]);
                        } else {
                          setInstitutionIds(institutionIds.filter(id => id !== i.id));
                        }
                      }} 
                    />
                    <Label htmlFor={`inst-${i.id}`} className="text-xs font-normal cursor-pointer">{i.name}</Label>
                  </div>
                ))}
                {(institutions ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">No hay centros registrados</p>
                )}
              </div>
            ) : (
              <Select value={institutionId ?? '_none'} onValueChange={v => setInstitutionId(v === '_none' ? null : v)}>
                <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="_none">Sin asignar</SelectItem>
                  {(institutions ?? []).map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Subrogancy Configuration Section */}
          <div className="border-t pt-3 mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-amber-500" /> Subrogancia del Usuario
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Asignar a un usuario reemplazante para recepcionar alertas y gestionar indicadores.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">{isSubrogating ? 'Activa' : 'Inactiva'}</span>
                <Switch checked={isSubrogating} onCheckedChange={setIsSubrogating} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground">Usuario Subrogante (Reemplazante)</Label>
              <Select value={subrogateId ?? '_none'} onValueChange={v => setSubrogateId(v === '_none' ? null : v)}>
                <SelectTrigger className="rounded-xl border-muted/50 bg-background/50 focus:ring-primary/20">
                  <SelectValue placeholder="Sin subrogante asignado" />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-48">
                  <SelectItem value="_none">Sin subrogante asignado</SelectItem>
                  {candidateSubrogates.map((cand: any) => {
                    const roleStr = cand.user_roles?.[0]?.role ?? cand.role ?? 'usuario';
                    return (
                      <SelectItem key={cand.id} value={cand.id}>
                        {cand.name} ({ROLE_LABELS[roleStr as keyof typeof ROLE_LABELS] || roleStr})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="rounded-xl font-semibold" disabled={loading}>{loading ? 'Guardando...' : 'Guardar Cambios'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
