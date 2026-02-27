-- CodeMaster Database Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Usuários (alunos, professores, admins)
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(150) NOT NULL,
  email VARCHAR(200) UNIQUE NOT NULL,
  senha_hash VARCHAR(255),
  whatsapp VARCHAR(30),
  situacao_atual TEXT,
  tipo VARCHAR(20) DEFAULT 'aluno' CHECK (tipo IN ('aluno','professor','admin')),
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente','ativo','inativo')),
  data_criacao TIMESTAMP DEFAULT NOW()
);

-- Inscrições (leads antes de virar usuário)
CREATE TABLE IF NOT EXISTS inscricoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(150) NOT NULL,
  email VARCHAR(200) NOT NULL,
  whatsapp VARCHAR(30) NOT NULL,
  plano VARCHAR(100) NOT NULL,
  situacao_atual VARCHAR(100),
  metodo_pagamento VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente','aguardando_comprovativo','pago','cancelado')),
  observacoes TEXT,
  data_inscricao TIMESTAMP DEFAULT NOW()
);

-- Módulos do curso
CREATE TABLE IF NOT EXISTS modulos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  icone VARCHAR(10),
  ordem INT NOT NULL,
  ativo BOOLEAN DEFAULT true
);

-- Tópicos dentro dos módulos
CREATE TABLE IF NOT EXISTS topicos (
  id SERIAL PRIMARY KEY,
  modulo_id INT REFERENCES modulos(id) ON DELETE CASCADE,
  titulo VARCHAR(200) NOT NULL,
  descricao TEXT,
  ordem INT NOT NULL
);

-- Progresso dos alunos
CREATE TABLE IF NOT EXISTS progresso_aluno (
  id SERIAL PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  topico_id INT REFERENCES topicos(id) ON DELETE CASCADE,
  concluido BOOLEAN DEFAULT false,
  data_conclusao TIMESTAMP,
  UNIQUE(usuario_id, topico_id)
);

-- Anotações do professor sobre os alunos
CREATE TABLE IF NOT EXISTS anotacoes_professor (
  id SERIAL PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  professor_id UUID REFERENCES usuarios(id),
  conteudo TEXT NOT NULL,
  data_criacao TIMESTAMP DEFAULT NOW()
);

-- Seed: Módulos iniciais
INSERT INTO modulos (nome, descricao, icone, ordem) VALUES
  ('Lógica & Algoritmos', 'Desenvolver raciocínio lógico sólido', '🧠', 1),
  ('C++ — Fundamentos Fortes', 'Entender como a programação funciona por baixo', '⚙️', 2),
  ('Python Aplicado', 'Aplicar lógica em linguagem moderna e versátil', '🐍', 3),
  ('Projetos Práticos', 'Aprender fazendo com projetos reais', '🛠️', 4)
ON CONFLICT DO NOTHING;
