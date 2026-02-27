-- migrations/002_conquistas_data.sql

-- Conquistas de Progresso
INSERT INTO conquistas (nome, descricao, icone, categoria, pontos, condicao_tipo, condicao_valor, ordem_exibicao) VALUES
('Primeiro Passo', 'Complete seu primeiro tópico', '🌱', 'progresso', 10, 'topicos_concluidos', 1, 1),
('Aprendiz Dedicado', 'Complete 10 tópicos', '📚', 'progresso', 20, 'topicos_concluidos', 10, 2),
('Conhecimento Acumulado', 'Complete 25 tópicos', '🧠', 'progresso', 30, 'topicos_concluidos', 25, 3),
('Mestre do Conhecimento', 'Complete 50 tópicos', '👨‍🎓', 'progresso', 50, 'topicos_concluidos', 50, 4),
('Lenda do Código', 'Complete todos os tópicos', '🏆', 'progresso', 100, 'topicos_concluidos', 999, 5);

-- Conquistas de Módulos
INSERT INTO conquistas (nome, descricao, icone, categoria, pontos, condicao_tipo, condicao_valor, ordem_exibicao) VALUES
('Base Forte', 'Complete o módulo de Lógica & Algoritmos', '🧩', 'modulo', 25, 'modulo_completo', 1, 6),
('C++ Warrior', 'Complete o módulo de C++', '⚙️', 'modulo', 25, 'modulo_completo', 2, 7),
('Python Master', 'Complete o módulo de Python', '🐍', 'modulo', 25, 'modulo_completo', 3, 8),
('Projetos Completos', 'Complete o módulo de Projetos Práticos', '🛠️', 'modulo', 25, 'modulo_completo', 4, 9),
('Full Stack Beginner', 'Complete todos os módulos', '🚀', 'modulo', 100, 'modulos_completos', 4, 10);

-- Conquistas de Streak (consistência)
INSERT INTO conquistas (nome, descricao, icone, categoria, pontos, condicao_tipo, condicao_valor, ordem_exibicao) VALUES
('Fogo Jovem', 'Estude por 3 dias consecutivos', '🔥', 'streak', 15, 'streak_dias', 3, 11),
('Determinado', 'Estude por 7 dias consecutivos', '⚡', 'streak', 30, 'streak_dias', 7, 12),
('Imparável', 'Estude por 15 dias consecutivos', '💪', 'streak', 50, 'streak_dias', 15, 13),
('Lenda da Consistência', 'Estude por 30 dias consecutivos', '👑', 'streak', 100, 'streak_dias', 30, 14);

-- Conquistas de Velocidade
INSERT INTO conquistas (nome, descricao, icone, categoria, pontos, condicao_tipo, condicao_valor, ordem_exibicao) VALUES
('Velocista', 'Complete 5 tópicos em um dia', '⚡', 'velocidade', 20, 'topicos_dia', 5, 15),
('Maratona de Código', 'Complete 10 tópicos em um dia', '🏃', 'velocidade', 40, 'topicos_dia', 10, 16);

-- Conquistas de Horário
INSERT INTO conquistas (nome, descricao, icone, categoria, pontos, condicao_tipo, ordem_exibicao) VALUES
('Coruja Noturna', 'Estude depois da meia-noite', '🦉', 'horario', 15, 'estudo_noturno', 17),
('Madrugador', 'Estude antes das 8h', '☀️', 'horario', 15, 'estudo_matinal', 18);

-- Conquistas Sociais
INSERT INTO conquistas (nome, descricao, icone, categoria, pontos, condicao_tipo, condicao_valor, ordem_exibicao) VALUES
('Ajudante', 'Responda 5 dúvidas de colegas', '🤝', 'social', 25, 'respostas_forum', 5, 19),
('Comunidade Ativa', 'Participe de 10 discussões', '💬', 'social', 30, 'participacoes', 10, 20);