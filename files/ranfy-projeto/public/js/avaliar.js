
(() => {
  const form = document.getElementById("evaluation-form");

  if (!form) return;

  async function iniciarAvaliacao() {
    const params = new URLSearchParams(location.search);
    const codigo = (params.get("projeto") || "").trim();

    if (!codigo) {
      alert("Código do projeto não informado.");
      location.replace("qrcode.html");
      return;
    }

    try {
      const api = window.RANFY_API_URL;
      const resposta = await fetch(
        `${api}/api/projetos/${encodeURIComponent(codigo)}`
      );

      if (resposta.status === 404) {
        alert("Este projeto não está cadastrado no Ranfy.");
        location.replace("qrcode.html");
        return;
      }

      if (!resposta.ok) {
        throw new Error("Falha ao consultar o projeto.");
      }

      const projeto = await resposta.json();

      document.getElementById("project-name").textContent = projeto.nome;
      document.getElementById("project-code-label").textContent =
        `${projeto.area} · Código: ${projeto.codigo}`;

      form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!form.reportValidity()) return;

        const botao = form.querySelector('[type="submit"]');

        if (botao) botao.disabled = true;

        try {
          const participante = (
            localStorage.getItem("ranfy_nome") || ""
          ).trim();

          if (!participante) {
            alert("Informe seu nome antes de avaliar.");
            if (botao) botao.disabled = false;
            return;
          }

          const nota1 = form.querySelector(
            'input[name="avaliacao_geral"]:checked'
          )?.value;

          const nota2 = form.querySelector(
            'input[name="criatividade"]:checked'
          )?.value;

          const nota3 = form.querySelector(
            'input[name="impacto"]:checked'
          )?.value;

          const comentario = form.elements.comentario?.value.trim() || "";

          const envio = await fetch(`${api}/api/avaliacoes`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              projetoCodigo: projeto.codigo,
              participante,
              nota1: Number(nota1),
              nota2: Number(nota2),
              nota3: Number(nota3),
              comentario
            })
          });

          const resultado = await envio.json();

          if (envio.status === 409) {
            alert(resultado.erro || "Você já avaliou este projeto.");
            if (botao) botao.disabled = false;
            return;
          }

          if (!envio.ok) {
            throw new Error(resultado.erro || "Erro ao enviar avaliação.");
          }

          // Só avança depois de confirmar que o backend salvou.
          location.href = "concluida.html";
        } catch (erro) {
          console.error(erro);
          alert(
            erro.message ||
            "Não foi possível enviar. Verifique sua conexão e tente novamente."
          );

          if (botao) botao.disabled = false;
        }
      });
    } catch (erro) {
      console.error(erro);
      alert("Não foi possível carregar o projeto. Tente novamente.");
    }
  }

  iniciarAvaliacao();
})();
