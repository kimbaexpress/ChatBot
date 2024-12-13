
![Sin título-2](https://github.com/user-attachments/assets/4a277518-35aa-4bbd-babe-8dd9fa690aa5)

Bienvenido/a al proyecto ChatBot

Este ChatBot está desarrollado en JavaScript y se ejecuta utilizando Node.js como entorno de tiempo de ejecución. Aprovecha la librería whatsapp-web.js para conectarse a WhatsApp mediante WebSockets, simular la interacción con la web de WhatsApp y ofrecer funcionalidades de envío y recepción de mensajes. Además, utiliza la librería mysql2/promise para conectarse a una base de datos MySQL, y moment-timezone para gestionar de forma adecuada las zonas horarias en todas las operaciones relacionadas con fechas y horas. La integración con Node.js facilita la instalación de dependencias vía npm, la escalabilidad del código y la ejecución continua del bot en servidores o máquinas locales sin la necesidad de un entorno de navegador.

Recordá que el ChatBOT funciona con el proyecto iTicket, te invito a visualizar el repositorio para implementarlo.
https://github.com/kimbaexpress/iTicket

Instrucciones de Instalación

  1- Clonar el Repositorio
  
  Descargá o cloná este repositorio en tu máquina local.

  Instalar Dependencias
  Abrí una terminal dentro de la carpeta del proyecto y ejecutá:

    npm install

Esto descargará automáticamente todas las dependencias necesarias.

2- Iniciar el Bot

Una vez finalizada la instalación, iniciá el bot con:

    node index.js

En el primer inicio, se generará un código QR en la terminal. Escanealo con el celular cuyo WhatsApp querés vincular. Una vez escaneado, el bot indicará que está listo.

3- Configuración de Notificaciones en un Grupo

El bot puede enviar notificaciones a un grupo de WhatsApp, por ejemplo, informando sobre tickets creados o usuarios que ingresaron al modo agente.

Con el bot iniciado, escribí en la terminal:

    listar

Esto mostrará todos los chats detectados, incluyendo el grupo.

4- Buscá en la lista la ID del grupo que vas a utilizar (por ejemplo, algo del estilo 1203630XXXXXX@g.us).

Abrí el archivo index.js y localizá la línea donde se define agentGroupId. Pegá la ID del grupo copiada. Por ejemplo:

const agentGroupId = '1203630XXXXXX@g.us'; // ID del grupo conocido

Guardá los cambios, detené el bot (Ctrl + C en la terminal) y volvé a iniciarlo con:

    node index.js

5- Comandos Disponibles en el Grupo

Si el chatbot es administrador del grupo, los usuarios en el mismo podrán ejecutar los siguientes comandos:

Iniciar modo agente:

    iniciar <54911xxxxxxxx>

(Ejemplo: iniciar 5491123456789)

Esto forzará a ese número a ingresar al modo agente con el bot.

Finalizar modo agente:

    finalizar <54911xxxxxxxx>

(Ejemplo: finalizar 5491123456789)

Esto finalizará el modo agente para el número especificado.

____________________________________________________________________________________________________________________________________________________________

Ejemplo del funcionamiento


![example](https://github.com/user-attachments/assets/c0e0ba49-6e65-47d1-b9ab-3a703e50149d)
