import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Award, DollarSign, CheckCircle, Clock, ArrowRight } from "lucide-react";
import { formatCurrency, formatTime, formatDateExtended } from "@/lib/format";
import { useNavigate } from "react-router-dom";

interface Atendimento {
  id: string;
  data_hora: string;
  status: string;
  valor_repasse: number;
  protocolo: string;
  clientes: { nome: string } | null;
  certificados: { nome: string } | null;
  etiquetas: { nome: string; cor: string } | null;
}

const statusColors: Record<string, string> = {
  agendado: "bg-secondary text-secondary-foreground",
  concluido: "bg-success text-success-foreground",
  cancelado: "bg-destructive text-destructive-foreground",
};
const statusLabels: Record<string, string> = {
  agendado: "Agendado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export default function Dashboard() {
  const [metrics, setMetrics] = useState({ hoje: 0, mesEmitidos: 0, mesFaturamento: 0, totalConcluidos: 0 });
  const [todayAtendimentos, setTodayAtendimentos] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    const [todayRes, monthRes, totalRes, todayListRes] = await Promise.all([
      supabase.from("atendimentos").select("id", { count: "exact", head: true }).gte("data_hora", todayStart).lt("data_hora", todayEnd),
      supabase.from("atendimentos").select("valor_repasse, certificados(valor)").eq("status", "concluido").gte("data_hora", monthStart).lt("data_hora", monthEnd),
      supabase.from("atendimentos").select("id", { count: "exact", head: true }).eq("status", "concluido"),
      supabase.from("atendimentos").select("*, clientes(nome), certificados(nome), etiquetas(nome, cor)").gte("data_hora", todayStart).lt("data_hora", todayEnd).order("data_hora"),
    ]);

    const monthData = monthRes.data || [];
    setMetrics({
      hoje: todayRes.count || 0,
      mesEmitidos: monthData.length,
      mesFaturamento: monthData.reduce((s: number, a: any) => s + (Number(a.certificados?.valor) || 0), 0),
      totalConcluidos: totalRes.count || 0,
    });
    setTodayAtendimentos((todayListRes.data as any) || []);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  const metricCards = [
    { icon: Calendar, label: "Atendimentos hoje", value: metrics.hoje, gradient: "from-secondary/20 to-secondary/5", iconColor: "text-secondary" },
    { icon: Award, label: "Certificados no mês", value: metrics.mesEmitidos, gradient: "from-accent/20 to-accent/5", iconColor: "text-accent" },
    { icon: DollarSign, label: "Faturamento do mês", value: formatCurrency(metrics.mesFaturamento), gradient: "from-accent/20 to-accent/5", iconColor: "text-accent" },
    { icon: CheckCircle, label: "Concluídos total", value: metrics.totalConcluidos, gradient: "from-secondary/20 to-secondary/5", iconColor: "text-secondary" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {metricCards.map((m, i) => (
          <Card
            key={m.label}
            className="shadow-card hover:shadow-card-hover rounded-2xl border-border/50 transition-all duration-300 hover:-translate-y-0.5 overflow-hidden group"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <CardContent className="p-5 flex items-center gap-4 relative">
              <div className={`absolute inset-0 bg-gradient-to-br ${m.gradient} opacity-50 group-hover:opacity-80 transition-opacity duration-300`} />
              <div className={`relative p-3 rounded-xl bg-card shadow-sm ${m.iconColor}`}>
                <m.icon className="h-6 w-6" />
              </div>
              <div className="relative">
                <p className="text-sm text-muted-foreground">{m.label}</p>
                <p className="text-2xl font-bold text-foreground">{m.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3 shadow-card rounded-2xl border-border/50 animate-slide-up">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-secondary" />
              Agenda de Hoje — {formatDateExtended(new Date())}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayAtendimentos.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Nenhum atendimento agendado para hoje</p>
                <Button variant="outline" className="mt-4 rounded-xl" onClick={() => navigate("/agenda")}>
                  Ir para a Agenda <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {todayAtendimentos.map((a, i) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-4 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-all duration-200 hover:shadow-sm group/item"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <span className="text-sm font-semibold text-secondary min-w-[50px]">{formatTime(a.data_hora)}</span>
                    <span className="font-medium text-foreground flex-1 group-hover/item:text-secondary transition-colors">{a.clientes?.nome || "—"}</span>
                    <span className="text-sm text-muted-foreground">{a.certificados?.nome || "—"}</span>
                    {a.etiquetas && (
                      <Badge style={{ backgroundColor: a.etiquetas.cor }} className="text-[11px] border-0 text-primary-foreground">{a.etiquetas.nome}</Badge>
                    )}
                    <Badge className={`${statusColors[a.status]} text-[11px] border-0`}>{statusLabels[a.status]}</Badge>
                  </div>
                ))}
                <Button variant="outline" className="w-full mt-2 rounded-xl" onClick={() => navigate("/agenda")}>
                  Ver agenda completa <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-card rounded-2xl border-border/50 animate-slide-up" style={{ animationDelay: "100ms" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Atendimentos de Hoje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayAtendimentos.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum atendimento</p>
            ) : (
              todayAtendimentos.map((a, i) => (
                <Card key={a.id} className="shadow-card rounded-xl border-border/50 hover:shadow-card-hover transition-all duration-200">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <p className="font-semibold text-foreground">{a.clientes?.nome || "—"}</p>
                      <Badge className={`${statusColors[a.status]} text-[11px] border-0`}>{statusLabels[a.status]}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{formatTime(a.data_hora)} • {a.certificados?.nome || "—"}</p>
                    {a.etiquetas && (
                      <Badge style={{ backgroundColor: a.etiquetas.cor }} className="text-[11px] border-0 text-primary-foreground">{a.etiquetas.nome}</Badge>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
