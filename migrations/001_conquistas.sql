-- migrations/001_conquistas.sql

-- Tabela de conquistas disponíveis
CREATE TABLE conquistas (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  icone VARCHAR(50), -- Emoji ou nome do ícone
  categoria VARCHAR(50), -- 'progresso', 'streak', 'social', 'dedicacao'
  pontos INTEGER DEFAULT 10,
  condicao_tipo VARCHAR(50), -- 'topicos_concluidos', 'streak_dias', 'modulos_completos', etc
  condicao_valor INTEGER, -- quantidade necessária
  ordem_exibicao INTEGER DEFAULT 0,
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Conquistas dos usuários
CREATE TABLE conquistas_usuario (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  conquista_id INTEGER REFERENCES conquistas(id),
  data_obtencao TIMESTAMP DEFAULT NOW(),
  progresso_atual INTEGER DEFAULT 0,
  progresso_total INTEGER,
  notificacao_vista BOOLEAN DEFAULT false,
  UNIQUE(usuario_id, conquista_id)
);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conquistas_usuario_updated_at 
    BEFORE UPDATE ON conquistas_usuario 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_conquistas_usuario_usuario ON conquistas_usuario(usuario_id);
CREATE INDEX idx_conquistas_usuario_data ON conquistas_usuario(data_obtencao);
CREATE INDEX idx_conquistas_categoria ON conquistas(categoria);