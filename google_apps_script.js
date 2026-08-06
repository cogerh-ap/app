/**
 * GOOGLE APPS SCRIPT - Notificação de Avisos via OneSignal (Disparo Manual)
 * 
 * COMO USAR O BOTÃO / MENU NA PLANILHA:
 * 
 * OPÇÃO A (Menu Superior Automático):
 * 1. Ao abrir a planilha, um menu chamado "📢 Notificações COGERH" aparecerá no topo da planilha.
 * 2. Selecione a linha do aviso desejado na aba "avisos" (ou deixe na última linha).
 * 3. Clique em: "📢 Notificações COGERH" -> "Enviar Notificação do Aviso Selecionado".
 * 
 * OPÇÃO B (Botão na Planilha):
 * 1. Na planilha, acesse: Inserir -> Desenho -> Desenhe um botão (ex: "Enviar Notificação") e clique em Salvar.
 * 2. Clique nos 3 pontinhos no canto do botão inserido e escolha "Atribuir script".
 * 3. Digite exatamente o nome da função: dispararNotificacaoManual
 * 
 * CREDENCIAIS ONESIGNAL:
 */

// ID da Aplicação no OneSignal
const ONESIGNAL_APP_ID = "547baca0-44e5-4bdc-928e-a94451db63c6";

// REST API Key do OneSignal (Encontrado em: OneSignal Dashboard -> Settings -> Keys & IDs -> REST API Key)
const ONESIGNAL_REST_API_KEY = "pobzlqqfueawfqgsstua6ekbe"; 

// URL de destino do aplicativo PWA para onde o usuário será redirecionado ao clicar na notificação
const PWA_APP_URL = "https://cogerh-ap.github.io/app/"; 

/**
 * Cria o menu personalizado no topo do Google Sheets ao abrir a planilha
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("📢 Notificações COGERH")
    .addItem("Enviar Notificação (Aviso Selecionado/Último)", "dispararNotificacaoManual")
    .addItem("Testar Conexão OneSignal", "testNotification")
    .addToUi();
}

/**
 * Função principal para disparar a notificação MANUALMENTE (vinculada ao botão ou menu).
 * Pergunta confirmação ao usuário e exibe alerta na tela com o resultado.
 */
function dispararNotificacaoManual() {
  const ui = SpreadsheetApp.getUi();
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("avisos") || ss.getSheetByName("Avisos");
    
    if (!sheet) {
      ui.alert("Erro", "A aba 'avisos' não foi encontrada nesta planilha.", ui.ButtonSet.OK);
      return;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      ui.alert("Aviso", "Nenhum aviso encontrado na planilha além da linha de cabeçalho.", ui.ButtonSet.OK);
      return;
    }

    // Identificar a linha a ser enviada (linha selecionada se estiver na aba avisos e > 1, senão a última linha)
    let targetRow = lastRow;
    const activeSheet = ss.getActiveSheet();
    if (activeSheet && activeSheet.getName().toLowerCase() === "avisos") {
      const activeRow = activeSheet.getActiveCell().getRow();
      if (activeRow > 1 && activeRow <= lastRow) {
        targetRow = activeRow;
      }
    }

    // Identificar dinamicamente os índices das colunas 'title' e 'content' na Linha 1
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    let titleColIndex = -1;
    let contentColIndex = -1;

    for (let i = 0; i < headers.length; i++) {
      const h = String(headers[i]).trim().toLowerCase();
      if (h === "title" || h === "titulo" || h === "título") {
        titleColIndex = i + 1;
      } else if (h === "content" || h === "conteudo" || h === "conteúdo" || h === "mensagem" || h === "texto") {
        contentColIndex = i + 1;
      }
    }

    if (titleColIndex === -1) titleColIndex = 2;
    if (contentColIndex === -1) contentColIndex = 3;

    // Obter valores da linha alvo
    const title = sheet.getRange(targetRow, titleColIndex).getValue().toString().trim();
    const content = sheet.getRange(targetRow, contentColIndex).getValue().toString().trim();

    if (!title && !content) {
      ui.alert("Atenção", `A linha ${targetRow} da aba 'avisos' está sem título e conteúdo.`, ui.ButtonSet.OK);
      return;
    }

    // Confirmação antes de enviar
    const confirmMessage = `Deseja enviar a notificação referente à Linha ${targetRow}?\n\n📌 TÍTULO: ${title}\n💬 CONTEÚDO: ${content}`;
    const response = ui.alert("Confirmar Envio de Notificação", confirmMessage, ui.ButtonSet.YES_NO);

    if (response !== ui.Button.YES) {
      ui.alert("Cancelado", "Envio de notificação cancelado pelo usuário.", ui.ButtonSet.OK);
      return;
    }

    // Enviar notificação para o OneSignal
    sendOneSignalNotification(title, content);

    ui.alert("Sucesso! 🎉", `Notificação enviada com sucesso para todos os usuários do PWA!\n\nAviso (Linha ${targetRow}): "${title}"`, ui.ButtonSet.OK);

  } catch (err) {
    ui.alert("Erro no Envio", "Ocorreu uma falha ao enviar a notificação:\n\n" + err.toString(), ui.ButtonSet.OK);
    Logger.log("Erro ao executar dispararNotificacaoManual: " + err.toString());
  }
}

/**
 * Função legada de envio automático (pode ser mantida ou utilizada se desejar)
 */
function onNewNoticeAdded(e) {
  dispararNotificacaoManual();
}

/**
 * Função responsável por realizar a requisição HTTP POST para a REST API do OneSignal
 */
function sendOneSignalNotification(title, content) {
  if (!ONESIGNAL_REST_API_KEY || ONESIGNAL_REST_API_KEY === "SUA_REST_API_KEY_AQUI") {
    throw new Error("REST API Key do OneSignal não foi configurada. Obtenha a chave em: OneSignal Dashboard -> Settings -> Keys & IDs -> REST API Key");
  }

  const url = "https://onesignal.com/api/v1/notifications";

  const payload = {
    "app_id": ONESIGNAL_APP_ID,
    "included_segments": ["All"],
    "url": PWA_APP_URL,
    "headings": {
      "en": title || "Novo Aviso COGERH",
      "pt": title || "Novo Aviso COGERH"
    },
    "contents": {
      "en": content || "Acesse o aplicativo para conferir as novidades.",
      "pt": content || "Acesse o aplicativo para conferir as novidades."
    }
  };

  const options = {
    "method": "post",
    "contentType": "application/json; charset=utf-8",
    "headers": {
      "Authorization": "Key " + ONESIGNAL_REST_API_KEY
    },
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  Logger.log("Resposta OneSignal (Status " + responseCode + "): " + responseText);

  if (responseCode !== 200) {
    throw new Error("Erro de autenticação ou envio no OneSignal (Código " + responseCode + "): " + responseText);
  }

  return responseText;
}

/**
 * Função de teste manual: execute no editor para validar as credenciais
 */
function testNotification() {
  sendOneSignalNotification("Aviso de Teste COGERH", "Notificação de teste validando a integração com o OneSignal.");
}

