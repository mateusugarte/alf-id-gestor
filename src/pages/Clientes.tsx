import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, AlertCircle, Award, Search } from "lucide-react";
import { formatDate, formatCurrency, formatTime } from "@/lib/format";

interface Cliente {
  id: string; nome: string; telefone: string; email: string; cpf_cnpj: string; created_at: string;
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
    if (selected) openDetails(selected);
  };

  const filtered = clientes.filter((c) => {
    const q = search.toLowerCase();
    return c.nome.toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q) || (c.cpf_cnpj || "").includes(q);
  });

  const getInitials = (name: string) => name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const getColor = (name: string) => {
    const colors = ["bg-secondary", "bg-accent", "bg-warning", "bg-destructive"];
    return colors[name.charCodeAt(0) % colors.length];
  };

  if (loading) return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
        <span className="text-sm text-muted-foreground">{metrics.total} clientes</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: Users, label: "Total de clientes", value: metrics.total },
          { icon: AlertCircle, label: "Boletos pendentes", value: metrics.pendentes },
          { icon: Award, label: "Certificados ativos", value: metrics.ativos },
        ].map((m) => (
          <Card key={m.label} className="shadow-card rounded-xl">
            <CardContent className="p-4 flex items-center gap-3">
              <m.icon className="h-5 w-5 text-secondary" />
              <div>
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-xl font-bold text-foreground">{m.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar por nome, email ou CPF/CNPJ..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {filtered.map((c) => (
          <Card key={c.id} className="shadow-card rounded-xl hover:shadow-card-hover transition-shadow cursor-pointer" onClick={() => openDetails(c)}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${getColor(c.nome)} flex items-center justify-center text-primary-foreground font-bold text-sm`}>
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

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.nome}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Email:</span> {selected.email || "—"}</div>
                <div><span className="text-muted-foreground">Telefone:</span> {selected.telefone || "—"}</div>
                <div><span className="text-muted-foreground">CPF/CNPJ:</span> {selected.cpf_cnpj || "—"}</div>
                <div><span className="text-muted-foreground">Cadastro:</span> {formatDate(selected.created_at)}</div>
              </div>
              <h3 className="font-semibold text-foreground">Histórico de Atendimentos</h3>
              {historico.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum atendimento encontrado</p>
              ) : (
                <div className="space-y-2">
                  {historico.map((a) => (
                    <div key={a.id} className="p-3 rounded-lg bg-muted/50 flex items-center justify-between gap-2 text-sm">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{a.protocolo}</span>
                          <Badge className={`${statusColors[a.status]} text-[10px] border-0`}>{a.status}</Badge>
                        </div>
                        <p className="text-foreground">{a.certificados?.nome} • {formatDate(a.data_hora)} {formatTime(a.data_hora)}</p>
                        <p className="text-muted-foreground">{formatCurrency(a.valor_repasse)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {a.etiquetas && <Badge style={{ backgroundColor: a.etiquetas.cor }} className="text-[10px] border-0 text-primary-foreground">{a.etiquetas.nome}</Badge>}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleBoleto(a.id, !a.boleto_pago); }}
                          className={`text-xs px-2 py-1 rounded ${a.boleto_pago ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}
                        >
                          {a.boleto_pago ? "Pago" : "Pendente"}
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
    </div>
  );
}
