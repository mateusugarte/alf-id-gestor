import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, AlertCircle, Award, Search, Plus, Pencil, Trash2, Mail, Phone, IdCard, Calendar, Hash, FileText, ChevronRight } from "lucide-react";
import { formatDate, formatCurrency, formatTime, phoneMask } from "@/lib/format";
import { toast } from "sonner";

interface Cliente {
  id: string; nome: string; telefone: string; email: string; cpf_cnpj: string; created_at: string; numero_pedido: string | null;
}
interface Atendimento {
  id: string; data_hora: string; status: string; protocolo: string; valor_repasse: number; boleto_pago: boolean;
  data_inicio_certificado: string | null; data_fim_certificado: string | null; numero_pedido: string | null;
  certificados: { nome: string } | null; etiquetas: { nome: string; cor: string } | null;
}
interface ClienteAgg extends Cliente {
  totalAtend: number;
  pendentes: number;
  ultimoAtend: string | null;
  ultimoStatus: string | null;
}

const statusColors: Record<string, string> = {
  agendado: "bg-secondary text-secondary-foreground",
  concluido: "bg-success text-success-foreground",
  cancelado: "bg-destructive text-destructive-foreground",
};

type FilterTab = "todos" | "pendentes" | "ativos";

export default function Clientes() {
  const [clientes, setClientes] = useState<ClienteAgg[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Cliente | null>(null);
  const [historico, setHistorico] = useState<Atendimento[]>([]);
  const [metrics, setMetrics] = useState({ total: 0, pendentes: 0, ativos: 0 });
  const [tab, setTab] = useState<FilterTab>("todos");
  const [newOpen, setNewOpen] = useState(false);
  const [formNome, setFormNome] = useState("");
  const [formTelefone, setFormTelefone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCpf, setFormCpf] = useState("");
  const [savingClient, setSavingClient] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [confirmDelClient, setConfirmDelClient] = useState<Cliente | null>(null);
  const [confirmDelAtend, setConfirmDelAtend] = useState<string | null>(null);

  useEffect(() => { loadClientes(); }, []);

  const loadClientes = async () => {
    const [{ data: cli }, { data: atend }] = await Promise.all([
      supabase.from("clientes").select("*").order("nome"),
      supabase.from("atendimentos").select("id, cliente_id, data_hora, status, boleto_pago, data_fim_certificado"),
    ]);
    const today = new Date().toISOString().split("T")[0];
    const byClient: Record<string, Atendimento[]> = {};
    (atend || []).forEach((a: any) => {
      if (!a.cliente_id) return;
      (byClient[a.cliente_id] ||= []).push(a);
    });
    let pendTotal = 0, ativosTotal = 0;
    const list: ClienteAgg[] = (cli || []).map((c: any) => {
      const arr = byClient[c.id] || [];
      const ord = [...arr].sort((a, b) => b.data_hora.localeCompare(a.data_hora));
      const pend = arr.filter((a) => !a.boleto_pago && a.status === "concluido").length;
      const ativos = arr.filter((a) => a.data_fim_certificado && a.data_fim_certificado >= today).length;
      pendTotal += pend;
      ativosTotal += ativos;
      return {
        ...c,
        totalAtend: arr.length,
        pendentes: pend,
        ultimoAtend: ord[0]?.data_hora || null,
        ultimoStatus: ord[0]?.status || null,
      };
    });
    setClientes(list);
    setMetrics({ total: list.length, pendentes: pendTotal, ativos: ativosTotal });
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

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return clientes.filter((c) => {
      if (q) {
        const match = c.nome.toLowerCase().includes(q)
          || (c.email || "").toLowerCase().includes(q)
          || (c.telefone || "").toLowerCase().includes(q)
          || (c.cpf_cnpj || "").includes(q);
        if (!match) return false;
      }
      if (tab === "pendentes" && c.pendentes === 0) return false;
      if (tab === "ativos" && c.totalAtend === 0) return false;
      return true;
    });
  }, [clientes, search, tab]);

  const getInitials = (name: string) => name.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const getColor = (name: string) => {
    const colors = ["bg-secondary", "bg-accent", "bg-warning", "bg-primary"];
    return colors[name.charCodeAt(0) % colors.length];
  };

  const handleNewClient = async () => {
    if (!formNome) { toast.error("Nome é obrigatório"); return; }
    setSavingClient(true);
    try {
      const payload = { nome: formNome, telefone: formTelefone, email: formEmail, cpf_cnpj: formCpf };
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
      setFormNome(""); setFormTelefone(""); setFormEmail(""); setFormCpf("");
      loadClientes();
      if (selected && editingClientId === selected.id) {
        setSelected({ ...selected, ...payload } as any);
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus clientes e veja o histórico de atendimentos</p>
        </div>
        <Button onClick={() => { setEditingClientId(null); setFormNome(""); setFormTelefone(""); setFormEmail(""); setFormCpf(""); setNewOpen(true); }} className="rounded-xl bg-gradient-to-r from-secondary to-secondary/80 hover:from-secondary/90 hover:to-secondary/70 transition-all duration-300">
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

      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10 rounded-xl" placeholder="Buscar por nome, email, telefone ou CPF/CNPJ..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as FilterTab)}>
          <TabsList className="rounded-xl">
            <TabsTrigger value="todos" className="rounded-lg">Todos</TabsTrigger>
            <TabsTrigger value="pendentes" className="rounded-lg">Com pendências</TabsTrigger>
            <TabsTrigger value="ativos" className="rounded-lg">Com atendimentos</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filtered.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="p-10 text-center space-y-2">
            <Users className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-medium text-foreground">Nenhum cliente encontrado</p>
            <p className="text-sm text-muted-foreground">Ajuste a busca ou cadastre um novo cliente.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c, i) => (
            <Card
              key={c.id}
              className="group shadow-card rounded-2xl border-border/50 hover:shadow-card-hover hover:border-secondary/40 transition-all duration-300 cursor-pointer hover:-translate-y-0.5 animate-fade-in overflow-hidden"
              style={{ animationDelay: `${i * 30}ms` }}
              onClick={() => openDetails(c)}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-xl ${getColor(c.nome)} flex items-center justify-center text-primary-foreground font-bold text-sm shadow-sm shrink-0`}>
                    {getInitials(c.nome)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{c.nome}</p>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <Mail className="h-3 w-3 shrink-0" /> {c.email || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3 shrink-0" /> {c.telefone || "—"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
                  <Badge variant="outline" className="rounded-md text-[10px] gap-1">
                    <FileText className="h-3 w-3" /> {c.totalAtend} {c.totalAtend === 1 ? "atendimento" : "atendimentos"}
                  </Badge>
                  {c.pendentes > 0 && (
                    <Badge className="rounded-md text-[10px] bg-destructive/15 text-destructive border-0 gap-1">
                      <AlertCircle className="h-3 w-3" /> {c.pendentes} pendente{c.pendentes > 1 ? "s" : ""}
                    </Badge>
                  )}
                  {c.ultimoAtend && (
                    <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {formatDate(c.ultimoAtend)}
                    </span>
                  )}
                </div>

                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs rounded-lg flex-1" onClick={(e) => { e.stopPropagation(); openEditClient(c); }}>
                    <Pencil className="h-3 w-3 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs rounded-lg flex-1 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); setConfirmDelClient(c); }}>
                    <Trash2 className="h-3 w-3 mr-1" /> Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Client detail */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selected && (
                <div className={`w-10 h-10 rounded-xl ${getColor(selected.nome)} flex items-center justify-center text-primary-foreground font-bold text-sm`}>
                  {getInitials(selected.nome)}
                </div>
              )}
              <span>{selected?.nome}</span>
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm p-3 rounded-xl bg-muted/30">
                <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> {selected.email || "—"}</div>
                <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {selected.telefone || "—"}</div>
                <div className="flex items-center gap-2"><IdCard className="h-3.5 w-3.5 text-muted-foreground" /> {selected.cpf_cnpj || "—"}</div>
                <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Cadastro: {formatDate(selected.created_at)}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openEditClient(selected)}>
                  <Pencil className="h-3 w-3 mr-1" /> Editar cliente
                </Button>
                <Button size="sm" variant="destructive" className="rounded-xl" onClick={() => setConfirmDelClient(selected)}>
                  <Trash2 className="h-3 w-3 mr-1" /> Excluir cliente
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Histórico de Atendimentos</h3>
                <Badge variant="outline" className="rounded-md">{historico.length}</Badge>
              </div>
              {historico.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed text-center">
                  <p className="text-muted-foreground text-sm">Nenhum atendimento registrado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {historico.map((a) => (
                    <div key={a.id} className="p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors duration-200 space-y-2">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs text-muted-foreground">{a.protocolo}</span>
                            <Badge className={`${statusColors[a.status]} text-[10px] border-0`}>{a.status}</Badge>
                            {a.numero_pedido && (
                              <Badge variant="outline" className="text-[10px] gap-1 rounded-md">
                                <Hash className="h-3 w-3" /> Pedido {a.numero_pedido}
                              </Badge>
                            )}
                            {a.etiquetas && <Badge style={{ backgroundColor: a.etiquetas.cor }} className="text-[10px] border-0 text-primary-foreground">{a.etiquetas.nome}</Badge>}
                          </div>
                          <p className="text-foreground text-sm">{a.certificados?.nome} • {formatDate(a.data_hora)} {formatTime(a.data_hora)}</p>
                          <p className="text-xs text-muted-foreground">Repasse: {formatCurrency(a.valor_repasse)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
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
                          className="ml-auto text-xs px-2 py-1 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors duration-200"
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
      <Dialog open={newOpen} onOpenChange={(o) => { setNewOpen(o); if (!o) setEditingClientId(null); }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>{editingClientId ? "Editar Cliente" : "Novo Cliente"}</DialogTitle></DialogHeader>
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
            <div className="space-y-2">
              <Label>CPF/CNPJ</Label>
              <Input value={formCpf} onChange={(e) => setFormCpf(e.target.value)} placeholder="000.000.000-00" className="rounded-xl" />
            </div>
            <p className="text-xs text-muted-foreground">
              O número do pedido é informado em cada atendimento, não no cadastro do cliente.
            </p>
            <Button onClick={handleNewClient} disabled={savingClient} className="w-full rounded-xl bg-gradient-to-r from-secondary to-secondary/80 hover:from-secondary/90 hover:to-secondary/70 transition-all duration-300">
              {savingClient ? "Salvando..." : (editingClientId ? "Salvar alterações" : "Adicionar Cliente")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelClient} onOpenChange={(o) => !o && setConfirmDelClient(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Atendimentos vinculados podem ficar sem referência.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClient} className="rounded-xl bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelAtend} onOpenChange={(o) => !o && setConfirmDelAtend(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir atendimento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAtend} className="rounded-xl bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
