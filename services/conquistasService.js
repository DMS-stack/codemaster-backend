// services/conquistasService.js
const pool = require('../db');

class ConquistasService {
  
  // Verificar conquistas do usuário após qualquer ação
  async verificarConquistas(usuarioId, tipoAcao, dados = {}) {
    try {
      console.log(`🔍 Verificando conquistas para ${usuarioId} - Ação: ${tipoAcao}`);
      
      switch(tipoAcao) {
        case 'topico_concluido':
          await this.verificarConquistasTopico(usuarioId);
          await this.verificarConquistasModulo(usuarioId);
          await this.verificarConquistasVelocidade(usuarioId);
          break;
        case 'login':
          await this.verificarConquistasStreak(usuarioId);
          await this.verificarConquistasHorario(usuarioId);
          break;
        case 'modulo_completo':
          await this.verificarConquistasTodosModulos(usuarioId);
          break;
        case 'forum_resposta':
          await this.verificarConquistasSociais(usuarioId);
          break;
      }
      
      // Buscar conquistas novas não vistas
      const novasConquistas = await this.buscarConquistasNovas(usuarioId);
      
      if (novasConquistas.length > 0) {
        console.log(`🎉 ${novasConquistas.length} novas conquistas para o usuário ${usuarioId}`);
      }
      
      return novasConquistas;
    } catch (error) {
      console.error('Erro ao verificar conquistas:', error);
      return [];
    }
  }

  // Verificar conquistas por número de tópicos
  async verificarConquistasTopico(usuarioId) {
    const { rows } = await pool.query(`
      SELECT COUNT(*) as total
      FROM progresso_aluno
      WHERE usuario_id = $1 AND concluido = true
    `, [usuarioId]);
    
    const totalTopicos = parseInt(rows[0].total);
    
    // Buscar conquistas baseadas em tópicos concluídos
    const conquistas = await pool.query(`
      SELECT * FROM conquistas 
      WHERE condicao_tipo = 'topicos_concluidos' 
      AND condicao_valor <= $1
      AND ativa = true
    `, [totalTopicos]);
    
    for (const conquista of conquistas.rows) {
      await this.atribuirConquista(usuarioId, conquista.id, totalTopicos, conquista.condicao_valor);
    }
  }

  // Verificar conquistas de módulos
  async verificarConquistasModulo(usuarioId) {
    // Verificar módulos completos
    const { rows } = await pool.query(`
      SELECT 
        m.id as modulo_id,
        m.nome as modulo_nome,
        COUNT(t.id) as total_topicos_modulo,
        COUNT(pa.id) FILTER (WHERE pa.concluido = true) as topicos_concluidos
      FROM modulos m
      JOIN topicos t ON t.modulo_id = m.id
      LEFT JOIN progresso_aluno pa ON pa.topico_id = t.id AND pa.usuario_id = $1
      WHERE m.ativo = true
      GROUP BY m.id, m.nome
    `, [usuarioId]);
    
    for (const modulo of rows) {
      // Se completou o módulo
      if (parseInt(modulo.topicos_concluidos) === parseInt(modulo.total_topicos_modulo)) {
        // Mapear nome do módulo para ID da conquista
        const moduloConquistaMap = {
          'Lógica & Algoritmos': 6,  // Base Forte
          'C++ — Fundamentos Fortes': 7,  // C++ Warrior
          'Python Aplicado': 8,  // Python Master
          'Projetos Práticos': 9,  // Projetos Completos
        };
        
        const conquistaId = moduloConquistaMap[modulo.modulo_nome];
        if (conquistaId) {
          await this.atribuirConquista(usuarioId, conquistaId, 1, 1);
        }
      }
    }
    
    // Verificar se completou todos os módulos
    const todosModulos = rows.length;
    const modulosCompletos = rows.filter(m => 
      parseInt(m.topicos_concluidos) === parseInt(m.total_topicos_modulo)
    ).length;
    
    if (modulosCompletos === todosModulos && todosModulos > 0) {
      await this.atribuirConquista(usuarioId, 10, modulosCompletos, 4); // Full Stack Beginner
    }
  }

  // Verificar se todos os módulos foram concluídos (chamado pelo switch 'modulo_completo')
  async verificarConquistasTodosModulos(usuarioId) {
    // Delega para verificarConquistasModulo que já tem esta lógica
    await this.verificarConquistasModulo(usuarioId);
  }

