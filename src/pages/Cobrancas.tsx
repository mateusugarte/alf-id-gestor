import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Receipt, Copy, CheckCircle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";

interface Cobranca {
  id: string; data_hora: string; valor_repasse: number; protocolo: string;
  clientes: { nome: string; telefone: string; email: string } | null;
  certificados: { nome: string } | null;
}

export default function Cobrancas() {
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCobrancas(); }, []);

  const loadCobrancas = async () => {
    const { data } = await supabase.from("atendimentos")
      .select("id, data_hora, valor_repasse, protocolo, clientes(nome, telefone, email), certificados(nome)")
      .eq("boleto_pago", false).eq("status", "concluido")
      .order("data_hora", { ascending: true });
    setCobrancas((data as any) || []);
    setLoading(false);
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

  const totalPendente = cobrancas.reduce((s, c) => s + (Number(c.valor_repasse) || 0), 0);

  if (loading) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Cobranças Pendentes</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-card rounded-xl">
          <CardContent className="p-4 flex items-center gap-3">
            <Receipt className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">Boletos pendentes</p>
              <p className="text-xl font-bold text-foreground">{cobrancas.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card rounded-xl">
          <CardContent className="p-4 flex items-center gap-3">
            <Receipt className="h-5 w-5 text-warning" />
            <div>
              <p className="text-xs text-muted-foreground">Valor total em aberto</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(totalPendente)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {cobrancas.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle className="h-16 w-16 mx-auto text-success/40 mb-4" />
          <p className="text-muted-foreground text-lg">Nenhuma cobrança pendente!</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
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
                    <tr key={c.id} className={`border-b hover:bg-muted/30 ${dias > 30 ? "bg-destructive/5" : ""}`}>
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
                        <div className="flex gap-1 justify-end">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="text-xs h-7">Pago</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar pagamento</AlertDialogTitle>
                                <AlertDialogDescription>Marcar o boleto de {c.clientes?.nome} como pago?</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => marcarPago(c.id)}>Confirmar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => copyContato(c)}><Copy className="h-3 w-3" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
