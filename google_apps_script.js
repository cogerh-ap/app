/**
 * GOOGLE APPS SCRIPT - Notificação Automática de Avisos via OneSignal
 * 
 * INSTRUÇÕES DE INSTALAÇÃO:
 * 1. Abra a sua Planilha Google vinculada ao PWA COGERH.
 * 2. No menu superior, acesse: Extensões -> Apps Script.
 * 3. Cole o código abaixo substituindo o conteúdo existente no editor.
 * 4. Substitua a constante ONESIGNAL_REST_API_KEY pela sua chave da API REST do OneSignal:
 *    (Para encontrar no OneSignal: Dashboard -> Settings -> Keys & IDs -> REST API Key).
 * 5. Salve o projeto no ícone do disquete.
 * 6. Configure o Acionador (Trigger):
 *    - Clique no ícone de relógio ("Acionadores" / "Triggers") na barra lateral esquerda.
 *    - Clique no botão "+ Adicionar acionador" (no canto inferior direito).
 *    - Escolha a função para executar: onNewNoticeAdded
 *    - Selecione a fonte do evento: De uma planilha
 *    - Selecione o tipo de evento: "Ao alterar" (onChange) ou "Ao editar" (onEdit) / "Ao enviar formulário".
 *    - Salve e conceda as permissões solicitadas pela Conta Google.
 */

// ID da Aplicação no OneSignal
const ONESIGNAL_APP_ID = "547baca0-44e5-4bdc-928e-a94451db63c6";

// REST API Key do OneSignal (Encontrado em: OneSignal Dashboard -> Settings -> Keys & IDs -> REST API Key)
const ONESIGNAL_REST_API_KEY = "pobzlqqfueawfqgsstua6ekbe"; 

// URL de destino do aplicativo PWA para onde o usuário será redirecionado ao clicar na notificação
const PWA_APP_URL = "https://cogerh-ap.github.io/app/"; 

/**
 * Função principal chamada automaticamente quando um novo aviso é adicionado na aba "avisos"
 */
function onNewNoticeAdded(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("avisos") || ss.getSheetByName("Avisos");
    
    if (!sheet) {
      Logger.log("Aba 'avisos' não foi encontrada na planilha.");
      return;
    }

    // Se o evento foi disparado por uma alteração, verifica se foi na aba 'avisos'
    if (e && e.range) {
      const editedSheet = e.range.getSheet();
      if (editedSheet.getName().toLowerCase() !== "avisos") {
        return;
      }
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      Logger.log("Nenhum aviso encontrado além da linha de cabeçalho.");
      return;
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

    // Padrão de segurança: Coluna B (2) = title, Coluna C (3) = content
    if (titleColIndex === -1) titleColIndex = 2;
    if (contentColIndex === -1) contentColIndex = 3;

    // Obter valores da última linha inserida
    const title = sheet.getRange(lastRow, titleColIndex).getValue().toString().trim();
    const content = sheet.getRange(lastRow, contentColIndex).getValue().toString().trim();

    if (!title && !content) {
      Logger.log("Título e Conteúdo estão vazios na última linha.");
      return;
    }

    Logger.log("Disparando notificação - Título: '" + title + "' | Conteúdo: '" + content + "'");

    // Enviar notificação para o OneSignal
    sendOneSignalNotification(title, content);

  } catch (err) {
    Logger.log("Erro ao executar onNewNoticeAdded: " + err.toString());
  }
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
      // O erro 401 ocorria devido à ausência ou incorreção deste cabeçalho de autorização
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