  // Verificar streaks (sequência de dias)
  async verificarConquistasStreak(usuarioId) {
    const { rows } = await pool.query(`
      WITH dias_estudo AS (
        SELECT DISTINCT DATE(data_conclusao) as dia
        FROM progresso_aluno
        WHERE usuario_id = $1 AND data_conclusao IS NOT NULL
        ORDER BY dia DESC
      ),
      streaks AS (
        SELECT 
          dia,
          dia - (ROW_NUMBER() OVER (ORDER BY dia))::integer as streak_group
        FROM dias_estudo
      )
      SELECT COUNT(*) as streak_atual
      FROM streaks
      WHERE streak_group = (
        SELECT streak_group 
        FROM streaks 
        WHERE dia = CURRENT_DATE
      )
    `, [usuarioId]);
    
    const streakAtual = parseInt(rows[0]?.streak_atual || 0);
    
    // Conquistas de streak
    const streaksConquistas = [
      { dias: 3, conquistaId: 11 },  // Fogo Jovem
      { dias: 7, conquistaId: 12 },  // Determinado
      { dias: 15, conquistaId: 13 }, // Imparável
      { dias: 30, conquistaId: 14 }  // Lenda da Consistência
    ];
    
    for (const item of streaksConquistas) {
      if (streakAtual >= item.dias) {
        await this.atribuirConquista(usuarioId, item.conquistaId, streakAtual, item.dias);
      }
    }
  }

  // Verificar conquistas de velocidade
  async verificarConquistasVelocidade(usuarioId) {
    const { rows } = await pool.query(`
      SELECT COUNT(*) as topicos_hoje
      FROM progresso_aluno
      WHERE usuario_id = $1 
        AND concluido = true
        AND DATE(data_conclusao) = CURRENT_DATE
    `, [usuarioId]);
    
    const topicosHoje = parseInt(rows[0].topicos_hoje);
    
    if (topicosHoje >= 5) {
      await this.atribuirConquista(usuarioId, 15, topicosHoje, 5); // Velocista
    }
    if (topicosHoje >= 10) {
      await this.atribuirConquista(usuarioId, 16, topicosHoje, 10); // Maratona de Código
    }
  }

  // Verificar conquistas de horário
  async verificarConquistasHorario(usuarioId) {
    const agora = new Date();
    const hora = agora.getHours();
    
    // Coruja Noturna (0h - 5h)
    if (hora >= 0 && hora < 5) {
      await this.atribuirConquista(usuarioId, 17, 1, 1); // Coruja Noturna
    }
    // Madrugador (5h - 8h)
    if (hora >= 5 && hora < 8) {
      await this.atribuirConquista(usuarioId, 18, 1, 1); // Madrugador
    }
  }

  // Verificar conquistas sociais
  async verificarConquistasSociais(usuarioId) {
    const { rows } = await pool.query(`
      SELECT 
        COUNT(DISTINCT CASE WHEN tipo = 'resposta' THEN id END) as total_respostas,
        COUNT(DISTINCT CASE WHEN tipo = 'participacao' THEN id END) as total_participacoes
      FROM atividades_forum
      WHERE usuario_id = $1
    `, [usuarioId]);
    
    const totalRespostas = parseInt(rows[0].total_respostas || 0);
    const totalParticipacoes = parseInt(rows[0].total_participacoes || 0);
    
    if (totalRespostas >= 5) {
      await this.atribuirConquista(usuarioId, 19, totalRespostas, 5); // Ajudante
    }
    if (totalParticipacoes >= 10) {
      await this.atribuirConquista(usuarioId, 20, totalParticipacoes, 10); // Comunidade Ativa
    }
  }

