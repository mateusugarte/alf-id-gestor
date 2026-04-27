import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Receipt, Copy, CheckCircle, Pencil } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";

interface Cobranca {
  id: string; data_hora: string; valor_repasse: number; protocolo: string; boleto_pago: boolean; status: string;
  clientes: { nome: string; telefone: string; email: string } | null;
  certificados: { nome: string } | null;
}

export default function Cobrancas() {
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Cobranca | null>(null);
  const [editValor, setEditValor] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editBoleto, setEditBoleto] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadCobrancas(); }, [dateFrom, dateTo, showAll]);

  const loadCobrancas = async () => {
    let query = supabase.from("atendimentos")
      .select("id, data_hora, valor_repasse, protocolo, boleto_pago, status, clientes(nome, telefone, email), certificados(nome)")
      .order("data_hora", { ascending: true });
    if (!showAll) {
      query = query.eq("boleto_pago", false).neq("status", "cancelado");
    }
    if (dateFrom) query = query.gte("data_hora", dateFrom);
    if (dateTo) query = query.lte("data_hora", dateTo + "T23:59:59");
    const { data } = await query;
    setCobrancas((data as any) || []);
    setLoading(false);
  };

  const marcarConcluidoEPago = async (id: string) => {
    await supabase.from("atendimentos").update({ boleto_pago: true, status: "concluido" }).eq("id", id);
    toast.success("Atendimento concluído e pagamento coletado!");
    loadCobrancas();
  };

  const marcarPago = async (id: string) => {
    await supabase.from("atendimentos").update({ boleto_pago: true }).eq("id", id);
    toast.success("Boleto marcado como pago!");
    loadCobrancas();
  };

  const copyContato = (c: Cobranca) => {
    const text = `${c.clientes?.nome || ""} - ${c.clientes?.telefone || ""} - ${c.clientes?.email || ""}`;
    navigator.clipboard.writeText(text);
    toast.success("Contato copiado!");
  };

  const diasAtraso = (dataHora: string) => {
    const diff = Date.now() - new Date(dataHora).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const openEdit = (c: Cobranca) => {
    setEditItem(c);
    setEditValor(String(c.valor_repasse || 0));
    setEditStatus(c.status || "concluido");
    setEditBoleto(c.boleto_pago || false);
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editItem) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("atendimentos").update({
        valor_repasse: parseFloat(editValor) || 0,
        status: editStatus,
        boleto_pago: editBoleto,
      }).eq("id", editItem.id);
      if (error) throw error;
      toast.success("Cobrança atualizada!");
      setEditOpen(false);
      loadCobrancas();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally { setSaving(false); }
  };

  const pendentesList = cobrancas.filter((c) => !c.boleto_pago && c.status !== "cancelado");
  const totalPendente = pendentesList.reduce((s, c) => s + (Number(c.valor_repasse) || 0), 0);
  const qtdPendentes = pendentesList.length;

  if (loading) return <Skeleton className="h-96 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Cobranças Pendentes</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-card rounded-2xl border-border/50 hover:shadow-card-hover transition-all duration-300 overflow-hidden group">
          <CardContent className="p-4 flex items-center gap-3 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-destructive/10 to-destructive/5 opacity-50 group-hover:opacity-80 transition-opacity duration-300" />
            <Receipt className="h-5 w-5 text-destructive relative z-10" />
            <div className="relative z-10">
              <p className="text-xs text-muted-foreground">Boletos pendentes</p>
              <p className="text-xl font-bold text-foreground">{qtdPendentes}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card rounded-2xl border-border/50 hover:shadow-card-hover transition-all duration-300 overflow-hidden group">
          <CardContent className="p-4 flex items-center gap-3 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-warning/10 to-warning/5 opacity-50 group-hover:opacity-80 transition-opacity duration-300" />
            <Receipt className="h-5 w-5 text-warning relative z-10" />
            <div className="relative z-10">
              <p className="text-xs text-muted-foreground">Valor total em aberto</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(totalPendente)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
        <Input type="date" className="w-auto rounded-xl" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Data início" />
        <Input type="date" className="w-auto rounded-xl" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Data fim" />
        {(dateFrom || dateTo) && (
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => { setDateFrom(""); setDateTo(""); }}>Limpar filtro</Button>
        )}
        <Button variant={showAll ? "default" : "outline"} size="sm" className="rounded-xl" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Ver só pendentes" : "Ver todos atendimentos"}
        </Button>
      </div>

      {cobrancas.length === 0 ? (
        <div className="text-center py-16 animate-fade-in">
          <CheckCircle className="h-16 w-16 mx-auto text-success/30 mb-4" />
          <p className="text-muted-foreground text-lg">Nenhuma cobrança pendente!</p>
        </div>
      ) : (
        <Card className="shadow-card rounded-2xl border-border/50 overflow-hidden animate-slide-up">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground">Cliente</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Telefone</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Protocolo</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Certificado</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Data</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Valor</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Atraso</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {cobrancas.map((c) => {
                  const dias = diasAtraso(c.data_hora);
                  return (
                    <tr key={c.id} className={`border-b hover:bg-muted/20 transition-colors duration-200 ${dias > 30 ? "bg-destructive/5" : ""}`}>
                      <td className="p-3 font-medium text-foreground">{c.clientes?.nome || "—"}</td>
                      <td className="p-3 text-muted-foreground">{c.clientes?.telefone || "—"}</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{c.protocolo}</td>
                      <td className="p-3 text-muted-foreground">{c.certificados?.nome || "—"}</td>
                      <td className="p-3 text-muted-foreground">{formatDate(c.data_hora)}</td>
                      <td className="p-3 text-right font-medium text-foreground">{formatCurrency(Number(c.valor_repasse))}</td>
                      <td className="p-3 text-right">
                        <Badge variant={dias > 30 ? "destructive" : "secondary"} className="text-[10px]">{dias}d</Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex gap-1 justify-end items-center flex-wrap">
                          <Badge className={`text-[10px] border-0 ${c.status === "concluido" ? "bg-success text-success-foreground" : c.status === "cancelado" ? "bg-destructive text-destructive-foreground" : "bg-secondary text-secondary-foreground"}`}>
                            {c.status}
                          </Badge>
                          <Badge className={`text-[10px] border-0 ${c.boleto_pago ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}`}>
                            {c.boleto_pago ? "Pago" : "Pendente"}
                          </Badge>
                          <Button size="sm" variant="ghost" className="h-7 rounded-lg" onClick={() => openEdit(c)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {!c.boleto_pago && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="default" className="text-xs h-7 rounded-lg">Concluir + Pago</Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="rounded-2xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar conclusão e pagamento</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Marcar atendimento de {c.clientes?.nome} como <strong>concluído</strong> e pagamento <strong>coletado</strong>?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                                  <AlertDialogAction className="rounded-xl" onClick={() => marcarConcluidoEPago(c.id)}>Confirmar</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 rounded-lg" onClick={() => copyContato(c)}><Copy className="h-3 w-3" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Editar Cobrança</DialogTitle></DialogHeader>
          {editItem && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Cliente: <span className="text-foreground font-medium">{editItem.clientes?.nome}</span> • {editItem.protocolo}</p>
              <div className="space-y-2">
                <Label>Valor de repasse (R$)</Label>
                <Input type="number" step="0.01" value={editValor} onChange={(e) => setEditValor(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agendado">Agendado</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={editBoleto} onChange={(e) => setEditBoleto(e.target.checked)} className="rounded" />
                <Label>Boleto pago</Label>
              </div>
              <Button onClick={handleEditSave} disabled={saving} className="w-full rounded-xl bg-gradient-to-r from-secondary to-secondary/80 hover:from-secondary/90 hover:to-secondary/70 transition-all duration-300">
                {saving ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
