const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const mysql = require('mysql2/promise');
const moment = require('moment-timezone');
const readline = require('readline');

// Configuración de la conexión a la base de datos
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'iticket',
};

// Crear cliente de WhatsApp
const client = new Client({
  authStrategy: new LocalAuth(),
});

// Generar y mostrar el código QR en la terminal
client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
});

// Variable global para almacenar el ID del grupo
const agentGroupId = ''; // ID del grupo conocido

client.on('ready', async () => {
  console.log('Cliente de WhatsApp está listo.');

  // Escuchar la entrada desde la terminal
  rl.on('line', async (input) => {
    const comando = input.trim().toLowerCase();
    if (comando === 'listar') {
      const chats = await client.getChats();
      console.log('Listando todos los chats detectados:');
      chats.forEach((chat) => {
        console.log(`ID: ${chat.id._serialized} | Nombre: ${chat.name || chat.formattedTitle || 'Sin nombre'}`);
      });
    }
  });
});

const sessions = {};

// Agregar una interfaz de consola para que el agente pueda enviar mensajes
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Mapa para almacenar usuarios en modo agente
const agentChats = {};

// Función para eliminar acentos
function removeDiacritics(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Función para limpiar y reiniciar una sesión
const resetSession = (from) => {
  const session = sessions[from];
  if (session && session.timeout) {
    clearTimeout(session.timeout);
  }
  sessions[from] = {
    step: 0,
    data: {},
    agentMode: false,
    timeout: null,
  };
};

// Función para reiniciar el timeout de una sesión
const resetTimeout = (from) => {
  const session = sessions[from];
  if (session.timeout) {
    clearTimeout(session.timeout);
  }

  // Primer timeout: 10 minutos de inactividad
  session.timeout = setTimeout(async () => {
    try {
      await client.sendMessage(from, '¿Estás ahí? 🤔\n\nDigite "Sí" para continuar, de lo contrario en 5 minutos se reiniciará la conversación 🔄');
      console.log(`Recordatorio de inactividad enviado a ${from}.`);

      // Segundo timeout: 5 minutos adicionales
      session.timeout = setTimeout(async () => {
        try {
          await client.sendMessage(from, 'La conversación ha sido reiniciada ✅\n\n Para comenzar nuevamente, escriba "menu" 🤖 ~ .');
          console.log(`Sesión con ${from} reiniciada por inactividad.`);
        } catch (error) {
          console.error(`Error al enviar mensaje de reinicio a ${from}:`, error);
        }
        // Reiniciar la sesión
        resetSession(from);
      }, 5 * 60 * 1000); // 5 minutos
    } catch (error) {
      console.error(`Error al enviar recordatorio de inactividad a ${from}:`, error);
    }
  }, 10 * 60 * 1000); // 10 minutos
};

// Función para que el agente envíe mensajes al usuario
const sendAgentMessage = (to) => {
  rl.question(`Mensaje para ${to}: `, async (message) => {
    if (message.toLowerCase() === 'exit') {
      console.log(`Finalizó el chat con ${to}`);
      delete agentChats[to];
      if (sessions[to]) {
        sessions[to].agentMode = false;
        resetSession(to);
      }
      try {
        await client.sendMessage(to, 'El agente ha finalizado el chat ✅');
      } catch (error) {
        console.error('Error al enviar mensaje al usuario:', error);
      }

      // Notificar al grupo que el chat ha finalizado
      try {
        await client.sendMessage(
          agentGroupId,
          `🔴 *Chat Finalizado*\n\n` +
          `📱 *Número:* ${to}\n` +
          `🕒 *Hora:* ${moment().tz('America/Argentina/Buenos_Aires').format('YYYY-MM-DD HH:mm:ss')}\n` +
          `📝 *Mensaje Final:* El agente ha finalizado el chat.`
        );
        console.log('Notificación de chat finalizado enviada al grupo.');
      } catch (error) {
        console.error('Error al notificar al grupo sobre el chat finalizado:', error);
      }

    } else {
      try {
        await client.sendMessage(to, message);
        sendAgentMessage(to); // Esperar el siguiente mensaje
      } catch (error) {
        console.error('Error al enviar mensaje al usuario:', error);
        try {
          await client.sendMessage(to, 'Hubo un error al enviar tu mensaje. Por favor, intenta nuevamente.');
        } catch (err) {
          console.error('Error al notificar al usuario sobre el fallo:', err);
        }
      }
    }
  });
};

// Listener unificado para manejar todos los mensajes
client.on('message', async (message) => {
  // Ignorar los mensajes enviados por el bot
  if (message.fromMe) return;

  const from = message.from;
  const normalizedBody = removeDiacritics(message.body).toLowerCase().trim();

  // Manejar comandos desde el grupo
  if (from === agentGroupId) {
    // Comando para finalizar modo agente de un usuario específico
    if (normalizedBody.startsWith('finalizar ')) {
      const parts = normalizedBody.split(' ');
      if (parts.length === 2) {
        const targetNumber = parts[1].replace(/\D/g, ''); // Extraer solo números
        const targetId = `${targetNumber}@c.us`;

        if (sessions[targetId] && sessions[targetId].agentMode) {
          sessions[targetId].agentMode = false;
          delete agentChats[targetId];
          resetSession(targetId);

          try {
            await client.sendMessage(targetId, 'Tu chat con agente ha sido finalizado ✅');
            console.log(`Modo agente finalizado para ${targetId} desde el grupo.`);
          } catch (error) {
            console.error(`Error al notificar al usuario ${targetId} sobre la finalización del modo agente:`, error);
          }

          // Notificar al grupo que el modo agente fue finalizado
          try {
            await client.sendMessage(
              agentGroupId,
              `🔴 *Modo Agente Finalizado*\n\n` +
              `📱 *Número:* ${targetId}\n` +
              `🕒 *Hora:* ${moment().tz('America/Argentina/Buenos_Aires').format('YYYY-MM-DD HH:mm:ss')}\n` +
              `📝 *Mensaje:* El modo agente ha sido finalizado desde el grupo.`
            );
            console.log('Notificación de finalización de modo agente enviada al grupo.');
          } catch (error) {
            console.error('Error al notificar al grupo sobre la finalización del modo agente:', error);
          }
        } else {
          try {
            await client.sendMessage(agentGroupId, `⚠️ No se encontró una sesión activa de agente para el número: ${targetNumber}@c.us.`);
            console.log(`Intento de finalizar modo agente para ${targetId}, pero no está en modo agente.`);
          } catch (error) {
            console.error('Error al enviar mensaje de no encontrado al grupo:', error);
          }
        }
      } else {
        try {
          await client.sendMessage(agentGroupId, '⚠️ Formato inválido. Usa: finalizar <número>');
        } catch (error) {
          console.error('Error al enviar mensaje de formato inválido al grupo:', error);
        }
      }
      return; // Evita procesar más en este listener para comandos del grupo
    }

    // Comando para iniciar el modo agente en el grupo
     // Comando para iniciar modo agente de un usuario específico
     if (normalizedBody.startsWith('iniciar ')) {
      const parts = normalizedBody.split(' ');
      if (parts.length === 2) {
        const targetNumber = parts[1].replace(/\D/g, ''); // Extraer solo los dígitos
        const targetId = `${targetNumber}@c.us`;

        // Si la sesión no existe, crearla
        if (!sessions[targetId]) {
          sessions[targetId] = {
            step: 0,
            data: {},
            agentMode: false,
            timeout: null,
          };
        }

        const targetSession = sessions[targetId];

        if (!targetSession.agentMode) {
          targetSession.agentMode = true;
          agentChats[targetId] = true;

          // Avisar al usuario que el modo agente se ha iniciado
          try {
            await client.sendMessage(
              targetId,
              'Un agente se ha puesto en contacto con usted 🙌🏻\n\n' +
              'Por favor aguarde en línea, para salir del chat con el agente, escriba *"salir"* ~ 🤖'
            );
            console.log(`Modo agente iniciado para ${targetId} desde el grupo.`);
          } catch (error) {
            console.error(`Error al notificar al usuario ${targetId} sobre el inicio del modo agente:`, error);
          }

          // Notificar al grupo que el modo agente fue iniciado
          try {
            await client.sendMessage(
              agentGroupId,
              `🟢 *Modo Agente Iniciado*\n\n` +
              `📱 *Número:* ${targetId}\n` +
              `🕒 *Hora:* ${moment().tz('America/Argentina/Buenos_Aires').format('YYYY-MM-DD HH:mm:ss')}\n` +
              `📝 *Mensaje:* El modo agente ha sido iniciado desde el grupo.`
            );
            console.log('Notificación de inicio de modo agente enviada al grupo.');
          } catch (error) {
            console.error('Error al notificar al grupo sobre el inicio del modo agente:', error);
          }

          // Comenzar a leer desde la terminal para enviar mensajes al usuario
          sendAgentMessage(targetId);
        } else {
          try {
            await client.sendMessage(agentGroupId, `⚠️ El usuario ${targetNumber}@c.us ya se encuentra en modo agente.`);
            console.log(`Intento de iniciar modo agente para ${targetId}, pero ya está en modo agente.`);
          } catch (error) {
            console.error('Error al enviar mensaje de ya en modo agente al grupo:', error);
          }
        }
      } else {
        try {
          await client.sendMessage(agentGroupId, '⚠️ Formato inválido. Usa: iniciar <número>');
        } catch (error) {
          console.error('Error al enviar mensaje de formato inválido al grupo:', error);
        }
      }
      return;
    }
    // AÑADIR MÁS COMANDOS DE GRUPO

    return; // Si no es un comando reconocido, no hacer nada
  }

  // Inicializar la sesión si no existe
  if (!sessions[from]) {
    sessions[from] = {
      step: 0,
      data: {},
      agentMode: false,
      timeout: null,
    };
  }

  const session = sessions[from];

  // Reiniciar el timeout en cada interacción válida
  const resetSessionTimeout = () => {
    resetTimeout(from);
  };

  // Manejar el comando "acepto" para activar el modo agente directamente
  if (normalizedBody === 'acepto') {
    if (!session.agentMode) { // Verificar que el modo agente no esté ya activo
      session.agentMode = true;
      agentChats[from] = true;
      try {
        await client.sendMessage(from, 'Has aceptado contactarte con un agente ✅\nUn momento por favor... 🤖');
      } catch (error) {
        console.error('Error al enviar mensaje al usuario:', error);
      }
      console.log(`El usuario ${from} ha activado el modo agente con el comando 'acepto'.`);

      // Notificar al grupo de agentes
      try {
        await client.sendMessage(
          agentGroupId,
          `🟢 *Nuevo Usuario en Modo Agente*\n\n` +
          `📱 *Número:* ${from}\n` +
          `📅 *Hora:* ${moment().tz('America/Argentina/Buenos_Aires').format('YYYY-MM-DD HH:mm:ss')}\n` +
          `📝 *Mensaje Inicial:* Has aceptado contactarte con un agente.`
        );
        console.log('Notificación de nuevo agente enviada al grupo.');
      } catch (error) {
        console.error('Error al enviar notificación al grupo de agentes:', error);
      }

      sendAgentMessage(from); // Llama a la función que permite al agente enviar mensajes
      resetSessionTimeout();
    } else {
      try {
        await client.sendMessage(from, 'Ya estás en contacto con un agente ✅');
      } catch (error) {
        console.error('Error al enviar mensaje al usuario:', error);
      }
    }
    return;
  }

  // Verificar si la hora actual está fuera del horario de atención
  const currentTime = moment().tz('America/Argentina/Buenos_Aires');
  const currentHour = currentTime.hour();
  if (currentHour < 8 || currentHour >= 16) {
    try {
      await client.sendMessage(
        from,
        'Hola ~ 🤖\n\nNuestro horario laboral es de 08:00 am a 16:00 pm 🕗\n\nSi tiene una *urgencia* su jefe de área deberá ponerse en contacto con el responsable de Sistemas ~ 👨‍💻'
      );
    } catch (error) {
      console.error('Error al enviar mensaje de horario fuera de atención:', error);
    }

    // Reiniciar la sesión
    resetSession(from);

    return;
  }

  if (normalizedBody === 'reiniciar') { // || message.body.toLowerCase() === 'hola'
    resetSession(from);
    try {
      await client.sendMessage(from, 'Hola! ~ 🤖\n\nPara comenzar, escriba *"menu"* ~ 🤖');
    } catch (error) {
      console.error('Error al enviar mensaje de reinicio:', error);
    }
    return;
  }

  // Si el usuario está en modo agente
  if (session.agentMode) {
    if (normalizedBody === 'salir') {
      session.agentMode = false;
      delete agentChats[from];
      resetSession(from);
      try {
        await client.sendMessage(from, 'Ha salido del chat con el agente ✅');
      } catch (error) {
        console.error('Error al enviar mensaje al usuario:', error);
      }
      console.log(`El usuario ${from} ha salido del chat con el agente.`);

      // Notificar al grupo que el chat ha finalizado
      try {
        await client.sendMessage(
          agentGroupId,
          `🔴 *Chat Finalizado*\n\n` +
          `📱 *Número:* ${from}\n` +
          `🕒 *Hora:* ${moment().tz('America/Argentina/Buenos_Aires').format('YYYY-MM-DD HH:mm:ss')}\n` +
          `📝 *Mensaje Final:* El usuario ha salido del chat.`
        );
        console.log('Notificación de chat finalizado enviada al grupo.');
      } catch (error) {
        console.error('Error al notificar al grupo sobre el chat finalizado:', error);
      }

    } else {
      // Reenviar el mensaje del usuario al agente
      console.log(`Mensaje de ${from}: ${message.body}`);
      // Aquí podrías implementar lógica adicional para reenviar mensajes al agente
      resetSessionTimeout(); // Reiniciar el timeout por actividad
    }
    return;
  }

  // Manejar el menú inicial
  if (normalizedBody === 'menu' && session.step <= 0) {
    session.step = 1;
    try {
      await client.sendMessage(
        from,
        '*Bienvenido al ChatBOT! ~* 🤖\n\n' +
        '¿Qué desea realizar el día de hoy? 🤔\n\n Responda con el número de la opción ~ 🤖\n' +
        '*1)* Crear Ticket\n' +
        '*2)* Realizar consulta con un Técnico\n' +
        '*3)* Cancelar'
      );
    } catch (error) {
      console.error('Error al enviar menú inicial:', error);
    }
    resetSessionTimeout();
  } else if (session.step === 1) {
    if (message.body === '1') {
      session.step = 2;
      try {
        await client.sendMessage(
          from,
          'Vamos a crear un ticket 📝\n\n Por favor, digite su nombre y apellido a continuación ~ 🤖'
        );
      } catch (error) {
        console.error('Error al enviar solicitud de nombre:', error);
      }
      resetSessionTimeout();
    } else if (message.body === '2') {
      session.step = 0;
      session.agentMode = true;
      agentChats[from] = true;
      try {
        await client.sendMessage(
          from,
          'Un agente se pondrá en contacto con usted en breves si usted realizó previamente el ticket 🙌🏻 \n\n' +
          'Por favor aguarde en línea, de lo contrario para salir del chat con el agente, escriba *"salir"* ~ 🤖'
        );
      } catch (error) {
        console.error('Error al enviar mensaje al usuario para consulta con técnico:', error);
      }
      console.log(`El usuario ${from} ha solicitado hablar con un agente.`);

      // Notificar al grupo de agentes
      try {
        await client.sendMessage(
          agentGroupId,
          `🟢 *Nuevo Usuario en Modo Agente*\n\n` +
          `📱 *Número:* ${from}\n` +
          `📅 *Hora:* ${moment().tz('America/Argentina/Buenos_Aires').format('YYYY-MM-DD HH:mm:ss')}\n` +
          `📝 *Mensaje Inicial:* Ha solicitado hablar con un agente.`
        );
        console.log('Notificación de nuevo agente enviada al grupo.');
      } catch (error) {
        console.error('Error al enviar notificación al grupo de agentes:', error);
      }

      sendAgentMessage(from); // Iniciar el chat con el agente
      resetSessionTimeout();
    } else if (message.body === '3') {
      // Opción 3: Cancelar
      try {
        await client.sendMessage(from, 'Operación cancelada ✅');
      } catch (error) {
        console.error('Error al enviar mensaje de cancelación:', error);
      }
      resetSession(from); // Reiniciar la sesión sin establecer un nuevo timeout
    } else {
      try {
        await client.sendMessage(from, 'Por favor, elija una opción válida (1, 2 o 3).');
      } catch (error) {
        console.error('Error al enviar mensaje de opción inválida:', error);
      }
      resetSessionTimeout();
    }
  } else if (session.step === 2) {
    session.data.nombre = message.body.trim();
    session.step = 3;
    try {
      await client.sendMessage(
        from,
        '¿Su sector cuenta con número de interno? 🤔\n\n Si tiene, digite los 4 números del mismo, de lo contrario, escriba "NO" ~ 🤖'
      );
    } catch (error) {
      console.error('Error al enviar solicitud de interno:', error);
    }
    resetSessionTimeout();
  } else if (session.step === 3) {
    const respuesta = message.body.trim().toUpperCase();
    session.data.n_interno = respuesta !== 'NO' ? respuesta : null;
    session.step = 4;
    try {
      await client.sendMessage(from, 'A continuación digite el sector donde está ubicado/a físicamente ~ 🤖');
    } catch (error) {
      console.error('Error al enviar solicitud de sector:', error);
    }
    resetSessionTimeout();
  } else if (session.step === 4) {
    session.data.sector = message.body.trim();
    session.step = 5;
    try {
      await client.sendMessage(from, 'Describa brevemente la incidencia de su sector ~ 🤖');
    } catch (error) {
      console.error('Error al enviar solicitud de incidencia:', error);
    }
    resetSessionTimeout();
  } else if (session.step === 5) {
    session.data.incidencia = message.body.trim();

    // Proceder a la etapa de confirmación
    session.step = 6;

    // Construir el mensaje de confirmación
    let confirmationMessage = 'Antes de enviar el ticket, ¿estas respuestas son correctas? 🤔\n\n';
    confirmationMessage += `*1)* Nombre: ${session.data.nombre}\n`;
    confirmationMessage += `*2)* Interno: ${session.data.n_interno ? session.data.n_interno : 'No especificado'}\n`;
    confirmationMessage += `*3)* Sector: ${session.data.sector}\n`;
    confirmationMessage += `*4)* Incidencia: ${session.data.incidencia}\n\n`;
    confirmationMessage += 'Digite el número a modificar en caso de error o digite *"Enviar"* si el ticket está correcto.\n\n';
    confirmationMessage += 'Seleccione el número de la respuesta que desea modificar.';

    try {
      await client.sendMessage(from, confirmationMessage);
    } catch (error) {
      console.error('Error al enviar mensaje de confirmación:', error);
    }
    resetSessionTimeout();
  } else if (session.step === 6) {
    const respuesta = removeDiacritics(message.body).toLowerCase();

    if (respuesta === 'enviar') {
      // Proceder a insertar el ticket en la base de datos

      // Extraer el número de celular del contacto
      const phoneNumber = '+' + from.split('@')[0]; // Agregamos '+' al inicio

      // Insertar el ticket en la base de datos
      try {
        const connection = await mysql.createConnection(dbConfig);
        const ticketData = {
          create_by_user_id: 9,
          title: 'Ticket Generado con CHATBOT',
          nombre: session.data.nombre,
          sector: session.data.sector,
          description: session.data.incidencia,
          status: 'pendiente',
          internal_number: session.data.n_interno,
          classification: 'baja', // Aquí agregamos la clasificación
          creation_date: moment().tz('America/Argentina/Buenos_Aires').format('YYYY-MM-DD HH:mm:ss'),
          celular: phoneNumber, // Añadimos el número de celular al ticket
        };

        const query = 'INSERT INTO support_tickets SET ?';
        await connection.query(query, ticketData);
        await connection.end();

        try {
          await client.sendMessage(
            from,
            'Su ticket fue creado con éxito y un agente será asignado al mismo ✅👨🏻‍💻\n\n Por favor, aguarde la asistencia en su sector 📍'
          );
        } catch (error) {
          console.error('Error al enviar confirmación de ticket creado:', error);
        }

        // Notificar al grupo que se creó un ticket
        try {
          await client.sendMessage(
            agentGroupId,
            `📝 *Ticket Creado*\n\n` +
            `📱 *Número:* ${from}\n` +
            `📅 *Hora:* ${moment().tz('America/Argentina/Buenos_Aires').format('YYYY-MM-DD HH:mm:ss')}\n` +
            `📝 *Detalles:* ${session.data.incidencia}`
          );
          console.log('Notificación de ticket creado enviada al grupo.');
        } catch (error) {
          console.error('Error al notificar al grupo sobre el ticket creado:', error);
        }

      } catch (err) {
        console.error('Error al insertar el ticket en la base de datos:', err);
        try {
          await client.sendMessage(from, 'Hubo un error al crear su ticket. Por favor, intente nuevamente más tarde.');
        } catch (error) {
          console.error('Error al notificar al usuario sobre el fallo:', error);
        }
      }

      // Limpiar y reiniciar la sesión
      resetSession(from);

    } else if (['1', '2', '3', '4'].includes(respuesta)) {
      // El usuario desea modificar una de las respuestas
      session.modifyingField = respuesta; // Almacenar qué campo se está modificando

      if (respuesta === '1') {
        try {
          await client.sendMessage(from, 'Por favor, ingrese nuevamente su nombre y apellido ~ 🤖');
        } catch (error) {
          console.error('Error al solicitar modificación de nombre:', error);
        }
      } else if (respuesta === '2') {
        try {
          await client.sendMessage(
            from,
            '¿Su sector cuenta con número de interno? 🤔\n\n Si tiene, digite los 4 números del mismo, de lo contrario, escriba "NO" ~ 🤖'
          );
        } catch (error) {
          console.error('Error al solicitar modificación de interno:', error);
        }
      } else if (respuesta === '3') {
        try {
          await client.sendMessage(from, 'Por favor, ingrese nuevamente el sector donde está ubicado/a físicamente ~ 🤖');
        } catch (error) {
          console.error('Error al solicitar modificación de sector:', error);
        }
      } else if (respuesta === '4') {
        try {
          await client.sendMessage(from, 'Por favor, describa nuevamente la incidencia de su sector ~ 🤖');
        } catch (error) {
          console.error('Error al solicitar modificación de incidencia:', error);
        }
      }

      session.step = 7; // Proceder a la etapa de modificación
      resetSessionTimeout();
    } else {
      // Entrada inválida, preguntar nuevamente
      try {
        await client.sendMessage(from, 'Por favor, digite un número válido para modificar o escriba *"Enviar"* para confirmar el ticket.');
      } catch (error) {
        console.error('Error al enviar mensaje de entrada inválida:', error);
      }
      resetSessionTimeout();
    }

  } else if (session.step === 7) {
    // Manejar la modificación del campo seleccionado
    const field = session.modifyingField;

    if (field === '1') {
      session.data.nombre = message.body.trim();
    } else if (field === '2') {
      const respuesta = message.body.trim().toUpperCase();
      session.data.n_interno = respuesta !== 'NO' ? respuesta : null;
    } else if (field === '3') {
      session.data.sector = message.body.trim();
    } else if (field === '4') {
      session.data.incidencia = message.body.trim();
    }

    // Después de la modificación, volver a la etapa de confirmación
    session.step = 6;

    // Construir el mensaje de confirmación nuevamente
    let confirmationMessage = 'Antes de enviar el ticket, ¿estas respuestas son correctas? 🤔\n\n';
    confirmationMessage += `*1)* Nombre: ${session.data.nombre}\n`;
    confirmationMessage += `*2)* Interno: ${session.data.n_interno ? session.data.n_interno : 'No especificado'}\n`;
    confirmationMessage += `*3)* Sector: ${session.data.sector}\n`;
    confirmationMessage += `*4)* Incidencia: ${session.data.incidencia}\n\n`;
    confirmationMessage += 'Digite el número a modificar en caso de error o digite *"Enviar"* si el ticket está correcto.\n\n';
    confirmationMessage += 'Seleccione el número de la respuesta que desea modificar.';

    try {
      await client.sendMessage(from, confirmationMessage);
    } catch (error) {
      console.error('Error al reenviar mensaje de confirmación:', error);
    }
    resetSessionTimeout();
  } else if (session.step === 0) {
    try {
      await client.sendMessage(from, 'Hola! ~ 🤖\n\nRecuerde que este ChatBOT es de *INFORMATICA* 💻\n\nPara comenzar, escriba *"menu"* ~ 🤖');
      session.step = -1; // Actualizamos el step para evitar saludos repetidos
    } catch (error) {
      console.error('Error al enviar mensaje de saludo inicial:', error);
    }
  }
});

// Inicializar el cliente
client.initialize();
