import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Users, AlertCircle, Award, Search, Plus, Pencil, Trash2 } from "lucide-react";
import { formatDate, formatCurrency, formatTime, phoneMask } from "@/lib/format";
import { toast } from "sonner";

interface Cliente {
  id: string; nome: string; telefone: string; email: string; cpf_cnpj: string; created_at: string; numero_pedido: string | null;
}
interface Atendimento {
  id: string; data_hora: string; status: string; protocolo: string; valor_repasse: number; boleto_pago: boolean;
  data_inicio_certificado: string | null; data_fim_certificado: string | null;
  certificados: { nome: string } | null; etiquetas: { nome: string; cor: string } | null;
}

const statusColors: Record<string, string> = {
  agendado: "bg-secondary text-secondary-foreground",
  concluido: "bg-success text-success-foreground",
  cancelado: "bg-destructive text-destructive-foreground",
};

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Cliente | null>(null);
  const [historico, setHistorico] = useState<Atendimento[]>([]);
  const [metrics, setMetrics] = useState({ total: 0, pendentes: 0, ativos: 0 });
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [formNome, setFormNome] = useState("");
  const [formTelefone, setFormTelefone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCpf, setFormCpf] = useState("");
  const [formNumeroPedido, setFormNumeroPedido] = useState("");
  const [savingClient, setSavingClient] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [confirmDelClient, setConfirmDelClient] = useState<Cliente | null>(null);
  const [confirmDelAtend, setConfirmDelAtend] = useState<string | null>(null);

  useEffect(() => { loadClientes(); }, []);

  const loadClientes = async () => {
    const { data } = await supabase.from("clientes").select("*").order("nome");
    const clienteList = (data || []) as Cliente[];
    setClientes(clienteList);
    const { count: pendentes } = await supabase.from("atendimentos").select("id", { count: "exact", head: true }).eq("boleto_pago", false).eq("status", "concluido");
    const { count: ativos } = await supabase.from("atendimentos").select("id", { count: "exact", head: true }).gte("data_fim_certificado", new Date().toISOString().split("T")[0]);
    setMetrics({ total: clienteList.length, pendentes: pendentes || 0, ativos: ativos || 0 });
    setLoading(false);
  };

  const openDetails = async (c: Cliente) => {
    setSelected(c);
    const { data } = await supabase.from("atendimentos").select("*, certificados(nome), etiquetas(nome, cor)").eq("cliente_id", c.id).order("data_hora", { ascending: false });
    setHistorico((data as any) || []);
  };

  const toggleBoleto = async (atId: string, val: boolean) => {
    await supabase.from("atendimentos").update({ boleto_pago: val }).eq("id", atId);
    toast.success(val ? "Pagamento coletado!" : "Marcado como pendente");
    if (selected) openDetails(selected);
    loadClientes();
  };

  const toggleConcluido = async (atId: string, atual: string) => {
    const novo = atual === "concluido" ? "agendado" : "concluido";
    await supabase.from("atendimentos").update({ status: novo }).eq("id", atId);
    toast.success(novo === "concluido" ? "Atendimento concluído!" : "Reaberto");
    if (selected) openDetails(selected);
    loadClientes();
  };

  const filtered = clientes.filter((c) => {
    const q = search.toLowerCase();
    const matchText = c.nome.toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q) || (c.cpf_cnpj || "").includes(q);
    if (!matchText) return false;
    if (dateFrom && c.created_at < dateFrom) return false;
    if (dateTo && c.created_at > dateTo + "T23:59:59") return false;
    return true;
  });

  const getInitials = (name: string) => name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const getColor = (name: string) => {
    const colors = ["bg-secondary", "bg-accent", "bg-warning", "bg-destructive"];
    return colors[name.charCodeAt(0) % colors.length];
  };

  const handleNewClient = async () => {
    if (!formNome) { toast.error("Nome é obrigatório"); return; }
    if (!editingClientId && !formNumeroPedido) { toast.error("Número do pedido é obrigatório"); return; }
    setSavingClient(true);
    try {
      const payload = { nome: formNome, telefone: formTelefone, email: formEmail, cpf_cnpj: formCpf, numero_pedido: formNumeroPedido || null };
      if (editingClientId) {
        const { error } = await supabase.from("clientes").update(payload).eq("id", editingClientId);
        if (error) throw error;
        toast.success("Cliente atualizado!");
      } else {
        const { error } = await supabase.from("clientes").insert(payload);
        if (error) throw error;
        toast.success("Cliente adicionado!");
      }
      setNewOpen(false);
      setEditingClientId(null);
      setFormNome(""); setFormTelefone(""); setFormEmail(""); setFormCpf(""); setFormNumeroPedido("");
      loadClientes();
      if (selected && editingClientId === selected.id) {
        setSelected({ ...selected, ...payload, numero_pedido: payload.numero_pedido } as any);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally { setSavingClient(false); }
  };

  const openEditClient = (c: Cliente) => {
    setEditingClientId(c.id);
    setFormNome(c.nome);
    setFormTelefone(c.telefone || "");
    setFormEmail(c.email || "");
    setFormCpf(c.cpf_cnpj || "");
    setFormNumeroPedido(c.numero_pedido || "");
    setNewOpen(true);
  };

  const handleDeleteClient = async () => {
    if (!confirmDelClient) return;
    const { error } = await supabase.from("clientes").delete().eq("id", confirmDelClient.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Cliente excluído");
    setConfirmDelClient(null);
    if (selected?.id === confirmDelClient.id) setSelected(null);
    loadClientes();
  };

  const handleDeleteAtend = async () => {
    if (!confirmDelAtend) return;
    const { error } = await supabase.from("atendimentos").delete().eq("id", confirmDelAtend);
    if (error) { toast.error(error.message); return; }
    toast.success("Atendimento excluído");
    setConfirmDelAtend(null);
    if (selected) openDetails(selected);
    loadClientes();
  };

  if (loading) return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
        <Button onClick={() => { setEditingClientId(null); setFormNome(""); setFormTelefone(""); setFormEmail(""); setFormCpf(""); setFormNumeroPedido(""); setNewOpen(true); }} className="rounded-xl bg-gradient-to-r from-secondary to-secondary/80 hover:from-secondary/90 hover:to-secondary/70 transition-all duration-300">
          <Plus className="h-4 w-4 mr-2" /> Novo Cliente
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: Users, label: "Total de clientes", value: metrics.total, color: "text-secondary", gradient: "from-secondary/15 to-secondary/5" },
          { icon: AlertCircle, label: "Boletos pendentes", value: metrics.pendentes, color: "text-destructive", gradient: "from-destructive/15 to-destructive/5" },
          { icon: Award, label: "Certificados ativos", value: metrics.ativos, color: "text-accent", gradient: "from-accent/15 to-accent/5" },
        ].map((m) => (
          <Card key={m.label} className="shadow-card rounded-2xl border-border/50 hover:shadow-card-hover transition-all duration-300 hover:-translate-y-0.5 overflow-hidden group">
            <CardContent className="p-4 flex items-center gap-3 relative">
              <div className={`absolute inset-0 bg-gradient-to-br ${m.gradient} opacity-50 group-hover:opacity-80 transition-opacity duration-300`} />
              <m.icon className={`h-5 w-5 ${m.color} relative z-10`} />
              <div className="relative z-10">
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-xl font-bold text-foreground">{m.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10 rounded-xl" placeholder="Buscar por nome, email ou CPF/CNPJ..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Input type="date" className="w-auto rounded-xl" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Data início" />
        <Input type="date" className="w-auto rounded-xl" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Data fim" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {filtered.map((c, i) => (
          <Card
            key={c.id}
            className="shadow-card rounded-2xl border-border/50 hover:shadow-card-hover transition-all duration-300 cursor-pointer hover:-translate-y-0.5 animate-fade-in"
            style={{ animationDelay: `${i * 40}ms` }}
            onClick={() => openDetails(c)}
          >
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${getColor(c.nome)} flex items-center justify-center text-primary-foreground font-bold text-sm shadow-sm`}>
                  {getInitials(c.nome)}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">{c.email || "—"}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{c.telefone || "—"}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Client detail */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader><DialogTitle>{selected?.nome}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Email:</span> {selected.email || "—"}</div>
                <div><span className="text-muted-foreground">Telefone:</span> {selected.telefone || "—"}</div>
                <div><span className="text-muted-foreground">CPF/CNPJ:</span> {selected.cpf_cnpj || "—"}</div>
                <div><span className="text-muted-foreground">Nº Pedido:</span> {selected.numero_pedido || "—"}</div>
                <div><span className="text-muted-foreground">Cadastro:</span> {formatDate(selected.created_at)}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openEditClient(selected)}>
                  <Pencil className="h-3 w-3 mr-1" /> Editar cliente
                </Button>
                <Button size="sm" variant="destructive" className="rounded-xl" onClick={() => setConfirmDelClient(selected)}>
                  <Trash2 className="h-3 w-3 mr-1" /> Excluir cliente
                </Button>
              </div>
              <h3 className="font-semibold text-foreground">Histórico de Atendimentos</h3>
              {historico.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum atendimento encontrado</p>
              ) : (
                <div className="space-y-2">
                  {historico.map((a) => (
                    <div key={a.id} className="p-3 rounded-xl bg-muted/40 flex items-center justify-between gap-2 text-sm hover:bg-muted/60 transition-colors duration-200">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{a.protocolo}</span>
                          <Badge className={`${statusColors[a.status]} text-[10px] border-0`}>{a.status}</Badge>
                        </div>
                        <p className="text-foreground">{a.certificados?.nome} • {formatDate(a.data_hora)} {formatTime(a.data_hora)}</p>
                        <p className="text-muted-foreground">{formatCurrency(a.valor_repasse)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {a.etiquetas && <Badge style={{ backgroundColor: a.etiquetas.cor }} className="text-[10px] border-0 text-primary-foreground">{a.etiquetas.nome}</Badge>}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleConcluido(a.id, a.status); }}
                          className={`text-xs px-2 py-1 rounded-lg transition-colors duration-200 ${a.status === "concluido" ? "bg-success/20 text-success" : "bg-secondary/20 text-secondary"}`}
                        >
                          {a.status === "concluido" ? "Concluído" : "Concluir"}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleBoleto(a.id, !a.boleto_pago); }}
                          className={`text-xs px-2 py-1 rounded-lg transition-colors duration-200 ${a.boleto_pago ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}
                        >
                          {a.boleto_pago ? "Pago" : "Coletar pgto"}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDelAtend(a.id); }}
                          className="text-xs px-2 py-1 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors duration-200"
                          title="Excluir atendimento"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New client modal */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={formNome} onChange={(e) => setFormNome(e.target.value)} placeholder="Nome completo" className="rounded-xl" />
            </div>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>CPF/CNPJ</Label>
                <Input value={formCpf} onChange={(e) => setFormCpf(e.target.value)} placeholder="000.000.000-00" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Nº Pedido *</Label>
                <Input value={formNumeroPedido} onChange={(e) => setFormNumeroPedido(e.target.value)} placeholder="Ex: 12345" className="rounded-xl" />
              </div>
            </div>
            <Button onClick={handleNewClient} disabled={savingClient} className="w-full rounded-xl bg-gradient-to-r from-secondary to-secondary/80 hover:from-secondary/90 hover:to-secondary/70 transition-all duration-300">
              {savingClient ? "Salvando..." : "Adicionar Cliente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
