const nodemailer = require('nodemailer');

// Configuração do transporter (Gmail ou Brevo)
const createTransporter = () => {
  // Opção 1: Gmail (gratuito)
  if (process.env.EMAIL_SERVICE === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD // App Password do Google
      }
    });
  }
  
  // Opção 2: Brevo/SendGrid (produção)
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Template HTML bonito para email de credenciais
const criarTemplateCredenciais = ({ nome, email, senha, link }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #0f172a;
      color: #f3f4f6;
      padding: 20px;
      margin: 0;
    }

    .container {
      max-width: 520px;
      margin: 0 auto;
      background: #111827;
      border-radius: 18px;
      padding: 35px;
      border: 1px solid #1f2937;
      box-shadow: 0 10px 40px rgba(0,0,0,0.4);
    }

    .header {
      text-align: center;
      padding-bottom: 20px;
      border-bottom: 1px solid #1f2937;
    }

    .logo {
      font-size: 26px;
      font-weight: 800;
      color: #6366f1;
    }

    .subtitle {
      margin-top: 6px;
      color: #9ca3af;
      font-size: 14px;
    }

    .content {
      padding: 25px 0;
      font-size: 15px;
      line-height: 1.6;
    }

    .credenciais {
      background: #1f2937;
      border-radius: 14px;
      padding: 20px;
      margin: 25px 0;
      border-left: 4px solid #6366f1;
    }

    .credenciais p {
      margin: 10px 0;
      font-size: 14px;
    }

    .email-highlight {
      color: #818cf8;
      font-weight: 600;
    }

    .senha {
      font-family: monospace;
      background: #0f172a;
      padding: 10px 14px;
      border-radius: 8px;
      letter-spacing: 2px;
      color: #6366f1;
      font-weight: bold;
      display: inline-block;
      margin-top: 5px;
    }

    .btn-container {
      text-align: center;
      margin-top: 25px;
    }

    .btn {
      display: inline-block;
      background: #6366f1;
      color: white;
      padding: 14px 35px;
      text-decoration: none;
      border-radius: 10px;
      font-weight: 600;
      font-size: 14px;
    }

    .btn:hover {
      background: #4f46e5;
    }

    .warning {
      background: #1e293b;
      color: #fbbf24;
      padding: 12px;
      border-radius: 10px;
      font-size: 13px;
      margin: 20px 0;
      border-left: 4px solid #f59e0b;
    }

    .footer {
      text-align: center;
      padding-top: 20px;
      border-top: 1px solid #1f2937;
      font-size: 12px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🎓 CodeMaster</div>
      <div class="subtitle">Acesso Confirmado</div>
    </div>

    <div class="content">
      <p>Olá, <strong>${nome}</strong> 👋</p>

      <p>
        Seu pagamento foi confirmado e sua conta está 
        <strong style="color:#818cf8;">ativa</strong>. 
        Seja bem-vindo(a) à plataforma!
      </p>

      <div class="credenciais">
        <p><strong>Email de acesso:</strong><br>
          <span class="email-highlight">${email}</span>
        </p>

        <p><strong>Senha temporária:</strong><br>
          <span class="senha">${senha}</span>
        </p>
      </div>

      <div class="warning">
        ⚠️ Por segurança, altere sua senha no primeiro login.
      </div>

      <div class="btn-container">
        <a href="${link}" class="btn">🚀 Acessar Plataforma</a>
      </div>

      <p style="margin-top:25px; font-size:14px; color:#9ca3af;">
        Caso tenha dúvidas, responda este email.
      </p>
    </div>

    <div class="footer">
      CodeMaster © ${new Date().getFullYear()} • Todos os direitos reservados
    </div>
  </div>
</body>
</html>
`;

// Função principal de envio
const enviarEmailCredenciais = async ({ para, nome, senha, link }) => {
  try {
    const transporter = createTransporter();
    
    await transporter.sendMail({
      from: `"CodeMaster" <${process.env.EMAIL_USER}>`,
      to: para,
      subject: '🎉 Seu acesso à CodeMaster está ativo!',
      text: `
        Olá, ${nome}! Seu acesso à CodeMaster está ativo.
        
        Email: ${para}
        Senha temporária: ${senha}
        
        Acesse: ${link}
        
        ⚠️ Altere sua senha no primeiro login.
      `,
      html: criarTemplateCredenciais({ nome, email: para, senha, link })
    });
    
    return { success: true };
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = { enviarEmailCredenciais };