  // Atribuir conquista ao usuário
  async atribuirConquista(usuarioId, conquistaId, progressoAtual, progressoTotal) {
    try {
      // Cast explícito para integer — o PostgreSQL não consegue deduzir o tipo
      // de $3 e $4 quando o mesmo parâmetro aparece em INSERT e num CASE WHEN,
      // causando o erro 42P08 "text versus integer".
      const pAtual = parseInt(progressoAtual, 10);
      const pTotal = parseInt(progressoTotal, 10);

      const { rows } = await pool.query(`
        INSERT INTO conquistas_usuario (usuario_id, conquista_id, progresso_atual, progresso_total, data_obtencao)
        VALUES ($1, $2, $3::integer, $4::integer, 
          CASE WHEN $3::integer >= $4::integer THEN NOW() ELSE NULL END
        )
        ON CONFLICT (usuario_id, conquista_id) 
        DO UPDATE SET 
          progresso_atual = EXCLUDED.progresso_atual,
          data_obtencao = CASE 
            WHEN EXCLUDED.progresso_atual >= conquistas_usuario.progresso_total 
            AND conquistas_usuario.data_obtencao IS NULL 
            THEN NOW() 
            ELSE conquistas_usuario.data_obtencao 
          END,
          notificacao_vista = CASE 
            WHEN EXCLUDED.progresso_atual >= conquistas_usuario.progresso_total 
            AND conquistas_usuario.data_obtencao IS NULL 
            THEN false 
            ELSE conquistas_usuario.notificacao_vista 
          END
        RETURNING *
      `, [usuarioId, conquistaId, pAtual, pTotal]);
      
      return rows[0];
    } catch (error) {
      console.error('Erro ao atribuir conquista:', error);
    }
  }

  // Buscar conquistas do usuário
  async buscarConquistasUsuario(usuarioId) {
    const { rows } = await pool.query(`
      SELECT 
        c.*,
        cu.data_obtencao,
        cu.progresso_atual,
        cu.progresso_total,
        cu.notificacao_vista,
        CASE 
          WHEN cu.data_obtencao IS NOT NULL THEN 'conquistada'
          WHEN cu.progresso_atual > 0 THEN 'em_andamento'
          ELSE 'bloqueada'
        END as status
      FROM conquistas c
      LEFT JOIN conquistas_usuario cu ON cu.conquista_id = c.id AND cu.usuario_id = $1
      WHERE c.ativa = true
      ORDER BY c.ordem_exibicao, c.categoria
    `, [usuarioId]);
    
    // Agrupar por categoria
    const conquistas = {
      progresso: rows.filter(r => r.categoria === 'progresso'),
      modulo: rows.filter(r => r.categoria === 'modulo'),
      streak: rows.filter(r => r.categoria === 'streak'),
      velocidade: rows.filter(r => r.categoria === 'velocidade'),
      horario: rows.filter(r => r.categoria === 'horario'),
      social: rows.filter(r => r.categoria === 'social'),
      todas: rows
    };
    
    return conquistas;
  }

  // Buscar conquistas novas não vistas
  async buscarConquistasNovas(usuarioId) {
    const { rows } = await pool.query(`
      SELECT 
        c.*,
        cu.data_obtencao,
        cu.progresso_atual,
        cu.progresso_total,
        'conquistada' as status
      FROM conquistas_usuario cu
      JOIN conquistas c ON c.id = cu.conquista_id
      WHERE cu.usuario_id = $1 
        AND cu.data_obtencao IS NOT NULL 
        AND cu.notificacao_vista = false
      ORDER BY cu.data_obtencao DESC
    `, [usuarioId]);
    
    return rows;
  }

  // Marcar conquistas como vistas
  async marcarConquistasVistas(usuarioId, conquistaIds = []) {
    if (conquistaIds.length === 0) {
      await pool.query(`
        UPDATE conquistas_usuario 
        SET notificacao_vista = true 
        WHERE usuario_id = $1 AND notificacao_vista = false
      `, [usuarioId]);
    } else {
      await pool.query(`
        UPDATE conquistas_usuario 
        SET notificacao_vista = true 
        WHERE usuario_id = $1 AND conquista_id = ANY($2::int[])
      `, [usuarioId, conquistaIds]);
    }
  }

  // Calcular pontuação total do usuário
  async calcularPontuacaoTotal(usuarioId) {
    const { rows } = await pool.query(`
      SELECT SUM(c.pontos) as total_pontos
      FROM conquistas_usuario cu
      JOIN conquistas c ON c.id = cu.conquista_id
      WHERE cu.usuario_id = $1 AND cu.data_obtencao IS NOT NULL
    `, [usuarioId]);
    
    return parseInt(rows[0]?.total_pontos || 0);
  }
}

module.exports = new ConquistasService();