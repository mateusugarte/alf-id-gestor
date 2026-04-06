
CREATE TABLE IF NOT EXISTS public.certificados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.certificados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total autenticado" ON public.certificados
  FOR ALL USING (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS public.etiquetas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cor TEXT DEFAULT '#185FA5',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.etiquetas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total autenticado" ON public.etiquetas
  FOR ALL USING (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  cpf_cnpj TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total autenticado" ON public.clientes
  FOR ALL USING (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS public.atendimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  certificado_id UUID REFERENCES public.certificados(id) ON DELETE SET NULL,
  etiqueta_id UUID REFERENCES public.etiquetas(id) ON DELETE SET NULL,
  data_hora TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'agendado',
  valor_repasse NUMERIC(10,2) DEFAULT 0,
  tem_comissao BOOLEAN DEFAULT FALSE,
  percentual_comissao NUMERIC(5,2) DEFAULT 0,
  valor_comissao NUMERIC(10,2) DEFAULT 0,
  protocolo TEXT UNIQUE,
  boleto_pago BOOLEAN DEFAULT FALSE,
  data_inicio_certificado DATE,
  data_fim_certificado DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total autenticado" ON public.atendimentos
  FOR ALL USING (auth.role() = 'authenticated');
