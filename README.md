Bienvenido/a a ChatBot

ChatBot es un bot desarrollado en Node.js que permite gestionar interacciones con usuarios a través de WhatsApp. Este bot está pensado para integrarse con iTicket, aunque puede ser adaptado a otras necesidades.
Instrucciones de Instalación

  Clonar el Repositorio
  Descargá o cloná este repositorio en tu máquina local.

  Instalar Dependencias
  Abrí una terminal dentro de la carpeta del proyecto y ejecutá:

    npm install

Esto descargará automáticamente todas las dependencias necesarias.

Iniciar el Bot
Una vez finalizada la instalación, iniciá el bot con:

    node index.js

En el primer inicio, se generará un código QR en la terminal. Escanealo con el celular cuyo WhatsApp querés vincular. Una vez escaneado, el bot indicará que está listo.

Configuración de Notificaciones en un Grupo

El bot puede enviar notificaciones a un grupo de WhatsApp, por ejemplo, informando sobre tickets creados o usuarios que ingresaron al modo agente.

Con el bot iniciado, escribí en la terminal:

    listar

Esto mostrará todos los chats detectados, incluyendo el grupo.

Buscá en la lista la ID del grupo que vas a utilizar (por ejemplo, algo del estilo 1203630XXXXXX@g.us).

Abrí el archivo index.js y localizá la línea donde se define agentGroupId. Pegá la ID del grupo copiada. Por ejemplo:

const agentGroupId = '1203630XXXXXX@g.us'; // ID del grupo conocido

Guardá los cambios, detené el bot (Ctrl + C en la terminal) y volvé a iniciarlo con:

    node index.js

Comandos Disponibles en el Grupo

Si el chatbot es administrador del grupo, los usuarios en el mismo podrán ejecutar los siguientes comandos:

Iniciar modo agente:

    iniciar <54911xxxxxxxx>

(Ejemplo: iniciar 5491123456789)

Esto forzará a ese número a ingresar al modo agente con el bot.

Finalizar modo agente:

    finalizar <54911xxxxxxxx>

(Ejemplo: finalizar 5491123456789)

Esto finalizará el modo agente para el número especificado.

