(() => {
  const codigo = sessionStorage.getItem("ranfy_admin");
  if (!codigo) { location.replace("qrcode.html"); return; }

  const $ = id => document.getElementById(id);
  const AZUL = "#075dff", LARANJA = "#ff7800", ESCURO = "#07143f", CLARO = "#9db8f0";
  const graficos = {};

  function status(texto, tipo = "") {
    $("dash-status").textContent = texto;
    $("dash-status").className = `scanner-hint ${tipo}`.trim();
  }

  function desenhar(id, config, altura) {
    if (graficos[id]) graficos[id].destroy();
    if (altura) $(`caixa-${id.replace("grafico-", "")}`).style.height = altura + "px";
    config.options = { responsive: true, maintainAspectRatio: false, ...config.options };
    graficos[id] = new Chart($(id), config);
  }

  function render(d) {
    const avaliados = d.projetos.filter(p => p.total > 0).sort((a, b) => b.media - a.media);
    $("kpi-total").textContent = d.totalGeral;
    $("kpi-projetos").textContent = `${avaliados.length} de ${d.projetos.length}`;
    $("kpi-media").textContent = d.totalGeral ? d.mediaGeral.toFixed(2) : "–";

    if (!avaliados.length) { status("Ainda não há avaliações."); }
    else { status(`Atualizado às ${new Date().toLocaleTimeString("pt-BR")}`); }

    const nomes = avaliados.map(p => `${p.codigo} · ${p.nome}`.slice(0, 30));
    const altura = Math.max(260, avaliados.length * 40);
    const horizontal = { indexAxis: "y", scales: { x: { min: 0, max: 5 } } };

    desenhar("grafico-ranking", {
      type: "bar",
      data: { labels: nomes, datasets: [{ label: "Média geral", data: avaliados.map(p => +p.media.toFixed(2)), backgroundColor: AZUL }] },
      options: { ...horizontal, plugins: { legend: { display: false } } }
    }, altura);

    desenhar("grafico-criterios", {
      type: "bar",
      data: {
        labels: nomes,
        datasets: [
          { label: "Apresentação", data: avaliados.map(p => +p.m1.toFixed(2)), backgroundColor: AZUL },
          { label: "Criatividade", data: avaliados.map(p => +p.m2.toFixed(2)), backgroundColor: LARANJA },
          { label: "Impacto", data: avaliados.map(p => +p.m3.toFixed(2)), backgroundColor: ESCURO }
        ]
      },
      options: horizontal
    }, altura * 2);

    desenhar("grafico-total", {
      type: "bar",
      data: { labels: nomes, datasets: [{ label: "Avaliações", data: avaliados.map(p => p.total), backgroundColor: CLARO, borderColor: ESCURO, borderWidth: 2 }] },
      options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
    }, altura);

    const lista = $("comentarios");
    lista.textContent = "";
    if (!d.comentarios.length) { lista.textContent = "Nenhuma sugestão enviada ainda."; return; }
    for (const c of d.comentarios) {
      const item = document.createElement("div");
      item.className = "comentario";
      const quem = document.createElement("small");
      quem.textContent = `${c.participante} · projeto ${c.projeto_codigo} · ${new Date(c.criado_em).toLocaleString("pt-BR")}`;
      const texto = document.createElement("p");
      texto.textContent = c.comentario;
      item.append(quem, texto);
      lista.append(item);
    }
  }

  async function carregar() {
    status("Carregando...");
    try {
      const r = await fetch(`${window.RANFY_API_URL}/api/dashboard`, { headers: { "x-dashboard-code": codigo } });
      if (r.status === 401) { sessionStorage.removeItem("ranfy_admin"); location.replace("qrcode.html"); return; }
      if (!r.ok) throw new Error();
      render(await r.json());
    } catch {
      status("Não foi possível carregar os dados. Tente atualizar.", "error");
    }
  }

  $("atualizar").addEventListener("click", carregar);
  $("sair").addEventListener("click", () => { sessionStorage.removeItem("ranfy_admin"); location.href = "qrcode.html"; });
  carregar();
  setInterval(carregar, 30000);
})();
