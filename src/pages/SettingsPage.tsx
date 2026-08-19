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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useUpdateProfile } from '@/hooks/useSupabaseMutations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Lock, Mail, User, ShieldAlert, Loader2, Sparkles, Server, Send, CheckCircle2, AlertTriangle, KeyRound, ListChecks, RefreshCw, Clock, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
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

  // SMTP Settings state
  const [smtpId, setSmtpId] = useState<string | null>(null);
  const [provider, setProvider] = useState<'smtp' | 'resend'>('smtp');
  const [senderName, setSenderName] = useState('Comisión Nacional de Riego - Monitoreo AGE');
  const [senderEmail, setSenderEmail] = useState('comision.nacional.riego@cnr.gob.cl');
  const [smtpHost, setSmtpHost] = useState('smtp.office365.com');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('comision.nacional.riego@cnr.gob.cl');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpSecure, setSmtpSecure] = useState<'tls' | 'ssl' | 'none'>('tls');
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [loadingSmtp, setLoadingSmtp] = useState(false);

  // Email Queue (Puente) state
  const [queueItems, setQueueItems] = useState<any[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);

  // Test Email Modal state
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [testTargetEmail, setTestTargetEmail] = useState('dafne.loyola@cnr.gob.cl');
  const [testEventType, setTestEventType] = useState('period_started');
  const [testPeriodName, setTestPeriodName] = useState('Primer Semestre 2026');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; error?: string } | null>(null);

  // Fetch email queue items
  const fetchQueue = async () => {
    if (userRole !== 'admin') return;
    setLoadingQueue(true);
    try {
      const { data, error } = await supabase
        .from('email_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setQueueItems(data || []);
    } catch (err: any) {
      console.error('Error al cargar cola de correos:', err.message);
    } finally {
      setLoadingQueue(false);
    }
  };

  const handleRequeue = async (id: string) => {
    try {
      const { error } = await supabase
        .from('email_queue')
        .update({ status: 'pending', attempts: 0, error_message: null })
        .eq('id', id);
      if (error) throw error;
      toast.success('Correo vuelto a poner en cola de procesamiento');
      fetchQueue();
    } catch (err: any) {
      toast.error('Error al reenviar a la cola: ' + err.message);
    }
  };

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

  // Fetch SMTP Settings
  const fetchSmtpSettings = async () => {
    if (userRole !== 'admin') return;
    setLoadingSmtp(true);
    try {
      const { data, error } = await supabase
        .from('email_smtp_settings')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setSmtpId(data.id);
        setProvider((data.provider as any) || 'smtp');
        setSenderName(data.sender_name || 'Comisión Nacional de Riego - Monitoreo AGE');
        setSenderEmail(data.sender_email || 'comision.nacional.riego@cnr.gob.cl');
        setSmtpHost(data.smtp_host || 'smtp.office365.com');
        setSmtpPort(data.smtp_port || 587);
        setSmtpUser(data.smtp_user || 'comision.nacional.riego@cnr.gob.cl');
        setSmtpPassword(data.smtp_password || '');
        setSmtpSecure((data.smtp_secure as any) || 'tls');
      }
    } catch (err: any) {
      toast.error('Error al cargar la configuración de servidor SMTP: ' + err.message);
    } finally {
      setLoadingSmtp(false);
    }
  };

  useEffect(() => {
    if (userRole === 'admin') {
      fetchConfigs();
      fetchSmtpSettings();
      fetchQueue();

      const channel = supabase
        .channel('email_queue_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'email_queue' }, () => {
          fetchQueue();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
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
      
      setEmailConfigs(prev => 
        prev.map(c => c.id === selectedConfig.id ? { ...selectedConfig, custom_cc: ccArray } : c)
      );
    } catch (err: any) {
      toast.error('Error al guardar la configuración: ' + err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveSmtp = async () => {
    setSavingSmtp(true);
    try {
      const payload = {
        provider,
        sender_name: senderName,
        sender_email: senderEmail,
        smtp_host: smtpHost,
        smtp_port: Number(smtpPort),
        smtp_user: smtpUser,
        smtp_password: smtpPassword,
        smtp_secure: smtpSecure,
        updated_at: new Date().toISOString()
      };

      if (smtpId) {
        const { error } = await supabase
          .from('email_smtp_settings')
          .update(payload)
          .eq('id', smtpId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('email_smtp_settings')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        if (data) setSmtpId(data.id);
      }

      toast.success('Configuración de Servidor SMTP guardada con éxito');
    } catch (err: any) {
      toast.error('Error al guardar configuración SMTP: ' + err.message);
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testTargetEmail || !testTargetEmail.includes('@')) {
      toast.error('Por favor ingresa una dirección de correo válida.');
      return;
    }

    setSendingTest(true);
    setTestResult(null);

    try {
      const subject = `[PRUEBA PUENTE] Alerta de prueba de envío - ${testPeriodName}`;
      const bodyHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8">
        <style>
          body { font-family: Segoe UI, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 20px; }
          .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
          .header { background: #0f172a; padding: 24px; text-align: center; color: #ffffff; }
          .test-badge { background: #0284c7; color: #ffffff; font-weight: bold; font-size: 11px; text-transform: uppercase; padding: 4px 10px; border-radius: 999px; display: inline-block; margin-bottom: 8px; }
          .content { padding: 24px; }
          .text-content { line-height: 1.6; margin-bottom: 24px; }
          .footer { background: #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }
        </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <div class="test-badge">Prueba de Envío por Servicio Puente (NTBK-Msilva)</div>
              <h2 style="margin:0;">Comisión Nacional de Riego</h2>
            </div>
            <div class="content">
              <div class="text-content">
                <p>Estimado/a usuario/a,</p>
                <p>Esta es una confirmación de prueba de envío de notificación procesada exitosamente a través del <strong>Servicio Puente Institucional (NTBK-Msilva.cnr.gob.cl)</strong>.</p>
                <p><strong>Detalles de la prueba:</strong></p>
                <ul>
                  <li><strong>Destinatario:</strong> ${testTargetEmail}</li>
                  <li><strong>Evento:</strong> ${testEventType}</li>
                  <li><strong>Período:</strong> ${testPeriodName}</li>
                  <li><strong>Fecha y Hora:</strong> ${new Date().toLocaleString('es-CL')}</li>
                </ul>
                <p>El servicio de alertas está funcionando correctamente.</p>
              </div>
            </div>
            <div class="footer">Sistema de Monitoreo de Indicadores AGE - CNR</div>
          </div>
        </body>
        </html>`;

      const { data, error } = await supabase
        .from('email_queue')
        .insert({
          event_type: testEventType,
          recipient_email: testTargetEmail,
          subject: subject,
          body_html: bodyHtml,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      setTestResult({
        success: true,
        message: `Correo de prueba encolado exitosamente (ID: ${data.id.substring(0, 8)}...). El Servicio Puente (NTBK-Msilva.cnr.gob.cl) lo procesará y enviará a ${testTargetEmail} en segundos.`
      });
      toast.success(`Prueba encolada para el servicio puente (${testTargetEmail})`);
      fetchQueue();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Error al encolar la prueba de correo',
        error: err.message
      });
      toast.error('Error en la prueba: ' + err.message);
    } finally {
      setSendingTest(false);
    }
  };

  const isAdmin = userRole === 'admin';

  return (
    <AppLayout>
      <PageHeader title="Configuración" description="Configuración de tu cuenta y del sistema" />

      <Tabs defaultValue="account" className="w-full">
        <TabsList className={`mb-6 grid w-full ${isAdmin ? 'grid-cols-3 max-w-xl' : 'grid-cols-1 max-w-xs'}`}>
          <TabsTrigger value="account" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Mi Cuenta
          </TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Alertas por Correo
              </TabsTrigger>
              <TabsTrigger value="queue" className="flex items-center gap-2">
                <ListChecks className="h-4 w-4" />
                Cola Notificaciones (Puente)
              </TabsTrigger>
            </>
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
          <TabsContent value="notifications" className="space-y-8">
            {/* Section 1: SMTP Server & Sender Configuration Card */}
            <div className="bg-card border rounded-2xl shadow-card overflow-hidden">
              <div className="border-b px-6 py-4 bg-muted/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 rounded-xl text-primary shrink-0">
                    <Server className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-foreground leading-none">
                      Servidor SMTP y Cuenta Remitente
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Parámetros de conexión y dirección de correo utilizada para emitir las alertas de notificación.
                    </p>
                  </div>
                </div>

                <Button
                  onClick={() => setIsTestDialogOpen(true)}
                  variant="outline"
                  size="sm"
                  className="border-primary/30 text-primary hover:bg-primary/10 font-bold shrink-0"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Probar Envío de Correo
                </Button>
              </div>

              <div className="p-6 space-y-6">
                {loadingSmtp ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                    <Loader2 className="animate-spin h-5 w-5 text-primary" />
                    <span className="text-sm">Cargando parámetros de servidor SMTP...</span>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Sender Name */}
                      <div className="space-y-2">
                        <Label htmlFor="sender-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Nombre del Remitente
                        </Label>
                        <Input
                          id="sender-name"
                          placeholder="Ej. Comisión Nacional de Riego - Monitoreo AGE"
                          value={senderName}
                          onChange={e => setSenderName(e.target.value)}
                        />
                        <p className="text-[10px] text-muted-foreground">Nombre visible en la casilla del destinatario.</p>
                      </div>

                      {/* Sender Email */}
                      <div className="space-y-2">
                        <Label htmlFor="sender-email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Cuenta de Correo Remitente
                        </Label>
                        <Input
                          id="sender-email"
                          type="email"
                          placeholder="comision.nacional.riego@cnr.gob.cl"
                          value={senderEmail}
                          onChange={e => setSenderEmail(e.target.value)}
                        />
                        <p className="text-[10px] text-muted-foreground">Dirección de correo desde la cual se emitirán los mensajes de alerta.</p>
                      </div>

                      {/* SMTP Host */}
                      <div className="space-y-2">
                        <Label htmlFor="smtp-host" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Servidor SMTP (Host)
                        </Label>
                        <Input
                          id="smtp-host"
                          placeholder="smtp.office365.com"
                          value={smtpHost}
                          onChange={e => setSmtpHost(e.target.value)}
                        />
                        <p className="text-[10px] text-muted-foreground">Servidor de correo de salida (ej. smtp.office365.com, mail.cnr.gob.cl).</p>
                      </div>

                      {/* SMTP Port */}
                      <div className="space-y-2">
                        <Label htmlFor="smtp-port" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Puerto SMTP
                        </Label>
                        <Input
                          id="smtp-port"
                          type="number"
                          placeholder="587"
                          value={smtpPort}
                          onChange={e => setSmtpPort(Number(e.target.value))}
                        />
                        <p className="text-[10px] text-muted-foreground">Puertos estándar: 587 (TLS/STARTTLS), 465 (SSL), 25 (Sin cifrado).</p>
                      </div>

                      {/* SMTP User */}
                      <div className="space-y-2">
                        <Label htmlFor="smtp-user" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Usuario SMTP
                        </Label>
                        <Input
                          id="smtp-user"
                          placeholder="comision.nacional.riego@cnr.gob.cl"
                          value={smtpUser}
                          onChange={e => setSmtpUser(e.target.value)}
                        />
                      </div>

                      {/* SMTP Password */}
                      <div className="space-y-2">
                        <Label htmlFor="smtp-password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Contraseña / Secreto SMTP
                        </Label>
                        <div className="relative">
                          <Input
                            id="smtp-password"
                            type="password"
                            placeholder="••••••••••••••••"
                            value={smtpPassword}
                            onChange={e => setSmtpPassword(e.target.value)}
                            className="pr-10"
                          />
                          <KeyRound className="h-4 w-4 text-muted-foreground absolute right-3 top-2.5 opacity-50" />
                        </div>
                      </div>

                      {/* Security */}
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Cifrado / Seguridad
                        </Label>
                        <Select value={smtpSecure} onValueChange={(val: any) => setSmtpSecure(val)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar seguridad" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tls">TLS / STARTTLS (Recomendado - Puerto 587)</SelectItem>
                            <SelectItem value="ssl">SSL (Puerto 465)</SelectItem>
                            <SelectItem value="none">Ninguna (Puerto 25)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Provider */}
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Modo de Envío Activo
                        </Label>
                        <Select value={provider} onValueChange={(val: any) => setProvider(val)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar proveedor" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="smtp">Servidor SMTP Directo Institucional</SelectItem>
                            <SelectItem value="resend">API Resend (Modo Sandbox / Integrado)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="pt-4 border-t flex justify-end">
                      <Button onClick={handleSaveSmtp} disabled={savingSmtp} size="sm">
                        {savingSmtp ? (
                          <>
                            <Loader2 className="animate-spin h-4 w-4 mr-2" />
                            Guardando...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Guardar Configuración SMTP
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Section 2: Templates & Dynamic Content Panel */}
            <div className="space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
                Personalización de Plantillas de Alerta
              </div>

              {loadingConfigs ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Loader2 className="animate-spin h-8 w-8 mb-2 text-primary" />
                  <p className="text-sm font-medium">Cargando configuraciones de alertas...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Notification List */}
                  <div className="lg:col-span-4 space-y-2">
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
                                  Guardar Configuración de Plantilla
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
            </div>
          </TabsContent>
        )}

        {/* Tab Notification Queue (Admin Only) */}
        {isAdmin && (
          <TabsContent value="queue" className="space-y-6">
            <div className="bg-card border rounded-2xl shadow-card p-6 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 rounded-xl text-primary shrink-0">
                    <ListChecks className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-foreground leading-none">
                      Cola de Notificaciones y Estado del Servicio Puente
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Monitoreo en tiempo real de los correos procesados por el servicio puente en <span className="font-semibold text-foreground">NTBK-Msilva.cnr.gob.cl</span>.
                    </p>
                  </div>
                </div>

                <Button onClick={fetchQueue} disabled={loadingQueue} variant="outline" size="sm" className="shrink-0">
                  <RefreshCw className={`h-4 w-4 mr-2 ${loadingQueue ? 'animate-spin' : ''}`} />
                  Actualizar Cola
                </Button>
              </div>

              {/* Stat summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">Pendientes</p>
                    <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-400 mt-1">
                      {queueItems.filter(i => i.status === 'pending' || i.status === 'processing').length}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-amber-500 opacity-60" />
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">Enviados (OK)</p>
                    <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">
                      {queueItems.filter(i => i.status === 'sent').length}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-emerald-500 opacity-60" />
                </div>

                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-rose-900 dark:text-rose-300 uppercase tracking-wider">Fallidos</p>
                    <p className="text-2xl font-extrabold text-rose-700 dark:text-rose-400 mt-1">
                      {queueItems.filter(i => i.status === 'failed').length}
                    </p>
                  </div>
                  <XCircle className="h-8 w-8 text-rose-500 opacity-60" />
                </div>
              </div>

              {/* Data Table */}
              <div className="border rounded-xl overflow-hidden bg-background">
                {loadingQueue ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                    <Loader2 className="animate-spin h-5 w-5 text-primary" />
                    <span className="text-xs font-semibold">Cargando cola de notificaciones...</span>
                  </div>
                ) : queueItems.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground space-y-1">
                    <ListChecks className="h-8 w-8 mx-auto opacity-40 mb-2" />
                    <p className="text-xs font-semibold text-foreground">No hay correos en la cola</p>
                    <p className="text-[11px]">Los correos generados por eventos de reportes o inicios de periodo aparecerán aquí.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold border-b">
                        <tr>
                          <th className="px-4 py-3">Estado</th>
                          <th className="px-4 py-3">Destinatario</th>
                          <th className="px-4 py-3">Asunto</th>
                          <th className="px-4 py-3">Evento</th>
                          <th className="px-4 py-3">Fecha Creación</th>
                          <th className="px-4 py-3 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {queueItems.map((item) => (
                          <tr key={item.id} className="hover:bg-muted/20 transition-all">
                            <td className="px-4 py-3 whitespace-nowrap">
                              {item.status === 'sent' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                  <CheckCircle className="h-3 w-3" />
                                  Enviado
                                </span>
                              )}
                              {(item.status === 'pending' || item.status === 'processing') && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                  <Clock className="h-3 w-3 animate-pulse" />
                                  {item.status === 'processing' ? 'Procesando...' : 'Pendiente'}
                                </span>
                              )}
                              {item.status === 'failed' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20" title={item.error_message}>
                                  <XCircle className="h-3 w-3" />
                                  Fallido
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                              {item.recipient_email}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground truncate max-w-xs">
                              {item.subject}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap font-mono text-[10px]">
                              {item.event_type}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                              {new Date(item.created_at).toLocaleString('es-CL')}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              {(item.status === 'failed' || item.status === 'pending') && (
                                <Button onClick={() => handleRequeue(item.id)} variant="ghost" size="sm" className="h-7 text-xs text-primary hover:bg-primary/10">
                                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                  Reencolar
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Modal / Dialog: Prueba de Envío de Correo */}
      <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-extrabold text-base">
              <Send className="h-5 w-5 text-primary" />
              Prueba de Envío de Correo de Alerta
            </DialogTitle>
            <DialogDescription className="text-xs">
              Envía un correo electrónico de prueba utilizando la cuenta remitente configurada (
              <span className="font-semibold text-foreground">{senderEmail}</span>) para validar la conectividad y el formato del mensaje.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Target Email Input */}
            <div className="space-y-2">
              <Label htmlFor="test-target-email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Cuenta de Correo de Destino
              </Label>
              <Input
                id="test-target-email"
                type="email"
                placeholder="dafne.loyola@cnr.gob.cl"
                value={testTargetEmail}
                onChange={e => setTestTargetEmail(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">Casilla que recibirá la alerta de prueba (ej. dafne.loyola@cnr.gob.cl).</p>
            </div>

            {/* Event Template Select */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Plantilla / Alerta a Probar
              </Label>
              <Select value={testEventType} onValueChange={setTestEventType}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar alerta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="period_started">Inicio Periodo de Reportabilidad Indicadores</SelectItem>
                  <SelectItem value="report_submitted">Reporte Enviado para Revisión</SelectItem>
                  <SelectItem value="report_returned">Reporte Devuelto con Observaciones</SelectItem>
                  <SelectItem value="report_approved">Reporte Aprobado / Cumplido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Period Name Input */}
            <div className="space-y-2">
              <Label htmlFor="test-period-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Nombre del Período (Dato Simulado)
              </Label>
              <Input
                id="test-period-name"
                value={testPeriodName}
                onChange={e => setTestPeriodName(e.target.value)}
              />
            </div>

            {/* Feedback alert box */}
            {testResult && (
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                  testResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="text-xs space-y-1">
                  <p className="font-bold">{testResult.message}</p>
                  {testResult.error && (
                    <p className="font-mono text-[10px] opacity-90 leading-relaxed bg-background/50 p-2 rounded border mt-1 select-text">
                      {testResult.error}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsTestDialogOpen(false)}>
              Cerrar
            </Button>
            <Button onClick={handleSendTestEmail} disabled={sendingTest} size="sm">
              {sendingTest ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  Enviando prueba...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Correo de Prueba
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
