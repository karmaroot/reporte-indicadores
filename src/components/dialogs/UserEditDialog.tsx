import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROLE_LABELS } from '@/lib/constants';
import { useInstitutions } from '@/hooks/useSupabaseQuery';
import { Checkbox } from '@/components/ui/checkbox';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: { id: string; name: string; email: string | null; institution_id: string | null; role: string; institution_ids?: string[] } | null;
  onSave: (values: { id: string; name: string; institution_id: string | null; role: string; institution_ids?: string[] }) => void;
  loading?: boolean;
}

export function UserEditDialog({ open, onOpenChange, user, onSave, loading }: Props) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('informant');
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [institutionIds, setInstitutionIds] = useState<string[]>([]);
  const { data: institutions } = useInstitutions();

  useEffect(() => {
    if (user) {
      setName(user.name);
      setRole(user.role);
      setInstitutionId(user.institution_id);
      setInstitutionIds(user.institution_ids ?? []);
    }
  }, [user, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    onSave({ 
      id: user.id, 
      name, 
      institution_id: role === 'jefatura' ? null : institutionId, 
      role,
      institution_ids: role === 'jefatura' ? institutionIds : []
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Usuario</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nombre</Label>
            <Input value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={user?.email ?? ''} disabled className="bg-muted" />
          </div>
          <div>
            <Label>Rol</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{role === 'jefatura' ? 'Centros de Responsabilidad' : 'Centro de Responsabilidad'}</Label>
            {role === 'jefatura' ? (
              <div className="mt-1.5 space-y-2 border rounded-md p-3 max-h-40 overflow-y-auto bg-background">
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
                    <Label htmlFor={`inst-${i.id}`} className="text-sm font-normal cursor-pointer">{i.name}</Label>
                  </div>
                ))}
                {(institutions ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">No hay centros registrados</p>
                )}
              </div>
            ) : (
              <Select value={institutionId ?? '_none'} onValueChange={v => setInstitutionId(v === '_none' ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sin asignar</SelectItem>
                  {(institutions ?? []).map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
