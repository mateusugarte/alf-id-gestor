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
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Plus, Clock, User, FileText } from "lucide-react";
import { formatTime, generateProtocolo, phoneMask, formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";

interface Certificado { id: string; nome: string; valor: number; }
interface Etiqueta { id: string; nome: string; cor: string; }
interface ClienteLite { id: string; nome: string; telefone: string | null; email: string | null; cpf_cnpj: string | null; numero_pedido: string | null; }
interface Atendimento {
  id: string; data_hora: string; status: string; protocolo: string; valor_repasse: number;
  boleto_pago: boolean; observacoes: string | null; tem_comissao: boolean; percentual_comissao: number; valor_comissao: number;
  data_inicio_certificado: string | null; data_fim_certificado: string | null; numero_pedido: string | null;
  clientes: { nome: string; telefone: string; email: string } | null;
  certificados: { nome: string } | null;
  etiquetas: { nome: string; cor: string } | null;
}

function getDaysInMonth(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: (Date | null)[] = [];
  // pad start with nulls (week starts Monday)
  let startDow = firstDay.getDay();
  if (startDow === 0) startDow = 7;
  for (let i = 1; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  // pad end
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

export default function Agenda() {
  const [currentMonth, setCurrentMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [loading, setLoading] = useState(true);

  // New appointment modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [formNome, setFormNome] = useState("");
  const [formTelefone, setFormTelefone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCpfCnpj, setFormCpfCnpj] = useState("");
  const [formCertificado, setFormCertificado] = useState("");
  const [formValor, setFormValor] = useState("");
  const [formTemComissao, setFormTemComissao] = useState(false);
  const [formPercentual, setFormPercentual] = useState("");
  const [formEtiqueta, setFormEtiqueta] = useState("");
  const [formObs, setFormObs] = useState("");
  const [formNumeroPedido, setFormNumeroPedido] = useState("");
  const [clienteMode, setClienteMode] = useState<"novo" | "existente">("novo");
  const [clienteBusca, setClienteBusca] = useState("");
  const [clienteResultados, setClienteResultados] = useState<ClienteLite[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteLite | null>(null);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailAtendimento, setDetailAtendimento] = useState<Atendimento | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const days = useMemo(() => getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth()), [currentMonth]);

  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => { loadData(); }, [currentMonth]);

  const loadData = async () => {
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString();
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1).toISOString();

    const [atRes, certRes, etiRes] = await Promise.all([
      supabase.from("atendimentos")
        .select("*, clientes(nome, telefone, email), certificados(nome), etiquetas(nome, cor)")
        .gte("data_hora", start).lt("data_hora", end).order("data_hora"),
      supabase.from("certificados").select("*").eq("ativo", true),
      supabase.from("etiquetas").select("*").eq("ativo", true),
    ]);

    setAtendimentos((atRes.data as any) || []);
    setCertificados((certRes.data as any) || []);
    setEtiquetas((etiRes.data as any) || []);
    setLoading(false);
  };

  const navigateMonth = (dir: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + dir, 1));
    setSelectedDays([]);
  };

  const goToday = () => {
    setCurrentMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    setSelectedDays([todayStr]);
  };

  const toggleDay = (d: Date) => {
    const key = d.toISOString().split("T")[0];
    setSelectedDays(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const getAtendimentosForDay = (d: Date) => {
    const key = d.toISOString().split("T")[0];
    return atendimentos.filter(a => a.data_hora.startsWith(key));
  };

  const openNewModal = (dateStr?: string) => {
    setEditingId(null);
    setSelectedDate(dateStr || "");
    setSelectedTime("");
    setFormNome(""); setFormTelefone(""); setFormEmail(""); setFormCpfCnpj("");
    setFormCertificado(""); setFormValor(""); setFormTemComissao(false);
    setFormPercentual(""); setFormEtiqueta(""); setFormObs(""); setFormNumeroPedido("");
    setClienteMode("novo");
    setClienteBusca(""); setClienteResultados([]); setClienteSelecionado(null);
    setModalOpen(true);
  };

  const openEditModal = async (a: Atendimento) => {
    setEditingId(a.id);
    // Buscar dados completos do cliente
    const { data: ats } = await supabase.from("atendimentos")
      .select("*, clientes(id, nome, telefone, email, cpf_cnpj, numero_pedido)")
      .eq("id", a.id).single();
    const cli = (ats as any)?.clientes;
    const dt = new Date(a.data_hora);
    const pad = (n: number) => String(n).padStart(2, "0");
    setSelectedDate(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`);
    setSelectedTime(`${pad(dt.getHours())}:${pad(dt.getMinutes())}`);
    setFormNome(cli?.nome || "");
    setFormTelefone(cli?.telefone || "");
    setFormEmail(cli?.email || "");
    setFormCpfCnpj(cli?.cpf_cnpj || "");
    setFormNumeroPedido(a.numero_pedido || cli?.numero_pedido || "");
    setFormCertificado((ats as any)?.certificado_id || "");
    setFormValor(String(a.valor_repasse || ""));
    setFormTemComissao(!!a.tem_comissao);
    setFormPercentual(String(a.percentual_comissao || ""));
    setFormEtiqueta((ats as any)?.etiqueta_id || "");
    setFormObs(a.observacoes || "");
    setClienteMode("existente");
    setClienteSelecionado(cli ? { id: cli.id, nome: cli.nome, telefone: cli.telefone, email: cli.email, cpf_cnpj: cli.cpf_cnpj, numero_pedido: cli.numero_pedido } : null);
    setClienteBusca(cli?.nome || "");
    setClienteResultados([]);
    setDetailOpen(false);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!detailAtendimento) return;
    const { error } = await supabase.from("atendimentos").delete().eq("id", detailAtendimento.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Atendimento excluído");
    setConfirmDeleteOpen(false);
    setDetailOpen(false);
    setDetailAtendimento(null);
    loadData();
  };

  const buscarClientes = async (termo: string) => {
    setClienteBusca(termo);
    if (!termo.trim() || termo.trim().length < 2) { setClienteResultados([]); return; }
    setBuscandoCliente(true);
    const { data } = await supabase.from("clientes")
      .select("id, nome, telefone, email, cpf_cnpj, numero_pedido")
      .ilike("nome", `%${termo.trim()}%`)
      .order("nome").limit(10);
    setClienteResultados((data as any) || []);
    setBuscandoCliente(false);
  };

  const selecionarCliente = (c: ClienteLite) => {
    setClienteSelecionado(c);
    setFormNome(c.nome);
    setFormTelefone(c.telefone || "");
    setFormEmail(c.email || "");
    setFormCpfCnpj(c.cpf_cnpj || "");
    setFormNumeroPedido(c.numero_pedido || "");
    setClienteResultados([]);
    setClienteBusca(c.nome);
  };

  const openDetail = (a: Atendimento) => {
    setDetailAtendimento(a);
    setDetailOpen(true);
  };

  const comissaoValor = formTemComissao && formPercentual && formValor
    ? (parseFloat(formValor) * parseFloat(formPercentual) / 100) : 0;

  const handleSave = async () => {
    if (clienteMode === "existente" && !clienteSelecionado) {
      toast.error("Selecione um cliente cadastrado"); return;
    }
    if (!formNome || !selectedDate || !selectedTime || !formCertificado) {
      toast.error("Preencha os campos obrigatórios"); return;
    }
    setSaving(true);
    try {
      let clienteId: string | null = null;

      if (clienteMode === "existente" && clienteSelecionado) {
        clienteId = clienteSelecionado.id;
        // Atualiza campos se preenchidos/alterados
        const updates: any = {};
        if (formTelefone && formTelefone !== (clienteSelecionado.telefone || "")) updates.telefone = formTelefone;
        if (formEmail && formEmail !== (clienteSelecionado.email || "")) updates.email = formEmail;
        if (formCpfCnpj && formCpfCnpj !== (clienteSelecionado.cpf_cnpj || "")) updates.cpf_cnpj = formCpfCnpj;
        if (formNumeroPedido) updates.numero_pedido = formNumeroPedido;
        if (Object.keys(updates).length > 0) {
          await supabase.from("clientes").update(updates).eq("id", clienteId);
        }
      } else {
        const { data: newC, error: cErr } = await supabase.from("clientes")
          .insert({ nome: formNome, telefone: formTelefone, email: formEmail, cpf_cnpj: formCpfCnpj, numero_pedido: formNumeroPedido || null })
          .select("id").single();
        if (cErr) throw cErr;
        clienteId = newC.id;
      }

      const protocolo = generateProtocolo();
      const dataHora = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();
      const valorRepasse = parseFloat(formValor) || 0;

      const { error } = await supabase.from("atendimentos").insert({
        cliente_id: clienteId, certificado_id: formCertificado,
        etiqueta_id: formEtiqueta || null, data_hora: dataHora,
        valor_repasse: valorRepasse, tem_comissao: formTemComissao,
        percentual_comissao: parseFloat(formPercentual) || 0,
        valor_comissao: comissaoValor, protocolo, observacoes: formObs || null, numero_pedido: formNumeroPedido || null,
      });
      if (error) throw error;
      toast.success(`Agendado! Protocolo: ${protocolo}`);
      setModalOpen(false);
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally { setSaving(false); }
  };

  const monthLabel = currentMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const dayNames = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  // Atendimentos for selected days
  const selectedAtendimentos = atendimentos.filter(a => {
    const key = a.data_hora.split("T")[0];
    return selectedDays.includes(key);
  }).sort((a, b) => a.data_hora.localeCompare(b.data_hora));

  if (loading) return <div className="space-y-4"><Skeleton className="h-12 rounded-2xl" /><Skeleton className="h-[500px] rounded-2xl" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
        <Button onClick={() => openNewModal(selectedDays[0])} className="rounded-xl bg-gradient-to-r from-secondary to-secondary/80 hover:from-secondary/90 hover:to-secondary/70 transition-all duration-300">
          <Plus className="h-4 w-4 mr-2" /> Agendar
        </Button>
      </div>

      {/* Month nav */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="rounded-xl" onClick={() => navigateMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="outline" className="rounded-xl" onClick={goToday}>Hoje</Button>
        <Button variant="outline" size="icon" className="rounded-xl" onClick={() => navigateMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
        <span className="text-sm text-muted-foreground font-medium capitalize">{monthLabel}</span>
      </div>

      {/* Calendar grid */}
      <div className="bg-card rounded-2xl shadow-card border border-border/50 overflow-hidden animate-fade-in">
        <div className="grid grid-cols-7">
          {dayNames.map(n => (
            <div key={n} className="p-2 text-center text-xs font-semibold text-muted-foreground border-b bg-muted/20">{n}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            if (!d) return <div key={`e${i}`} className="p-2 min-h-[80px] border-b border-r bg-muted/10" />;
            const key = d.toISOString().split("T")[0];
            const isToday = key === todayStr;
            const isSelected = selectedDays.includes(key);
            const dayAtendimentos = getAtendimentosForDay(d);
            return (
              <div
                key={key}
                onClick={() => toggleDay(d)}
                className={`p-1.5 min-h-[80px] border-b border-r cursor-pointer transition-all duration-200
                  ${isSelected ? "bg-secondary/10 ring-1 ring-inset ring-secondary shadow-sm" : "hover:bg-muted/30"}
                  ${isToday ? "bg-accent/5" : ""}`}
              >
                <span className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200
                  ${isToday ? "bg-secondary text-secondary-foreground shadow-sm" : "text-foreground"}`}>
                  {d.getDate()}
                </span>
                <div className="mt-0.5 space-y-0.5">
                  {dayAtendimentos.slice(0, 3).map(a => (
                    <div
                      key={a.id}
                      onClick={(e) => { e.stopPropagation(); openDetail(a); }}
                      className="text-[10px] rounded-md px-1 py-0.5 truncate text-primary-foreground cursor-pointer hover:opacity-80 transition-opacity duration-200"
                      style={{ backgroundColor: a.etiquetas?.cor || "hsl(var(--secondary))" }}
                    >
                      {formatTime(a.data_hora)} {a.clientes?.nome || "—"}
                    </div>
                  ))}
                  {dayAtendimentos.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">+{dayAtendimentos.length - 3} mais</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected days detail list */}
      {selectedDays.length > 0 && (
        <div className="bg-card rounded-2xl shadow-card border border-border/50 p-4 space-y-3 animate-slide-up">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">
              Atendimentos — {selectedDays.length === 1 ? formatDate(selectedDays[0]) : `${selectedDays.length} dias selecionados`}
            </h2>
            <Button size="sm" onClick={() => openNewModal(selectedDays[0])} className="rounded-xl bg-gradient-to-r from-secondary to-secondary/80">
              <Plus className="h-3 w-3 mr-1" /> Novo
            </Button>
          </div>
          {selectedAtendimentos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum atendimento nos dias selecionados</p>
          ) : (
            <div className="space-y-2">
              {selectedAtendimentos.map((a, i) => (
                <div
                  key={a.id}
                  onClick={() => openDetail(a)}
                  className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 cursor-pointer transition-all duration-200 animate-fade-in"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-10 rounded-full" style={{ backgroundColor: a.etiquetas?.cor || "hsl(var(--secondary))" }} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{a.clientes?.nome || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(a.data_hora)} • {a.certificados?.nome || "—"} • {a.protocolo}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[10px] border-0 ${a.status === "concluido" ? "bg-success text-success-foreground" : a.status === "cancelado" ? "bg-destructive text-destructive-foreground" : "bg-secondary text-secondary-foreground"}`}>
                      {a.status}
                    </Badge>
                    <span className="text-sm font-medium text-foreground">{formatCurrency(Number(a.valor_repasse))}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detail modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-secondary" /> Detalhes do Atendimento
            </DialogTitle>
          </DialogHeader>
          {detailAtendimento && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge className={`border-0 ${detailAtendimento.status === "concluido" ? "bg-success text-success-foreground" : detailAtendimento.status === "cancelado" ? "bg-destructive text-destructive-foreground" : "bg-secondary text-secondary-foreground"}`}>
                  {detailAtendimento.status}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground">{detailAtendimento.protocolo}</span>
                {detailAtendimento.etiquetas && (
                  <Badge style={{ backgroundColor: detailAtendimento.etiquetas.cor }} className="border-0 text-primary-foreground text-[10px]">
                    {detailAtendimento.etiquetas.nome}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2 rounded-lg bg-muted/30"><p className="text-muted-foreground text-xs">Cliente</p><p className="font-medium text-foreground">{detailAtendimento.clientes?.nome || "—"}</p></div>
                <div className="p-2 rounded-lg bg-muted/30"><p className="text-muted-foreground text-xs">Telefone</p><p className="font-medium text-foreground">{detailAtendimento.clientes?.telefone || "—"}</p></div>
                <div className="p-2 rounded-lg bg-muted/30"><p className="text-muted-foreground text-xs">Email</p><p className="font-medium text-foreground">{detailAtendimento.clientes?.email || "—"}</p></div>
                <div className="p-2 rounded-lg bg-muted/30"><p className="text-muted-foreground text-xs">Certificado</p><p className="font-medium text-foreground">{detailAtendimento.certificados?.nome || "—"}</p></div>
                <div className="p-2 rounded-lg bg-muted/30"><p className="text-muted-foreground text-xs">Data/Hora</p><p className="font-medium text-foreground">{formatDate(detailAtendimento.data_hora)} {formatTime(detailAtendimento.data_hora)}</p></div>
                <div className="p-2 rounded-lg bg-muted/30"><p className="text-muted-foreground text-xs">Valor Repasse</p><p className="font-medium text-foreground">{formatCurrency(Number(detailAtendimento.valor_repasse))}</p></div>
                {detailAtendimento.tem_comissao && (
                  <>
                    <div className="p-2 rounded-lg bg-muted/30"><p className="text-muted-foreground text-xs">Comissão</p><p className="font-medium text-foreground">{detailAtendimento.percentual_comissao}%</p></div>
                    <div className="p-2 rounded-lg bg-muted/30"><p className="text-muted-foreground text-xs">Valor Comissão</p><p className="font-medium text-foreground">{formatCurrency(Number(detailAtendimento.valor_comissao))}</p></div>
                  </>
                )}
                <div className="p-2 rounded-lg bg-muted/30"><p className="text-muted-foreground text-xs">Boleto</p><p className="font-medium text-foreground">{detailAtendimento.boleto_pago ? "Pago" : "Pendente"}</p></div>
                {detailAtendimento.numero_pedido && (
                  <div className="p-2 rounded-lg bg-muted/30"><p className="text-muted-foreground text-xs">Nº Pedido</p><p className="font-medium text-foreground">{detailAtendimento.numero_pedido}</p></div>
                )}
              </div>
              {detailAtendimento.observacoes && (
                <div className="p-2 rounded-lg bg-muted/30"><p className="text-muted-foreground text-xs">Observações</p><p className="text-foreground">{detailAtendimento.observacoes}</p></div>
              )}
              {detailAtendimento.data_inicio_certificado && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2 rounded-lg bg-muted/30"><p className="text-muted-foreground text-xs">Início Certificado</p><p className="font-medium text-foreground">{formatDate(detailAtendimento.data_inicio_certificado)}</p></div>
                  <div className="p-2 rounded-lg bg-muted/30"><p className="text-muted-foreground text-xs">Fim Certificado</p><p className="font-medium text-foreground">{formatDate(detailAtendimento.data_fim_certificado || "")}</p></div>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
                <Button
                  size="sm"
                  variant={detailAtendimento.status === "concluido" ? "outline" : "default"}
                  className="rounded-xl flex-1"
                  onClick={async () => {
                    const novoStatus = detailAtendimento.status === "concluido" ? "agendado" : "concluido";
                    const { error } = await supabase.from("atendimentos").update({ status: novoStatus }).eq("id", detailAtendimento.id);
                    if (error) { toast.error(error.message); return; }
                    toast.success(novoStatus === "concluido" ? "Atendimento concluído!" : "Marcado como agendado");
                    setDetailAtendimento({ ...detailAtendimento, status: novoStatus });
                    loadData();
                  }}
                >
                  {detailAtendimento.status === "concluido" ? "Reabrir atendimento" : "Marcar como concluído"}
                </Button>
                <Button
                  size="sm"
                  variant={detailAtendimento.boleto_pago ? "outline" : "default"}
                  className="rounded-xl flex-1"
                  onClick={async () => {
                    const novoPago = !detailAtendimento.boleto_pago;
                    const { error } = await supabase.from("atendimentos").update({ boleto_pago: novoPago }).eq("id", detailAtendimento.id);
                    if (error) { toast.error(error.message); return; }
                    toast.success(novoPago ? "Pagamento coletado!" : "Marcado como pendente");
                    setDetailAtendimento({ ...detailAtendimento, boleto_pago: novoPago });
                    loadData();
                  }}
                >
                  {detailAtendimento.boleto_pago ? "Desfazer pagamento" : "Marcar pagamento coletado"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New appointment modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader><DialogTitle>Novo Atendimento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Cliente: existente ou novo */}
            <div className="space-y-2 p-3 rounded-xl bg-muted/30 border border-border/50">
              <Label>Cliente já cadastrado?</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={clienteMode === "existente" ? "default" : "outline"}
                  className="rounded-xl flex-1"
                  onClick={() => {
                    setClienteMode("existente");
                    setClienteSelecionado(null);
                    setFormNome(""); setFormTelefone(""); setFormEmail(""); setFormCpfCnpj(""); setFormNumeroPedido("");
                    setClienteBusca(""); setClienteResultados([]);
                  }}
                >
                  Sim, buscar cliente
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={clienteMode === "novo" ? "default" : "outline"}
                  className="rounded-xl flex-1"
                  onClick={() => {
                    setClienteMode("novo");
                    setClienteSelecionado(null);
                    setFormNome(""); setFormTelefone(""); setFormEmail(""); setFormCpfCnpj(""); setFormNumeroPedido("");
                    setClienteBusca(""); setClienteResultados([]);
                  }}
                >
                  Não, criar novo
                </Button>
              </div>

              {clienteMode === "existente" && (
                <div className="space-y-2 pt-2">
                  <Label className="text-xs">Buscar pelo nome</Label>
                  <Input
                    value={clienteBusca}
                    onChange={(e) => buscarClientes(e.target.value)}
                    placeholder="Digite o nome do cliente..."
                    className="rounded-xl"
                  />
                  {buscandoCliente && <p className="text-xs text-muted-foreground">Buscando...</p>}
                  {clienteResultados.length > 0 && !clienteSelecionado && (
                    <div className="max-h-48 overflow-y-auto border border-border rounded-xl bg-card divide-y divide-border">
                      {clienteResultados.map(c => (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => selecionarCliente(c)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                        >
                          <p className="font-medium text-foreground">{c.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.cpf_cnpj || c.email || c.telefone || "Sem contato"}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                  {clienteSelecionado && (
                    <div className="p-2 rounded-xl bg-secondary/10 border border-secondary/30 text-sm">
                      <p className="font-medium text-foreground">✓ {clienteSelecionado.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {clienteSelecionado.cpf_cnpj || clienteSelecionado.email || clienteSelecionado.telefone || "Sem contato"}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs mt-1"
                        onClick={() => { setClienteSelecionado(null); setClienteBusca(""); setFormNome(""); }}
                      >
                        Trocar cliente
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {(clienteMode === "novo" || clienteSelecionado) && (
              <div className="space-y-2">
                <Label>Nome do cliente *</Label>
                <Input value={formNome} onChange={(e) => setFormNome(e.target.value)} placeholder="Nome completo" className="rounded-xl" disabled={clienteMode === "existente"} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={formTelefone} onChange={(e) => setFormTelefone(phoneMask(e.target.value))} placeholder="(99) 99999-9999" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="email@exemplo.com" className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>CPF/CNPJ</Label>
              <Input value={formCpfCnpj} onChange={(e) => setFormCpfCnpj(e.target.value)} placeholder="000.000.000-00" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Número de Pedido</Label>
              <Input value={formNumeroPedido} onChange={(e) => setFormNumeroPedido(e.target.value)} placeholder="Nº do pedido" className="rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Horário *</Label>
                <Input type="time" value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo de certificado *</Label>
              <Select value={formCertificado} onValueChange={setFormCertificado}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {certificados.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome} {c.valor > 0 && `— ${formatCurrency(c.valor)}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor de repasse (R$)</Label>
              <Input type="number" step="0.01" value={formValor} onChange={(e) => setFormValor(e.target.value)} placeholder="0,00" className="rounded-xl" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={formTemComissao} onCheckedChange={setFormTemComissao} />
              <Label>Tem comissão por venda?</Label>
            </div>
            {formTemComissao && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Percentual (%)</Label>
                  <Input type="number" step="0.01" value={formPercentual} onChange={(e) => setFormPercentual(e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Valor da comissão</Label>
                  <Input readOnly value={formatCurrency(comissaoValor)} className="bg-muted rounded-xl" />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={formEtiqueta} onValueChange={setFormEtiqueta}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {etiquetas.map(e => (
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
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={formObs} onChange={(e) => setFormObs(e.target.value)} placeholder="Observações opcionais..." className="rounded-xl" />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full rounded-xl bg-gradient-to-r from-secondary to-secondary/80 hover:from-secondary/90 hover:to-secondary/70 transition-all duration-300">
              {saving ? "Salvando..." : "Agendar Atendimento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
