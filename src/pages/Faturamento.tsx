import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, DollarSign, Receipt, TrendingUp, Percent } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface ResumoResp {
  etiqueta_nome: string;
  atendimentos: number;
  total_repasse: number;
  total_comissao: number;
}

export default function Faturamento() {
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [faturamento, setFaturamento] = useState(0);
  const [pendentes, setPendentes] = useState(0);
  const [totalRepasses, setTotalRepasses] = useState(0);
  const [totalComissoes, setTotalComissoes] = useState(0);
  const [porResp, setPorResp] = useState<ResumoResp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [month, year]);

  const loadData = async () => {
    setLoading(true);
    const start = new Date(year, month, 1).toISOString();
    const end = new Date(year, month + 1, 1).toISOString();

    const { data: atendimentos } = await supabase.from("atendimentos")
      .select("valor_repasse, valor_comissao, boleto_pago, status, etiqueta_id, etiquetas(nome)")
      .gte("data_hora", start).lt("data_hora", end);

    const list = (atendimentos as any) || [];
    const concluidos = list.filter((a: any) => a.status === "concluido");

    setFaturamento(concluidos.reduce((s: number, a: any) => s + (Number(a.valor_repasse) || 0), 0));
    setPendentes(concluidos.filter((a: any) => !a.boleto_pago).reduce((s: number, a: any) => s + (Number(a.valor_repasse) || 0), 0));
    setTotalRepasses(list.reduce((s: number, a: any) => s + (Number(a.valor_repasse) || 0), 0));
    setTotalComissoes(list.reduce((s: number, a: any) => s + (Number(a.valor_comissao) || 0), 0));

    // Group by responsável
    const grouped: Record<string, ResumoResp> = {};
    list.forEach((a: any) => {
      const nome = a.etiquetas?.nome || "Sem responsável";
      if (!grouped[nome]) grouped[nome] = { etiqueta_nome: nome, atendimentos: 0, total_repasse: 0, total_comissao: 0 };
      grouped[nome].atendimentos++;
      grouped[nome].total_repasse += Number(a.valor_repasse) || 0;
      grouped[nome].total_comissao += Number(a.valor_comissao) || 0;
    });
    setPorResp(Object.values(grouped));
    setLoading(false);
  };

  const navMonth = (dir: number) => {
    let m = month + dir;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  };

  const monthName = new Date(year, month).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  if (loading) return <Skeleton className="h-96 rounded-xl" />;

  const cards = [
    { icon: DollarSign, label: "Faturamento total", value: formatCurrency(faturamento), color: "text-accent" },
    { icon: Receipt, label: "Boletos não pagos", value: formatCurrency(pendentes), color: "text-destructive" },
    { icon: TrendingUp, label: "Total de repasses", value: formatCurrency(totalRepasses), color: "text-secondary" },
    { icon: Percent, label: "Total de comissões", value: formatCurrency(totalComissoes), color: "text-warning" },
  ];

  const totalAtend = porResp.reduce((s, r) => s + r.atendimentos, 0);
  const totalRep = porResp.reduce((s, r) => s + r.total_repasse, 0);
  const totalCom = porResp.reduce((s, r) => s + r.total_comissao, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Faturamento</h1>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium capitalize min-w-[140px] text-center">{monthName}</span>
          <Button variant="outline" size="icon" onClick={() => navMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="shadow-card rounded-xl">
            <CardContent className="p-4 flex items-center gap-3">
              <c.icon className={`h-5 w-5 ${c.color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-xl font-bold text-foreground">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card rounded-xl">
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-foreground">Repasses e Comissões por Responsável</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">Responsável</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Atendimentos</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Repasse</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Comissão</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {porResp.map((r) => (
                  <tr key={r.etiqueta_nome} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-medium text-foreground">{r.etiqueta_nome}</td>
                    <td className="p-3 text-right text-muted-foreground">{r.atendimentos}</td>
                    <td className="p-3 text-right text-foreground">{formatCurrency(r.total_repasse)}</td>
                    <td className="p-3 text-right text-foreground">{formatCurrency(r.total_comissao)}</td>
                    <td className="p-3 text-right font-semibold text-foreground">{formatCurrency(r.total_repasse + r.total_comissao)}</td>
                  </tr>
                ))}
                {porResp.length > 0 && (
                  <tr className="bg-muted/50 font-bold">
                    <td className="p-3 text-foreground">TOTAL</td>
                    <td className="p-3 text-right text-foreground">{totalAtend}</td>
                    <td className="p-3 text-right text-foreground">{formatCurrency(totalRep)}</td>
                    <td className="p-3 text-right text-foreground">{formatCurrency(totalCom)}</td>
                    <td className="p-3 text-right text-foreground">{formatCurrency(totalRep + totalCom)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {porResp.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">Nenhum dado para este mês</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
