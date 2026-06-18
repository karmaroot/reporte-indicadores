import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useUpdateProfile } from '@/hooks/useSupabaseMutations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Lock, Mail, User, ShieldAlert, Loader2, Sparkles } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/constants';

const PLACEHOLDERS = [
  { key: '{{recipient_name}}', label: 'Nombre del Destinatario' },
  { key: '{{indicator_name}}', label: 'Nombre del Indicador' },
  { key: '{{instrument_name}}', label: 'Nombre del Instrumento' },
  { key: '{{period_name}}', label: 'Nombre del Período' },
  { key: '{{reported_value}}', label: 'Valor Reportado' },
  { key: '{{comments}}', label: 'Comentarios / Observación' },
  { key: '{{reviewer_name}}', label: 'Nombre del Revisor' },
  { key: '{{informant_name}}', label: 'Nombre del Informante' }
];

export default function SettingsPage() {
  const { profile, userRole } = useAuth();
  const updateProfile = useUpdateProfile();
  const [name, setName] = useState(profile?.name ?? '');
  const [newPw, setNewPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Email config state
  const [emailConfigs, setEmailConfigs] = useState<any[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<any | null>(null);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [ccString, setCcString] = useState('');
  const [lastFocusedField, setLastFocusedField] = useState<'subject' | 'body'>('body');

  const handleNameSave = () => {
    if (!profile) return;
    updateProfile.mutate({ id: profile.id, name, institution_id: profile.institution_id });
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setPwLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      toast.success('Contraseña actualizada');
      setNewPw('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPwLoading(false);
    }
  };

  // Fetch email notification configurations
  const fetchConfigs = async () => {
    if (userRole !== 'admin') return;
    setLoadingConfigs(true);
    try {
      const { data, error } = await supabase
        .from('email_notification_settings')
        .select('*')
        .order('display_name');
      if (error) throw error;
      setEmailConfigs(data || []);
      if (data && data.length > 0) {
        setSelectedConfig(data[0]);
      }
    } catch (err: any) {
      toast.error('Error al cargar la configuración de alertas: ' + err.message);
    } finally {
      setLoadingConfigs(false);
    }
  };

  useEffect(() => {
    if (userRole === 'admin') {
      fetchConfigs();
    }
  }, [userRole]);

  useEffect(() => {
    if (selectedConfig) {
      setCcString((selectedConfig.custom_cc || []).join(', '));
    } else {
      setCcString('');
    }
  }, [selectedConfig?.id]);

  const handleConfigChange = (field: string, value: any) => {
    if (!selectedConfig) return;
    setSelectedConfig((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleRoleToggle = (role: string, checked: boolean) => {
    if (!selectedConfig) return;
    const currentRoles = selectedConfig.notify_roles || [];
    let newRoles;
    if (checked) {
      newRoles = [...currentRoles, role];
    } else {
      newRoles = currentRoles.filter((r: string) => r !== role);
    }
    handleConfigChange('notify_roles', newRoles);
  };

  const insertPlaceholder = (placeholder: string) => {
    if (!selectedConfig) return;
    if (lastFocusedField === 'subject') {
      handleConfigChange('subject_template', (selectedConfig.subject_template || '') + placeholder);
    } else {
      handleConfigChange('body_template', (selectedConfig.body_template || '') + placeholder);
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedConfig) return;
    setSavingConfig(true);
    try {
      const ccArray = ccString
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0);

      const { error } = await supabase
        .from('email_notification_settings')
        .update({
          is_enabled: selectedConfig.is_enabled,
          subject_template: selectedConfig.subject_template,
          body_template: selectedConfig.body_template,
          notify_roles: selectedConfig.notify_roles,
          custom_cc: ccArray
        })
        .eq('id', selectedConfig.id);

      if (error) throw error;
      toast.success('Configuración de alerta actualizada con éxito');
      
      // Update local configs array
      setEmailConfigs(prev => 
        prev.map(c => c.id === selectedConfig.id ? { ...selectedConfig, custom_cc: ccArray } : c)
      );
    } catch (err: any) {
      toast.error('Error al guardar la configuración: ' + err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const isAdmin = userRole === 'admin';

  return (
    <AppLayout>
      <PageHeader title="Configuración" description="Configuración de tu cuenta y del sistema" />

      <Tabs defaultValue="account" className="w-full">
        <TabsList className={`mb-6 grid w-full ${isAdmin ? 'grid-cols-2 max-w-md' : 'grid-cols-1 max-w-xs'}`}>
          <TabsTrigger value="account" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Mi Cuenta
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Alertas por Correo
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab Account */}
        <TabsContent value="account">
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
        </TabsContent>

        {/* Tab Notifications (Admin Only) */}
        {isAdmin && (
          <TabsContent value="notifications">
            {loadingConfigs ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="animate-spin h-8 w-8 mb-2 text-primary" />
                <p className="text-sm font-medium">Cargando configuraciones de alertas...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Notification List */}
                <div className="lg:col-span-4 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1 mb-2">
                    Eventos Disponibles
                  </div>
                  {emailConfigs.map((config) => {
                    const isSelected = selectedConfig?.id === config.id;
                    return (
                      <button
                        key={config.id}
                        onClick={() => setSelectedConfig(config)}
                        className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-1.5 ${
                          isSelected
                            ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                            : 'border-border bg-card hover:bg-muted/30 hover:border-muted-foreground/20'
                        }`}
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className="font-bold text-sm text-foreground truncate">{config.display_name}</span>
                          <span className={`h-2 w-2 rounded-full shrink-0 ${config.is_enabled ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                        </div>
                        <span className="text-xs text-muted-foreground line-clamp-2 leading-snug">{config.description}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Notification Editor Panel */}
                <div className="lg:col-span-8">
                  {selectedConfig ? (
                    <div className="bg-card border rounded-2xl shadow-card overflow-hidden">
                      <div className="border-b px-6 py-5 bg-muted/20 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div>
                          <h3 className="font-extrabold text-base text-foreground leading-none">{selectedConfig.display_name}</h3>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1.5">{selectedConfig.event_type}</p>
                        </div>
                        <div className="flex items-center gap-2 bg-background/50 border px-3 py-1.5 rounded-full shadow-inner shrink-0">
                          <Switch
                            id="alert-enabled"
                            checked={selectedConfig.is_enabled}
                            onCheckedChange={(checked) => handleConfigChange('is_enabled', checked)}
                          />
                          <Label htmlFor="alert-enabled" className="text-xs font-bold cursor-pointer select-none">
                            {selectedConfig.is_enabled ? 'Activo' : 'Desactivado'}
                          </Label>
                        </div>
                      </div>

                      <div className="p-6 space-y-6">
                        {/* Notify Roles */}
                        <div className="space-y-2.5">
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Destinatarios por Rol</Label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <label className="flex items-center gap-3 p-3 rounded-lg border bg-background/40 hover:bg-muted/10 cursor-pointer transition-all">
                              <Checkbox
                                checked={(selectedConfig.notify_roles || []).includes('informant')}
                                onCheckedChange={(checked) => handleRoleToggle('informant', !!checked)}
                              />
                              <div className="text-xs">
                                <p className="font-bold text-foreground">Informante Asignado</p>
                                <p className="text-muted-foreground text-[10px]">Envía al usuario que reporta el indicador</p>
                              </div>
                            </label>

                            <label className="flex items-center gap-3 p-3 rounded-lg border bg-background/40 hover:bg-muted/10 cursor-pointer transition-all">
                              <Checkbox
                                checked={(selectedConfig.notify_roles || []).includes('reviewer')}
                                onCheckedChange={(checked) => handleRoleToggle('reviewer', !!checked)}
                              />
                              <div className="text-xs">
                                <p className="font-bold text-foreground">Revisor Asignado</p>
                                <p className="text-muted-foreground text-[10px]">Envía al evaluador asignado al indicador</p>
                              </div>
                            </label>

                            <label className="flex items-center gap-3 p-3 rounded-lg border bg-background/40 hover:bg-muted/10 cursor-pointer transition-all">
                              <Checkbox
                                checked={(selectedConfig.notify_roles || []).includes('jefatura')}
                                onCheckedChange={(checked) => handleRoleToggle('jefatura', !!checked)}
                              />
                              <div className="text-xs">
                                <p className="font-bold text-foreground">Jefatura</p>
                                <p className="text-muted-foreground text-[10px]">Envía a jefaturas de la misma área del informante</p>
                              </div>
                            </label>
                          </div>
                        </div>

                        {/* CC Input */}
                        <div className="space-y-2">
                          <Label htmlFor="custom-cc" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Enviar copia (CC) a</Label>
                          <Input
                            id="custom-cc"
                            placeholder="ejemplo1@correo.cl, ejemplo2@correo.cl (separar por comas)"
                            value={ccString}
                            onChange={(e) => setCcString(e.target.value)}
                          />
                          <p className="text-[10px] text-muted-foreground">Direcciones fijas que recibirán copia de este correo.</p>
                        </div>

                        {/* Subject */}
                        <div className="space-y-2">
                          <Label htmlFor="subject-template" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Asunto del Correo</Label>
                          <Input
                            id="subject-template"
                            value={selectedConfig.subject_template || ''}
                            onChange={(e) => handleConfigChange('subject_template', e.target.value)}
                            onFocus={() => setLastFocusedField('subject')}
                          />
                        </div>

                        {/* Body */}
                        <div className="space-y-2">
                          <Label htmlFor="body-template" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cuerpo del Correo (HTML/Texto)</Label>
                          <Textarea
                            id="body-template"
                            rows={6}
                            value={selectedConfig.body_template || ''}
                            onChange={(e) => handleConfigChange('body_template', e.target.value)}
                            onFocus={() => setLastFocusedField('body')}
                            className="font-mono text-xs leading-relaxed"
                          />
                        </div>

                        {/* Placeholders Helper */}
                        <div className="bg-muted/30 border rounded-xl p-4 space-y-3">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                            <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
                            Marcadores Dinámicos
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-normal">
                            Haz clic en cualquiera de los siguientes marcadores para insertarlo en la posición actual del campo enfocado (Asunto o Cuerpo):
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {PLACEHOLDERS.map((ph) => (
                              <button
                                key={ph.key}
                                onClick={() => insertPlaceholder(ph.key)}
                                className="text-[10px] font-semibold bg-background hover:bg-primary/10 hover:text-primary border hover:border-primary px-2.5 py-1.5 rounded-md shadow-sm transition-all flex items-center gap-1"
                              >
                                <code className="text-primary font-bold">{ph.key}</code>
                                <span className="text-muted-foreground/80">({ph.label})</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="pt-2 border-t flex justify-end">
                          <Button
                            onClick={handleSaveConfig}
                            disabled={savingConfig}
                            size="sm"
                          >
                            {savingConfig ? (
                              <>
                                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                                Guardando...
                              </>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-2" />
                                Guardar Configuración
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-20 border rounded-2xl bg-card border-dashed">
                      <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                      <p className="text-sm font-semibold text-foreground">Selecciona un evento</p>
                      <p className="text-xs text-muted-foreground mt-1">Elige un tipo de alerta de la lista izquierda para comenzar a personalizarla.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </AppLayout>
  );
}
