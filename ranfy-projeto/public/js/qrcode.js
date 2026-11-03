
(() => {
  const status = document.getElementById("scanner-status");
  const manualStatus = document.getElementById("manual-status");
  const button = document.getElementById("start-camera");
  const form = document.getElementById("manual-project-form");
  const input = document.getElementById("project-code");

  let scanner = null;
  let processando = false;

  function mensagem(texto, tipo = "") {
    status.textContent = texto;
    status.className = `scanner-hint ${tipo}`.trim();
  }

  function mensagemManual(texto, tipo = "") {
    manualStatus.textContent = texto;
    manualStatus.className = `scanner-hint ${tipo}`.trim();
  }


  function extrairCodigo(texto) {
    const conteudo = texto.trim();

    try {
      const url = new URL(conteudo);

      // Procura o código nos parâmetros da URL
      const codigo =
        url.searchParams.get("projeto") ||
        url.searchParams.get("codigo") ||
        url.searchParams.get("code");

      if (codigo) {
        return codigo.trim().toUpperCase();
      }

      // Se a URL não tiver parâmetro, procura o código no caminho
      const partes = url.pathname.split("/").filter(Boolean);
      const ultimaParte = partes[partes.length - 1];

      if (/^\d+$/i.test(ultimaParte || "")) {
        return ultimaParte.toUpperCase();
      }

      return conteudo;
    } catch {
      // Se não for uma URL, trata o conteúdo como código
      return conteudo.toUpperCase();
    }
  }



  async function validarCodigo(texto, origem = "camera") {
    if (processando) return;

    const informar = origem === "manual"
      ? mensagemManual
      : mensagem;

    let codigo = String(texto || "").trim();

    // Aceita QR Codes que contenham uma URL.
    try {
      const url = new URL(codigo);
      codigo =
        url.searchParams.get("projeto") ||
        url.searchParams.get("codigo") ||
        url.searchParams.get("code") ||
        codigo;
    } catch {
      // O conteúdo não é uma URL; pode ser o código diretamente.
    }

    // Padroniza o código para consultar a API.
    codigo = codigo.trim().toUpperCase();

    // Se extrairCodigo já identifica códigos em outros formatos,
    // aproveita o resultado quando estiver disponível.
    if (typeof extrairCodigo === "function") {
      const extraido = extrairCodigo(texto);
      if (extraido) {
        codigo = String(extraido).trim().toUpperCase();
      }
    }

    if (!codigo) {
      informar("Não foi possível identificar o código do projeto.", "error");
      return;
    }

    processando = true;
    informar(`Consultando o código: ${codigo}...`);

    try {
      const api = window.RANFY_API_URL;

      if (!api) {
        throw new Error("A URL da API não foi configurada.");
      }

      const resposta = await fetch(
        `${api}/api/projetos/${encodeURIComponent(codigo)}`
      );

      const dados = await resposta.json().catch(() => ({}));

      if (resposta.status === 404) {
        informar(
          `O código "${codigo}" não foi encontrado. Confira o conteúdo do QR Code.`,
          "error"
        );
        return;
      }

      if (!resposta.ok) {
        throw new Error(`A API respondeu com erro ${resposta.status}.`);
      }

      const projeto = dados.projeto || dados;

      const codigoProjeto = String(
        projeto.codigo || projeto.projeto_codigo || ""
      ).trim().toUpperCase();

      if (!codigoProjeto || !projeto.nome) {
        throw new Error("A API retornou dados incompletos do projeto.");
      }

      informar(
        `Projeto encontrado: ${projeto.nome}. Abrindo avaliação...`,
        "success"
      );

      if (scanner && scanner.isScanning) {
        try {
          await scanner.stop();
        } catch (erro) {
          console.warn("Não foi possível parar a câmera:", erro);
        }
      }

      window.location.href =
        `avaliar.html?projeto=${encodeURIComponent(codigoProjeto)}`;

    } catch (erro) {
      console.error("Erro ao validar QR Code:", erro);
      informar(
        "Não foi possível consultar o projeto. Verifique a conexão e tente novamente.",
        "error"
      );
    } finally {
      processando = false;
    }
  }


  async function iniciarCamera() {
    if (!window.Html5Qrcode) {
      mensagem(
        "O leitor não carregou. Verifique a conexão com a internet.",
        "error"
      );
      return;
    }

    button.disabled = true;
    mensagem("Solicitando acesso à câmera...");

    try {
      if (!scanner) {
        scanner = new Html5Qrcode("reader");
      }

      const cameras = await Html5Qrcode.getCameras();

      if (!cameras.length) {
        throw new Error("Nenhuma câmera foi encontrada.");
      }

      const camera =
        cameras.find(c =>
          /back|rear|traseira|environment/i.test(c.label)
        ) || cameras[0];

      await scanner.start(
        camera.id,
        { fps: 10, qrbox: { width: 240, height: 240 } },
        texto => validarCodigo(texto, "camera"),
        () => { }
      );

      mensagem("Câmera ativa. Aponte para o QR Code.");
      button.textContent = "Câmera ativada";

    } catch (erro) {
      console.error("Erro ao iniciar câmera:", erro);

      mensagem(
        erro.message || "Não foi possível abrir a câmera.",
        "error"
      );
    } finally {
      button.disabled = false;
    }
  }

  button.addEventListener("click", async () => {
    if (scanner && scanner.isScanning) {
      try {
        await scanner.stop();
        button.textContent = "Ativar câmera";
        mensagem("Câmera fechada.");
      } catch (erro) {
        console.error(erro);
        mensagem("Não foi possível fechar a câmera.", "error");
      }
      return;
    }

    processando = false;
    iniciarCamera();
  });

  form.addEventListener("submit", evento => {
    evento.preventDefault();
    validarCodigo(input.value, "manual");
  });

  mensagem("Ative a câmera ou digite o código do projeto.");
})();
