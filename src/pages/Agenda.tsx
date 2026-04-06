import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { formatTime, generateProtocolo, phoneMask, formatCurrency } from "@/lib/format";
import { toast } from "sonner";

interface Certificado { id: string; nome: string; valor: number; }
interface Etiqueta { id: string; nome: string; cor: string; }
interface Atendimento {
  id: string; data_hora: string; status: string; protocolo: string; valor_repasse: number;
  clientes: { nome: string } | null; certificados: { nome: string } | null; etiquetas: { nome: string; cor: string } | null;
}

function getWeekDays(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return Array.from({ length: 6 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd;
  });
}

const hours = Array.from({ length: 27 }, (_, i) => {
  const h = 7 + Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

const timeSlots = Array.from({ length: 53 }, (_, i) => {
  const h = 7 + Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

export default function Agenda() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

  const [formNome, setFormNome] = useState("");
  const [formTelefone, setFormTelefone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCertificado, setFormCertificado] = useState("");
  const [formValor, setFormValor] = useState("");
  const [formTemComissao, setFormTemComissao] = useState(false);
  const [formPercentual, setFormPercentual] = useState("");
  const [formEtiqueta, setFormEtiqueta] = useState("");
  const [saving, setSaving] = useState(false);

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    loadData();
  }, [currentDate]);

  const loadData = async () => {
    const start = weekDays[0].toISOString();
    const end = new Date(weekDays[5]);
    end.setDate(end.getDate() + 1);

    const [atRes, certRes, etiRes] = await Promise.all([
      supabase.from("atendimentos").select("*, clientes(nome), certificados(nome), etiquetas(nome, cor)").gte("data_hora", start).lt("data_hora", end.toISOString()).order("data_hora"),
      supabase.from("certificados").select("*").eq("ativo", true),
      supabase.from("etiquetas").select("*").eq("ativo", true),
    ]);

    setAtendimentos((atRes.data as any) || []);
    setCertificados((certRes.data as any) || []);
    setEtiquetas((etiRes.data as any) || []);
    setLoading(false);
  };

  const navigateWeek = (dir: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + dir * 7);
    setCurrentDate(d);
  };

  const goToday = () => setCurrentDate(new Date());

  const openModal = (date?: Date, time?: string) => {
    if (date) setSelectedDate(date.toISOString().split("T")[0]);
    if (time) setSelectedTime(time);
    setFormNome(""); setFormTelefone(""); setFormEmail(""); setFormCertificado("");
    setFormValor(""); setFormTemComissao(false); setFormPercentual(""); setFormEtiqueta("");
    setModalOpen(true);
  };

  const comissaoValor = formTemComissao && formPercentual && formValor
    ? (parseFloat(formValor) * parseFloat(formPercentual) / 100) : 0;

  const handleSave = async () => {
    if (!formNome || !selectedDate || !selectedTime || !formCertificado) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    setSaving(true);
    try {
      // Create or find client
      let clienteId: string;
      const { data: existingClients } = await supabase.from("clientes").select("id").or(`email.eq.${formEmail},telefone.eq.${formTelefone}`).limit(1);
      if (existingClients && existingClients.length > 0) {
        clienteId = existingClients[0].id;
      } else {
        const { data: newClient, error: cErr } = await supabase.from("clientes").insert({ nome: formNome, telefone: formTelefone, email: formEmail }).select("id").single();
        if (cErr) throw cErr;
        clienteId = newClient.id;
      }

      const protocolo = generateProtocolo();
      const dataHora = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();
      const valorRepasse = parseFloat(formValor) || 0;

      const { error } = await supabase.from("atendimentos").insert({
        cliente_id: clienteId,
        certificado_id: formCertificado,
        etiqueta_id: formEtiqueta || null,
        data_hora: dataHora,
        valor_repasse: valorRepasse,
        tem_comissao: formTemComissao,
        percentual_comissao: parseFloat(formPercentual) || 0,
        valor_comissao: comissaoValor,
        protocolo,
      });
      if (error) throw error;
      toast.success(`Atendimento agendado! Protocolo: ${protocolo}`);
      setModalOpen(false);
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const isToday = (d: Date) => {
    const t = new Date();
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
  };

  const getAtendimentosForSlot = (day: Date, hour: string) => {
    return atendimentos.filter((a) => {
      const d = new Date(a.data_hora);
      return d.getDate() === day.getDate() && d.getMonth() === day.getMonth() &&
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` === hour;
    });
  };

  const dayNames = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  if (loading) return <div className="space-y-4"><Skeleton className="h-12 rounded-xl" /><Skeleton className="h-[600px] rounded-xl" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
        <Button onClick={() => openModal()} className="bg-secondary hover:bg-secondary/90">
          <Plus className="h-4 w-4 mr-2" /> Agendar Atendimento
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => navigateWeek(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="outline" onClick={goToday}>Hoje</Button>
        <Button variant="outline" size="icon" onClick={() => navigateWeek(1)}><ChevronRight className="h-4 w-4" /></Button>
        <span className="text-sm text-muted-foreground font-medium">
          {weekDays[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} — {weekDays[5].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="grid grid-cols-[60px_repeat(6,1fr)] border-b">
          <div className="p-2" />
          {weekDays.map((d, i) => (
            <div key={i} className={`p-3 text-center border-l ${isToday(d) ? "bg-secondary/10" : ""}`}>
              <p className="text-xs text-muted-foreground">{dayNames[i]}</p>
              <p className={`text-lg font-bold ${isToday(d) ? "bg-secondary text-secondary-foreground rounded-full w-9 h-9 flex items-center justify-center mx-auto" : "text-foreground"}`}>
                {d.getDate()}
              </p>
            </div>
          ))}
        </div>

        <div className="max-h-[600px] overflow-y-auto">
          {hours.map((hour, hi) => (
            <div key={hour} className={`grid grid-cols-[60px_repeat(6,1fr)] ${hi % 2 === 0 ? "border-t" : "border-t border-border/50"}`}>
              <div className="p-1 text-xs text-muted-foreground text-right pr-2 pt-1">
                {hi % 2 === 0 ? hour : ""}
              </div>
              {weekDays.map((day, di) => {
                const slotAtendimentos = getAtendimentosForSlot(day, hour);
                return (
                  <div
                    key={di}
                    className={`border-l min-h-[32px] p-0.5 cursor-pointer hover:bg-muted/50 transition-colors ${isToday(day) ? "bg-secondary/5" : ""}`}
                    onClick={() => openModal(day, hour)}
                  >
                    {slotAtendimentos.map((a) => (
                      <div
                        key={a.id}
                        className="text-[10px] rounded p-1 mb-0.5 truncate text-primary-foreground"
                        style={{ backgroundColor: a.etiquetas?.cor || "hsl(var(--secondary))" }}
                      >
                        {a.clientes?.nome || "—"}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Atendimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do cliente *</Label>
              <Input value={formNome} onChange={(e) => setFormNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={formTelefone} onChange={(e) => setFormTelefone(phoneMask(e.target.value))} placeholder="(99) 99999-9999" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="email@exemplo.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Horário *</Label>
                <div className="max-h-32 overflow-y-auto grid grid-cols-4 gap-1 border rounded-lg p-2">
                  {timeSlots.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTime(t)}
                      className={`text-xs py-1.5 rounded-md transition-colors ${selectedTime === t ? "bg-secondary text-secondary-foreground font-medium" : "hover:bg-muted text-foreground"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo de certificado *</Label>
              <Select value={formCertificado} onValueChange={setFormCertificado}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {certificados.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome} {c.valor > 0 && `— ${formatCurrency(c.valor)}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor de repasse (R$)</Label>
              <Input type="number" step="0.01" value={formValor} onChange={(e) => setFormValor(e.target.value)} placeholder="0,00" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={formTemComissao} onCheckedChange={setFormTemComissao} />
              <Label>Tem comissão por venda?</Label>
            </div>
            {formTemComissao && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Percentual (%)</Label>
                  <Input type="number" step="0.01" value={formPercentual} onChange={(e) => setFormPercentual(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>Valor da comissão</Label>
                  <Input readOnly value={formatCurrency(comissaoValor)} className="bg-muted" />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={formEtiqueta} onValueChange={setFormEtiqueta}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {etiquetas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: e.cor }} />
                        {e.nome}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full bg-secondary hover:bg-secondary/90">
              {saving ? "Salvando..." : "Agendar Atendimento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
