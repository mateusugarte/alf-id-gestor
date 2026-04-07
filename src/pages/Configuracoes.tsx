import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";

interface Etiqueta {
  id: string; nome: string; cor: string; ativo: boolean;
}

const presetColors = ["#185FA5", "#0F6E56", "#E24B4A", "#EF9F27", "#0C2340", "#7C3AED", "#DB2777", "#059669"];

export default function Configuracoes() {
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Etiqueta | null>(null);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#185FA5");

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("etiquetas").select("*").order("nome");
    setEtiquetas((data as any) || []);
    setLoading(false);
  };

  const openModal = (e?: Etiqueta) => {
    if (e) { setEditing(e); setNome(e.nome); setCor(e.cor); }
    else { setEditing(null); setNome(""); setCor("#185FA5"); }
    setModalOpen(true);
  };

  const save = async () => {
    if (!nome) { toast.error("Nome é obrigatório"); return; }
    if (editing) {
      await supabase.from("etiquetas").update({ nome, cor }).eq("id", editing.id);
      toast.success("Etiqueta atualizada!");
    } else {
      await supabase.from("etiquetas").insert({ nome, cor });
      toast.success("Etiqueta criada!");
    }
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("etiquetas").delete().eq("id", id);
    toast.success("Etiqueta removida!");
    load();
  };

  if (loading) return <Skeleton className="h-64 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Configurações</h1>

      <Card className="shadow-card rounded-2xl border-border/50 animate-slide-up">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Etiquetas / Responsáveis</h2>
            <Button onClick={() => openModal()} className="rounded-xl bg-gradient-to-r from-secondary to-secondary/80 hover:from-secondary/90 hover:to-secondary/70 transition-all duration-300">
              <Plus className="h-4 w-4 mr-2" /> Nova Etiqueta
            </Button>
          </div>

          {etiquetas.length === 0 ? (
            <div className="text-center py-12 animate-fade-in">
              <Tag className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Nenhuma etiqueta cadastrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {etiquetas.map((e, i) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all duration-200 animate-fade-in"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <Badge style={{ backgroundColor: e.cor }} className="text-primary-foreground border-0 px-3">{e.nome}</Badge>
                    <span className="text-xs text-muted-foreground font-mono">{e.cor}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => openModal(e)}><Pencil className="h-3 w-3" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive rounded-lg"><Trash2 className="h-3 w-3" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir etiqueta?</AlertDialogTitle>
                          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                          <AlertDialogAction className="rounded-xl" onClick={() => remove(e.id)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Etiqueta" : "Nova Etiqueta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome do responsável</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" className="rounded-xl" /></div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {presetColors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCor(c)}
                    className={`w-8 h-8 rounded-full transition-all duration-200 ${cor === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:scale-105"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full" style={{ backgroundColor: cor }} />
              <Badge style={{ backgroundColor: cor }} className="text-primary-foreground border-0">{nome || "Preview"}</Badge>
            </div>
            <Button onClick={save} className="w-full rounded-xl bg-gradient-to-r from-secondary to-secondary/80 hover:from-secondary/90 hover:to-secondary/70 transition-all duration-300">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
