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
    res.json({ ok: true, banco: "conectado" });
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

module.exports = app;

// Rodando localmente (npm start): também serve o site da pasta public.
if (require.main === module) {
  app.use(express.static(path.join(__dirname, "..", "public")));
  const porta = process.env.PORT || 3000;
  app.listen(porta, () => console.log(`Ranfy rodando em http://localhost:${porta}/login.html`));
}
