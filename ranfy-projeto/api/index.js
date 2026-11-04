require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");

// ---- Nomes das tabelas (ajuste aqui se forem diferentes no Neon) ----
const TABELA_PROJETOS = "projetos";
const TABELA_AVALIACOES = "avaliacoes";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "20kb" }));

const norm = v => String(v ?? "").trim().toUpperCase();
const codigoDe = r => r.codigo ?? r.codigo_qr ?? r.codigo_projeto ?? r.projeto_codigo;
const formata = r => ({ ...r, codigo: String(codigoDe(r) ?? "").trim() });

async function listarProjetos() {
  const { rows } = await pool.query(`SELECT * FROM ${TABELA_PROJETOS}`);
  return rows.map(formata);
}

// Teste rápido: abra /api/saude para ver se o banco responde.
app.get("/api/saude", async (req, res) => {
  try {
    await pool.query("SELECT 1");
     res.json({ ok: true, banco: "conectado", dashboard: Boolean(process.env.DASHBOARD_CODE) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, erro: "Sem conexão com o banco." });
  }
});

app.get("/api/projetos", async (req, res) => {
  try {
    res.json(await listarProjetos());
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro ao listar os projetos." });
  }
});

app.get("/api/projetos/:codigo", async (req, res) => {
  try {
    const alvo = norm(req.params.codigo);
    const projeto = (await listarProjetos()).find(p => norm(p.codigo) === alvo);
    if (!projeto) return res.status(404).json({ erro: "Projeto não encontrado." });
    res.json(projeto);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro ao consultar o projeto." });
  }
});

app.post("/api/avaliacoes", async (req, res) => {
  try {
    const { projetoCodigo, participante, nota1, nota2, nota3, comentario } = req.body || {};
    const nome = String(participante || "").trim().slice(0, 80);
    const notas = [nota1, nota2, nota3].map(Number);

    if (nome.length < 2) return res.status(400).json({ erro: "Informe seu nome." });
    if (notas.some(n => !Number.isInteger(n) || n < 1 || n > 5))
      return res.status(400).json({ erro: "As notas devem ir de 1 a 5." });

    const projeto = (await listarProjetos()).find(p => norm(p.codigo) === norm(projetoCodigo));
    if (!projeto) return res.status(404).json({ erro: "Projeto não encontrado." });

    const jaAvaliou = await pool.query(
      `SELECT 1 FROM ${TABELA_AVALIACOES}
       WHERE projeto_codigo = $1 AND LOWER(participante) = LOWER($2) LIMIT 1`,
      [projeto.codigo, nome]
    );
    if (jaAvaliou.rowCount) return res.status(409).json({ erro: "Você já avaliou este projeto." });

    const r = await pool.query(
      `INSERT INTO ${TABELA_AVALIACOES}
         (projeto_codigo, nota_1, nota_2, nota_3, comentario, participante)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [projeto.codigo, notas[0], notas[1], notas[2], String(comentario || "").trim().slice(0, 500), nome]
    );
    res.status(201).json({ ok: true, id: r.rows[0].id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro ao salvar a avaliação." });
  }
});

// ---- Dashboard protegido por código (defina DASHBOARD_CODE na Vercel) ----
const crypto = require("crypto");
function codigoAdminOk(c) {
  const real = norm(process.env.DASHBOARD_CODE), dado = norm(c);
  if (!real || !dado) return false;
  const h = v => crypto.createHash("sha256").update(v).digest();
  return crypto.timingSafeEqual(h(dado), h(real));
}

app.post("/api/dashboard/login", (req, res) => {
  if (!codigoAdminOk(req.body && req.body.codigo)) return res.status(401).json({ erro: "Código inválido." });
  res.json({ ok: true });
});

app.get("/api/dashboard", async (req, res) => {
  if (!codigoAdminOk(req.get("x-dashboard-code"))) return res.status(401).json({ erro: "Acesso negado." });
  try {
    const projetos = await listarProjetos();
    const { rows } = await pool.query(
      `SELECT projeto_codigo, COUNT(*)::int AS total,
              AVG(nota_1)::float8 AS m1, AVG(nota_2)::float8 AS m2, AVG(nota_3)::float8 AS m3
       FROM ${TABELA_AVALIACOES} GROUP BY projeto_codigo`
    );
    const por = Object.fromEntries(rows.map(r => [norm(r.projeto_codigo), r]));
    const lista = projetos.map(p => {
      const r = por[norm(p.codigo)] || { total: 0, m1: 0, m2: 0, m3: 0 };
      return { codigo: p.codigo, nome: p.nome, area: p.area, total: r.total,
               m1: r.m1, m2: r.m2, m3: r.m3, media: (r.m1 + r.m2 + r.m3) / 3 };
    });
    const totalGeral = lista.reduce((s, p) => s + p.total, 0);
    const mediaGeral = totalGeral ? lista.reduce((s, p) => s + p.media * p.total, 0) / totalGeral : 0;
    const com = await pool.query(
      `SELECT projeto_codigo, participante, comentario, criado_em FROM ${TABELA_AVALIACOES}
       WHERE comentario IS NOT NULL AND comentario <> '' ORDER BY criado_em DESC LIMIT 20`
    );
    res.json({ projetos: lista, totalGeral, mediaGeral, comentarios: com.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Erro ao montar o dashboard." });
  }
});

module.exports = app;

// Rodando localmente (npm start): também serve o site da pasta public.
if (require.main === module) {
  app.use(express.static(path.join(__dirname, "..", "public")));
  const porta = process.env.PORT || 3000;
  app.listen(porta, () => console.log(`Ranfy rodando em http://localhost:${porta}/login.html`));
}
