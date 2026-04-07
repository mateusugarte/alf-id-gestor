import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Award } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";

interface Certificado {
  id: string; nome: string; descricao: string; valor: number; ativo: boolean;
}

export default function Certificados() {
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Certificado | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [ativo, setAtivo] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("certificados").select("*").order("nome");
    setCertificados((data as any) || []);
    setLoading(false);
  };

  const openModal = (cert?: Certificado) => {
    if (cert) {
      setEditing(cert); setNome(cert.nome); setDescricao(cert.descricao || ""); setValor(String(cert.valor)); setAtivo(cert.ativo);
    } else {
      setEditing(null); setNome(""); setDescricao(""); setValor(""); setAtivo(true);
    }
    setModalOpen(true);
  };

  const save = async () => {
    const payload = { nome, descricao, valor: parseFloat(valor) || 0, ativo };
    if (editing) {
      await supabase.from("certificados").update(payload).eq("id", editing.id);
      toast.success("Certificado atualizado!");
    } else {
      await supabase.from("certificados").insert(payload);
      toast.success("Certificado criado!");
    }
    setModalOpen(false);
    load();
  };

  const toggleAtivo = async (id: string, val: boolean) => {
    await supabase.from("certificados").update({ ativo: val }).eq("id", id);
    toast.success(val ? "Certificado ativado" : "Certificado desativado");
    load();
  };

  if (loading) return <div className="grid grid-cols-2 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Tipos de Certificado</h1>
        <Button onClick={() => openModal()} className="rounded-xl bg-gradient-to-r from-secondary to-secondary/80 hover:from-secondary/90 hover:to-secondary/70 transition-all duration-300">
          <Plus className="h-4 w-4 mr-2" /> Novo Certificado
        </Button>
      </div>

      {certificados.length === 0 ? (
        <div className="text-center py-16 animate-fade-in">
          <Award className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">Nenhum certificado cadastrado</p>
          <Button className="mt-4 rounded-xl bg-gradient-to-r from-secondary to-secondary/80" onClick={() => openModal()}>Criar primeiro certificado</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {certificados.map((c, i) => (
            <Card
              key={c.id}
              className="shadow-card rounded-2xl border-border/50 hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 overflow-hidden group animate-fade-in"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <CardContent className="p-5 space-y-3 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="flex items-start justify-between relative z-10">
                  <h3 className="font-bold text-foreground text-lg">{c.nome}</h3>
                  <Badge variant={c.ativo ? "default" : "secondary"} className={c.ativo ? "bg-success text-success-foreground border-0" : ""}>{c.ativo ? "Ativo" : "Inativo"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 relative z-10">{c.descricao || "—"}</p>
                <p className="text-2xl font-bold text-secondary relative z-10">{formatCurrency(Number(c.valor))}</p>
                <div className="flex gap-2 relative z-10">
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => openModal(c)}><Pencil className="h-3 w-3 mr-1" /> Editar</Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="rounded-lg">{c.ativo ? "Desativar" : "Ativar"}</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>{c.ativo ? "Desativar" : "Ativar"} certificado?</AlertDialogTitle>
                        <AlertDialogDescription>{c.ativo ? "O certificado não aparecerá mais para novos agendamentos." : "O certificado voltará a ficar disponível."}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                        <AlertDialogAction className="rounded-xl" onClick={() => toggleAtivo(c.id, !c.ativo)}>Confirmar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Certificado" : "Novo Certificado"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="e-CPF A1" className="rounded-xl" /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição do certificado" className="rounded-xl" /></div>
            <div className="space-y-2"><Label>Valor (R$)</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className="rounded-xl" /></div>
            <div className="flex items-center gap-3"><Switch checked={ativo} onCheckedChange={setAtivo} /><Label>Ativo</Label></div>
            <Button onClick={save} className="w-full rounded-xl bg-gradient-to-r from-secondary to-secondary/80 hover:from-secondary/90 hover:to-secondary/70 transition-all duration-300">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
