const os = {
    // Control de la capa Z (para que la ventana activa esté siempre encima)
    zIndex: 100,
    // Memoria RAM: Guarda las instancias de las ventanas DIV que están abiertas/minimizadas
    activeApps: new Map(),

    // --- VARIABLES DE ESTADO DEL JUEGO (Narrativa) ---
    wifiConnected: false, // Estado de la conexión Wi-Fi
    hasNewMail: false,    // Indica si hay un nuevo correo misterioso
    chatUser: null,       // Nombre de usuario del jugador en Chatting
    foxWorldInstalled: false, // Indica si FoxWorld está instalado
    // Etapas de la historia para desbloquear acciones y diálogos
    storyStage: 0, // 0: Inicio, 1: Preguntó por escuela, 2: Instaló FoxWorld, 3: Entró a OmniNet, 4: Recibió Foto Persona
    netSpeedInterval: null, // Intervalo para la variación de velocidad en FoxWorld
    pendingApp: {},       // Guarda qué app y contraseña se intentan abrir
    
    // Historial del chat (ahora un array de objetos para guardar emisor y texto)
    chatHistoryData: [], 
    // Contenido del correo (para futuros correos)
    mailData: {
        inbox: [], 
        sent: []
    },

    // --- SISTEMA DE ARRASTRE DE VENTANAS (PC y Móvil compatible) ---
    dragWindow(e, el) {
        el.style.zIndex = ++this.zIndex; // Trae la ventana al frente

        // Obtiene las coordenadas iniciales del clic/toque
        let startX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        let startY = e.clientY || (e.touches ? e.touches[0].clientY : 0);
        let startLeft = el.offsetLeft; // Posición inicial de la ventana
        let startTop = el.offsetTop;

        const onMove = (moveEvent) => {
            // Coordenadas actuales del puntero/dedo
            let currentX = moveEvent.clientX || (moveEvent.touches ? moveEvent.touches[0].clientX : 0);
            let currentY = moveEvent.clientY || (moveEvent.touches ? moveEvent.touches[0].clientY : 0);
            
            // Cálculo del desplazamiento
            let dx = currentX - startX;
            let dy = currentY - startY;
            
            // Nuevas posiciones de la ventana
            let finalLeft = startLeft + dx;
            let finalTop = startTop + dy;

            // Límites de la pantalla (paredes invisibles)
            const maxX = window.innerWidth - el.offsetWidth;
            const maxY = window.innerHeight - el.offsetHeight - 40; // 40px es la altura de la barra de tareas

            // Asegura que la ventana no se salga de los límites
            el.style.left = Math.max(0, Math.min(finalLeft, maxX)) + 'px';
            el.style.top = Math.max(0, Math.min(finalTop, maxY)) + 'px';
        };

        const onUp = () => {
            // Limpia los event listeners para detener el arrastre
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onUp);
        };
        
        // Asigna los event listeners para mouse y touch
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, { passive: false }); // 'passive: false' para prevenir el scroll en iOS
        document.addEventListener('touchend', onUp);
    },

    // --- MOTOR DE VENTANAS PERSISTENTE (create/minimize/destroy) ---
    createWindow(id, title, contentHTML, isLarge = false, iconImg = null) {
        // 1. Si la ventana ya existe en la memoria (está minimizada o abierta), la restaura
        if(this.activeApps.has(id)) {
            const win = this.activeApps.get(id);
            win.style.display = 'flex'; // La hace visible de nuevo
            win.style.zIndex = ++this.zIndex; // La trae al frente
            
            // Elimina el icono de la barra de tareas si existía
            const taskIcon = document.getElementById('task-' + id);
            if(taskIcon) taskIcon.remove(); 
            
            // Para apps complejas (Chat, Mail, FoxWorld), forzamos una re-renderización para actualizar el contenido
            if (id === 'chat-win') this.renderChatInterface(true); // 'true' indica que es una restauración
            else if (id === 'mail-win') this.renderMailContent(win); // Actualiza la bandeja de entrada
            else if (id === 'foxworld-win') this.openFoxWorld(true); // Restaura el estado de la página de FoxWorld

            return win; // Devuelve la ventana restaurada
        }

        // 2. Si la ventana no existe en la memoria, la crea desde cero
        const win = document.createElement('div');
        win.id = id;
        win.className = 'window';
        
        // Ajuste de tamaño para PC vs Móvil
        const isMobile = window.innerWidth < 600;
        let wWidth = isLarge ? (isMobile ? window.innerWidth * 0.95 : 700) : (isMobile ? window.innerWidth * 0.85 : 350);
        let wHeight = isLarge ? (isMobile ? window.innerHeight * 0.8 : 450) : 'auto';
        
        win.style.width = wWidth + 'px';
        if(wHeight !== 'auto') win.style.height = wHeight + 'px';
        
        // Centrar la ventana en la pantalla al abrirla
        const winHeightNum = wHeight === 'auto' ? 250 : parseInt(wHeight);
        win.style.left = (window.innerWidth - wWidth) / 2 + 'px';
        win.style.top = Math.max(50, (window.innerHeight - winHeightNum) / 2) + 'px'; // Mínimo 50px del techo
        win.style.zIndex = ++this.zIndex;

        // Botones de control de la barra de título (_ para minimizar, X para cerrar)
        const minBtn = iconImg ? `<button onclick="os.minimizeWindow('${id}', '${iconImg}')">_</button>` : '';

        win.innerHTML = `
            <div class="title-bar" onmousedown="os.dragWindow(event, this.parentElement)" ontouchstart="os.dragWindow(event, this.parentElement)">
                <span>${title}</span>
                <div class="title-controls">
                    ${minBtn}
                    <button onclick="os.closeWindow('${id}', true)">X</button>
                </div>
            </div>
            <div class="content" style="${isLarge ? 'padding:0;' : ''}">${contentHTML}</div>
        `;
        document.body.appendChild(win);
        this.activeApps.set(id, win); // Guarda la nueva ventana en la memoria RAM
        return win;
    },

    // Minimiza la ventana (la oculta y crea un icono en la barra de tareas)
    minimizeWindow(id, iconImg) {
        const win = this.activeApps.get(id);
        win.style.display = 'none'; // Oculta la ventana

        // Crea el icono en la barra de tareas si no existe ya
        if(!document.getElementById('task-' + id)) {
            const taskArea = document.getElementById('taskbar-apps');
            const img = document.createElement('img');
            img.id = 'task-' + id;
            img.src = iconImg;
            img.className = 'task-icon';
            img.onclick = () => {
                // Al hacer clic en el icono de la barra de tareas, restaura la ventana
                this.createWindow(id, win.querySelector('.title-bar span').innerText, '', true); 
                img.remove(); // Y elimina el icono de la barra de tareas
            };
            taskArea.appendChild(img);
        }
    },

    // Cierra la ventana. Si destroy=true, la elimina de la memoria RAM.
    closeWindow(id, destroy = false) {
        if(this.activeApps.has(id)) {
            if (destroy) {
                this.activeApps.get(id).remove(); // Elimina el elemento DIV del HTML
                this.activeApps.delete(id); // Elimina de la memoria RAM
                const taskIcon = document.getElementById('task-' + id);
                if(taskIcon) taskIcon.remove(); // Elimina el icono de la barra de tareas
            } else {
                this.activeApps.get(id).style.display = 'none'; // Solo oculta la ventana (minimiza)
            }
        }
    },

    // --- VARIABLES DE ESTADO DEL JUEGO (Narrativa y datos persistentes) ---
    wifiConnected: false,
    hasNewMail: false, // Indica si hay un nuevo correo misterioso
    chatUser: null, // Nombre de usuario del jugador en Chatting
    foxWorldInstalled: false, // Indica si FoxWorld está instalado
    storyStage: 0, // 0: Inicio, 1: Preguntó por escuela, 2: Instaló FoxWorld, 3: Entró a OmniNet, 4: Recibió Foto Persona
    netSpeedInterval: null, // Intervalo para la variación de velocidad en FoxWorld
    pendingApp: {}, // Guarda qué app y contraseña se intentan abrir
    
    // Historial del chat (ahora un array de objetos para guardar emisor y texto)
    chatHistoryData: [], 
    // Contenido del correo (un array para futuros correos)
    mailData: {
        inbox: [], 
        sent: []
    },

    // --- LÓGICA DE APLICACIONES ---
    
    // APP: WIFI
    openWifiWindow() {
        const statusText = this.wifiConnected ? "<span style='color:#0f0'>Conectado</span>" : "<span style='color:red'>Desconectado</span>";
        this.createWindow('wifi-win', 'Redes', `
            <div style="background: #111; color: #0f0; text-align:center; padding:15px; height:100%;">
                <h3 style="margin-top:0;">Terminal NET-CONNECT</h3>
                <p>Estado: <b id="wifi-status-text">${statusText}</b></p>
                <div id="wifi-form" style="${this.wifiConnected ? 'display:none;' : 'display:block;'}">
                    <input type="text" id="wifi-user" placeholder="Usuario">
                    <input type="password" id="wifi-pass" placeholder="Contraseña">
                    <br><br><button onclick="os.connectWifi()" style="background:#333; color:#0f0; border:1px solid #0f0; width:100%;">CONECTAR</button>
                </div>
            </div>
        `, false, 'wifi.png'); // Se puede especificar un icono si quieres para minimizar esta app
    },

    connectWifi() {
        const user = document.getElementById('wifi-user').value;
        const pass = document.getElementById('wifi-pass').value;

        if (user === 'admin' && pass === 'cyber123') {
            this.wifiConnected = true;
            document.getElementById('wifi-status-text').innerHTML = "<span style='color:#0f0'>Red Oculta OK</span>";
            document.getElementById('wifi-form').style.display = 'none';
            document.getElementById('wifi-icon').innerHTML = "📶 Conectado"; // Cambia el icono en la barra de tareas
            document.getElementById('wifi-icon').style.color = "#0f0";
        } else {
            alert("Acceso denegado. Credenciales inválidas.");
        }
    },

    // APP: CHATTING
    openChatApp() {
        if (!this.wifiConnected) { // Si no hay conexión, muestra error
            this.createWindow('chat-err', 'Chatting - Error', `<div style="text-align:center; padding:20px; color:red; font-weight:bold;">❌ NO TIENES CONEXIÓN<br><br><span style="color:black; font-weight:normal;">Conéctate a una red Wi-Fi para usar esta aplicación.</span></div>`, false, 'chatting.png');
            return;
        }

        if (!this.chatUser) { // Si el usuario no se ha registrado, pide nombre
            this.createWindow('chat-login', 'Chatting - Registro', `
                <div style="text-align:center; padding:20px;">
                    <h3>Bienvenido a Chatting</h3>
                    <p>Elige tu nombre de usuario:</p>
                    <input type="text" id="chat-username" placeholder="Tu usuario...">
                    <br><br><button onclick="os.registerChatUser()" style="width:100%;">Entrar al Chat</button>
                </div>
            `, false, 'chatting.png');
            return;
        }

        this.renderChatInterface(); // Abre el chat si ya hay usuario y conexión
    },

    registerChatUser() {
        const val = document.getElementById('chat-username').value.trim();
        if(!val) return alert("Por favor, escribe un nombre.");
        this.chatUser = val;
        
        this.closeWindow('chat-login', true); // Destruye la ventana de registro
        this.renderChatInterface();
    },

    renderChatInterface(restore = false) {
        const win = this.createWindow('chat-win', 'Chatting v1.2', `
            <div class="chat-container">
                <div class="chat-sidebar"><div style="color: #43b581; font-weight:bold;">Directos</div><div style="color: #fff; margin-top: 10px; background: #3a3a4a; padding:5px; border-radius:4px;">👤 xX_Z3r0_Xx</div></div>
                <div class="chat-main"><div class="chat-messages" id="chat-msgs"></div><div class="chat-input-area" id="chat-controls"></div></div>
            </div>
        `, true, 'chatting.png'); // Le pasamos el icono para minimizar

        const msgsContainer = win.querySelector('#chat-msgs');
        const controlsContainer = win.querySelector('#chat-controls');
        
        // Reconstruye el historial del chat desde `chatHistoryData`
        msgsContainer.innerHTML = `<div style="text-align:center; color:#888; font-size:12px;">Conectado como: ${this.chatUser}</div>`;
        this.chatHistoryData.forEach(msg => {
            msgsContainer.innerHTML += `<div class="msg ${msg.sender}">${msg.text}</div>`;
        });
        msgsContainer.scrollTop = msgsContainer.scrollHeight;

        // Reconstruye los controles (burbujas)
        if (restore && win.dataset.controlsState) { // Si viene de restaurar y tenía controles guardados
            controlsContainer.innerHTML = win.dataset.controlsState;
        } else if (this.chatHistoryData.length === 0) { // Inicio de conversación
            setTimeout(() => {
                if(!this.activeApps.has('chat-win')) return;
                msgsContainer.innerHTML += `<div class="msg received"><b>xX_Z3r0_Xx:</b> Hola bro</div>`;
                this.chatHistoryData.push({sender:'received', text:'<b>xX_Z3r0_Xx:</b> Hola bro'});
                controlsContainer.innerHTML = `<button class="bubble-btn" onclick="os.sendBubble('Hola, me enseñas el trabajo q hablamos en la escuela', 1)">"Hola, me enseñas el trabajo q hablamos en la escuela"</button>`;
                win.dataset.controlsState = controlsContainer.innerHTML; // Guardar estado de controles
            }, 1500);
        } else { // Si ya hay historial, pero no estaba en pausa (mantiene el último estado de los controles)
             if (this.storyStage === 1) controlsContainer.innerHTML = `<div style="color:#888; text-align:center; font-style:italic;">Revisa tu correo.</div>`;
             else if (this.storyStage === 2) controlsContainer.innerHTML = `<div style="color:#888; text-align:center; font-style:italic;">Esperando a que abras el navegador...</div>`;
             else if (this.storyStage === 3) controlsContainer.innerHTML = `<button class="bubble-btn" onclick="os.sendBubble('que significa esto', 3)">"¿qué significa esto?"</button>`;
             else if (this.storyStage === 4) controlsContainer.innerHTML = `<div style="color:#888; text-align:center; font-style:italic;">Revisa tu navegador.</div>`;
             else controlsContainer.innerHTML = `<div style="color:#888; text-align:center; font-style:italic;">No puedes enviar más mensajes.</div>`;
             win.dataset.controlsState = controlsContainer.innerHTML;
        }
    },
    
    sendBubble(text, stage) {
        const win = this.activeApps.get('chat-win');
        const msgs = win.querySelector('#chat-msgs');
        const controls = win.querySelector('#chat-controls');
        
        // Mensaje del jugador
        msgs.innerHTML += `<div class="msg sent"><b>${this.chatUser}:</b> ${text}</div>`;
        this.chatHistoryData.push({sender:'sent', text:`<b>${this.chatUser}:</b> ${text}`});
        msgs.scrollTop = msgs.scrollHeight;
        controls.innerHTML = `<div style="color:#888; text-align:center; font-style:italic;">xX_Z3r0_Xx está escribiendo...</div>`;
        
        // Guardamos progreso del chat
        win.dataset.history = msgs.innerHTML;
        win.dataset.controlsState = controls.innerHTML;

        // Respuestas del amigo en secuencia
        setTimeout(() => {
            if(!this.activeApps.has('chat-win')) return;

            let replyText = '';
            let nextControlHTML = '';

            if (stage === 1) { 
                replyText = `<b>xX_Z3r0_Xx:</b> te mande un navegador privado y seguro viene con VPN incluido.`;
                nextControlHTML = `<div style="color:#888; text-align:center; font-style:italic;">Revisa tu correo.</div>`;
                this.storyStage = 1;
                this.hasNewMail = true; 
                document.getElementById('email-badge').style.display = 'block';
                this.forceUpdateMailWindow(); // Asegura que el correo aparezca si la app ya estaba abierta
            } 
            else if (stage === 2) { 
                replyText = `<b>xX_Z3r0_Xx:</b> Bueno me contaste en la escuela q tu internet era algo malo vamos a mejorar eso. Entra en el navegador y verás.`;
                nextControlHTML = `<div style="color:#888; text-align:center; font-style:italic;">Esperando a que abras el navegador...</div>`;
                this.storyStage = 2;
                this.updateBrowserLinks(); // Desbloquea OmniNet
            }
            else if (stage === 3) { 
                // Mensajes secuenciales en el chat
                msgs.innerHTML += `<div class="msg received"><b>xX_Z3r0_Xx:</b> vamos a mejorar tu internet mediante un pococ de codigo.</div>`;
                this.chatHistoryData.push({sender:'received', text:`<b>xX_Z3r0_Xx:</b> vamos a mejorar tu internet mediante un pococ de codigo.`});
                msgs.scrollTop = msgs.scrollHeight;
                
                setTimeout(() => {
                    if(!this.activeApps.has('chat-win')) return;
                    msgs.innerHTML += `<div class="msg received"><b>xX_Z3r0_Xx:</b> <img src="persona1.png" class="chat-image"></div>`;
                    this.chatHistoryData.push({sender:'received', text:`<b>xX_Z3r0_Xx:</b> <img src="persona1.png" class="chat-image">`});
                    msgs.scrollTop = msgs.scrollHeight;
                }, 1500); // 1.5 segundos de pausa para la imagen
                
                setTimeout(() => {
                    if(!this.activeApps.has('chat-win')) return;
                    msgs.innerHTML += `<div class="msg received"><b>xX_Z3r0_Xx:</b> este sera tu objetivo entra a la pagina de escaneo de caras.</div>`;
                    this.chatHistoryData.push({sender:'received', text:`<b>xX_Z3r0_Xx:</b> este sera tu objetivo entra a la pagina de escaneo de caras.`});
                    controls.innerHTML = `<div style="color:#888; text-align:center; font-style:italic;">Revisa tu navegador.</div>`;
                    this.storyStage = 4;
                    this.updateBrowserLinks(); // Desbloquea Facescan
                    
                    win.dataset.controlsState = controls.innerHTML; // Guardamos el estado final de los controles
                    msgs.scrollTop = msgs.scrollHeight;
                }, 3000); // 3 segundos de pausa para el último mensaje
                return; // Importante para no continuar el flujo normal de replyText/nextControlHTML
            }
            
            msgs.innerHTML += `<div class="msg received">${replyText}</div>`;
            this.chatHistoryData.push({sender:'received', text:replyText});
            controls.innerHTML = nextControlHTML;
            
            msgs.scrollTop = msgs.scrollHeight;
            win.dataset.history = msgs.innerHTML; // Guardamos el historial actualizado
            win.dataset.controlsState = controls.innerHTML;
        }, 2000); // Pausa general de 2 segundos antes de la respuesta
    },

    // APP: CORREO (NEXUSMAIL) - Ahora siempre se reconstruye desde mailData
    forceUpdateMailWindow() {
        // Añadir el correo a mailData si aún no está (para no duplicar)
        if (this.hasNewMail && !this.mailData.inbox.some(mail => mail.id === 'mystery-mail')) {
            this.mailData.inbox.push({
                id: 'mystery-mail',
                from: 'xⱫɆⱤØ_Ⱨ₳₵₭x',
                subject: 'instalalo...',
                read: false,
                content: `
                    <h3>Navegador Seguro</h3><p>Instalalo.</p>
                    <div style="background:#eee; padding:15px; border:1px solid #ccc; margin-top:15px; display:flex; align-items:center; justify-content:space-between;">
                        <b style="font-size:16px;">FoxWorld</b>
                        <button id="dl-fox-btn" onclick="os.startFoxDownload()" style="background:#28a745; color:white; border:none; padding:8px 15px; cursor:pointer; font-weight:bold; border-radius:4px;">⬇️ Descargar</button>
                    </div>
                    <div id="prog-area" style="display:none; margin-top:15px;"><p style="margin:0 0 5px 0; font-size:12px; color:#555;">Descargando archivos...</p><progress id="fox-prog" value="0" max="100"></progress></div>
                    <div id="install-area" style="display:none; margin-top:20px; text-align:center;">
                        <p><b>¿Desea instalar el programa?</b></p>
                        <button onclick="os.installFoxWorld()" style="background:#0078d7; color:white; padding:10px 25px; border:none; border-radius:4px; cursor:pointer; font-weight:bold; font-size:16px;">Aceptar</button>
                    </div>
                `
            });
        }
        
        const mailWin = this.activeApps.get('mail-win');
        if (mailWin) { // Si la ventana está en memoria, la forzamos a re-renderizar
            this.renderMailContent(mailWin); // 'true' para indicar que se restaura
        }
    },

    openMailApp(restore = false) {
        document.getElementById('email-badge').style.display = 'none';
        
        const win = this.createWindow('mail-win', 'NexusMail v3', `
            <div class="mail-container">
                <div class="mail-sidebar"><div style="background:#34495e;">Inbox</div><div>Sent</div></div>
                <div class="mail-list" id="mail-list-col"></div>
                <div class="mail-view" id="mail-view-content"><div style="text-align:center; color:#ccc; margin-top:50px;">Selecciona un correo.</div></div>
            </div>
        `, true, 'correo.png'); // Ícono para minimizar

        this.renderMailContent(win); // Llama a la función para renderizar la bandeja de entrada
    },

    renderMailContent(win) {
        const mailListCol = win.querySelector('#mail-list-col');
        const mailViewContent = win.querySelector('#mail-view-content');

        if (this.mailData.inbox.length === 0) {
            mailListCol.innerHTML = `<div style="padding:15px; color:#999; text-align:center;">Bandeja vacía</div>`;
            mailViewContent.innerHTML = `<div style="text-align:center; color:#ccc; margin-top:50px;">Selecciona un correo.</div>`;
        } else {
            mailListCol.innerHTML = ''; // Limpia antes de añadir
            this.mailData.inbox.forEach(mail => {
                const mailItemClass = mail.read ? 'mail-item' : 'mail-item unread';
                mailListCol.innerHTML += `
                    <div class="${mailItemClass}" id="${mail.id}" onclick="os.readMysteriousMail('${mail.id}')">
                        <div style="font-weight:bold; font-family:monospace;">${mail.from}</div>
                        <div style="font-size:12px; color:#555;">${mail.subject}</div>
                    </div>
                `;
            });
            // Si el correo estaba abierto y lo cerramos, lo reabrimos en el mismo punto
            if(win.dataset.currentMailId) {
                this.readMysteriousMail(win.dataset.currentMailId);
            }
        }
    },

    readMysteriousMail(mailId) {
        const mail = this.mailData.inbox.find(m => m.id === mailId);
        if(!mail) return;

        mail.read = true; // Marcar como leído
        const mailItemElement = document.getElementById(mailId);
        if(mailItemElement) mailItemElement.classList.remove('unread'); // Quitar estilo unread

        const mailViewContent = document.getElementById('mail-view-content');
        mailViewContent.innerHTML = `
            <div class="mail-header"><h2>Navegador Seguro</h2><p><b>De:</b> ${mail.from} (Cifrado)</p></div>
            <div style="font-size: 14px; line-height: 1.5; color: #222;">
                ${mail.content}
            </div>
        `;
        // Guardar qué correo se está viendo actualmente
        this.activeApps.get('mail-win').dataset.currentMailId = mailId;
    },

    startFoxDownload() {
        document.getElementById('dl-fox-btn').style.display = 'none';
        document.getElementById('prog-area').style.display = 'block';
        let val = 0;
        const prog = document.getElementById('fox-prog');
        
        const interval = setInterval(() => {
            val += 2; // Velocidad de descarga moderada
            prog.value = val;
            if(val >= 100) {
                clearInterval(interval);
                document.getElementById('prog-area').style.display = 'none';
                document.getElementById('install-area').style.display = 'block';
            }
        }, 90); // Se actualiza cada 90ms
    },

    installFoxWorld() {
        this.foxWorldInstalled = true;
        this.hasNewMail = false; // El correo se borra tras la instalación

        // Eliminar el correo de la bandeja de entrada (del array de estado)
        this.mailData.inbox = this.mailData.inbox.filter(m => m.id !== 'mystery-mail');
        
        // Cierra y elimina la ventana de correo de la memoria
        const mailWindow = this.activeApps.get('mail-win');
        if (mailWindow) {
            this.closeWindow('mail-win', true); 
        }

        // Crear icono dinámico en escritorio (FoxWorld) si no existe
        if (!document.getElementById('foxworld-icon')) {
            const desktop = document.getElementById('desktop');
            const newIcon = document.createElement('div');
            newIcon.id = 'foxworld-icon';
            newIcon.className = 'icon';
            newIcon.onclick = () => os.openFoxWorld();
            newIcon.innerHTML = `<img src="navegador.png" alt="FoxWorld"><span>FoxWorld</span>`;
            
            // Insertar FoxWorld a la derecha de "Mis Archivos"
            const iconArchivos = document.getElementById('icon-archivos');
            desktop.insertBefore(newIcon, iconArchivos.nextSibling);
        }

        // Activar la nueva respuesta en el chat
        const chatWin = this.activeApps.get('chat-win');
        if(chatWin) {
            const controls = chatWin.querySelector('#chat-controls');
            controls.innerHTML = `<button class="bubble-btn" onclick="os.sendBubble('listo ya lo instale', 2)">"listo ya lo instale"</button>`;
            chatWin.dataset.controlsState = controls.innerHTML; // Guardar estado
        }

        alert("Instalación exitosa. FoxWorld se ha añadido al escritorio.");
    },

    // APP: NAVEGADOR FOXWORLD
    openFoxWorld(restore = false) {
        const win = this.createWindow('foxworld-win', 'FoxWorld VPN', `
            <div class="foxworld-browser">
                <div class="fw-header">
                    <!-- Barra de direcciones bloqueada para escritura manual -->
                    <input type="text" id="fw-url-input" class="fw-address-bar" value="https://voidsearch.onion" readonly>
                </div>
                <div class="fw-links-bar" id="fw-links">
                    <span style="color:#777; font-size:12px; margin-right:10px;">Enlaces Interceptados:</span>
                </div>
                <div class="fw-content" id="fw-main-content">
                    <h1>VoidSearch</h1>
                    <p style="color:#555;">Búsqueda manual desactivada. Protocolo de seguridad activo.</p>
                </div>
                <div class="fw-footer">
                    <div class="vpn-status">● VPN ACTIVA</div>
                    <div>NET: <span id="fw-net-speed">1.0</span> MB/s | CPU: 15%</div>
                </div>
            </div>
        `, true, 'navegador.png'); // Icono para minimizar

        // Restaurar URL y contenido si la ventana ya existía
        if(restore && win.dataset.currentUrl) {
            win.querySelector('#fw-url-input').value = win.dataset.currentUrl;
            win.querySelector('#fw-main-content').innerHTML = win.dataset.currentContent;
        }

        if (!this.netSpeedInterval) { // Inicia la variación de red una sola vez
            this.updateNetworkSpeed();
        }
        this.updateBrowserLinks(); // Carga los enlaces disponibles según la historia
    },
    
    updateNetworkSpeed() {
        this.netSpeedInterval = setInterval(() => {
            const speedEl = document.getElementById('fw-net-speed');
            if(speedEl) {
                // Genera un número aleatorio entre 1.0 y 2.5 para simular inestabilidad
                const speed = (Math.random() * (2.5 - 1.0) + 1.0).toFixed(1);
                speedEl.innerText = speed;
            }
        }, 1200); // Cambia cada 1.2 segundos para que sea perceptible
    },

    updateBrowserLinks() {
        const linksBar = document.getElementById('fw-links');
        if(!linksBar) return;
        
        let linksHTML = `<span style="color:#777; font-size:12px; margin-right:10px;">Enlaces Interceptados:</span>`;
        if (this.storyStage >= 2) { // Desbloqueado después de que tu amigo te dice que revises el navegador
            linksHTML += `<button class="fw-link-btn" onclick="os.loadURL('omninet')">🌐 omninet.corp</button>`;
        }
        if (this.storyStage >= 4) { // Desbloqueado después de que te mandan la foto
            linksHTML += `<button class="fw-link-btn" onclick="os.loadURL('facescan')">👁️ facescan.onion</button>`;
        }
        linksBar.innerHTML = linksHTML;
    },

    loadURL(urlType) {
        const win = this.activeApps.get('foxworld-win');
        if(!win) return;
        const urlInput = win.querySelector('#fw-url-input');
        const content = win.querySelector('#fw-main-content');

        if (urlType === 'omninet') {
            urlInput.value = "https://omninet.corp/internal"; // Actualiza la barra de direcciones
            content.innerHTML = `
                <div class="omninet-page">
                    <div class="logo">OMNINET</div>
                    <h1>Conectando el Futuro. Hoy.</h1>
                    <p>OmniNet es la columna vertebral digital de nuestra era. Innovación, seguridad y una red global sin precedentes al alcance de tu mano.</p>
                    <button class="omninet-btn">Explora Nuestros Servicios</button>
                    <div class="omninet-features">
                        <div class="omninet-feature-item"><span class="icon" style="color:#4CAF50;">⚡</span><p>Velocidad Insuperable</p></div>
                        <div class="omninet-feature-item"><span class="icon" style="color:#4CAF50;">🔒</span><p>Seguridad Avanzada</p></div>
                        <div class="omninet-feature-item"><span class="icon" style="color:#4CAF50;">🌍</span><p>Cobertura Global</p></div>
                    </div>
                </div>
            `;
            if (this.storyStage === 2) {
                this.storyStage = 3; // Pasa a la siguiente etapa de la historia
                const chatWin = this.activeApps.get('chat-win');
                if(chatWin) {
                    const controls = chatWin.querySelector('#chat-controls');
                    controls.innerHTML = `<button class="bubble-btn" onclick="os.sendBubble('que significa esto', 3)">"¿qué significa esto?"</button>`;
                    chatWin.dataset.controlsState = controls.innerHTML; // Guardar estado del chat
                }
            }
        } 
        else if (urlType === 'facescan') {
            urlInput.value = "https://facescan.onion/target"; // Actualiza la barra de direcciones
            content.innerHTML = `
                <div class="scan-page">
                    <h3 style="margin-top:0;">> INICIANDO PROTOCOLO DE RECONOCIMIENTO...</h3>
                    <div class="scan-container">
                        <img src="persona1.png" alt="Target">
                        <div class="scan-line"></div>
                    </div>
                    <div id="scan-results" class="scan-data">Analizando biometría...</div>
                </div>
            `;

            setTimeout(() => {
                const results = document.getElementById('scan-results');
                if(results) {
                    results.style.display = 'block';
                    results.innerHTML = `
                        <p>> <b>MATCH ENCONTRADO (99.8%)</b></p>
                        <p>> <b>Nombre:</b> Arthur Pendelton</p>
                        <p>> <b>Puesto:</b> Director de Infraestructura de OmniNet</p>
                        <p>> <b>Edad:</b> 52 años | <b>Antigüedad:</b> 15 años</p>
                        <p>> <b>Familia:</b> Casado, 2 hijos (Sarah 12, Leo 8)</p>
                        <p>> <b>Nivel de Acceso:</b> TIER 1 (Máximo)</p>
                    `;
                }
            }, 3000);
        }
        // Guardar el estado de la URL y el contenido actual de FoxWorld
        win.dataset.currentUrl = urlInput.value;
        win.dataset.currentContent = content.innerHTML;
    },

    // SEGURIDAD DE CARPETAS (Contraseñas)
    openPasswordWindow(title, pass, iconImg) {
        this.pendingApp = { title, pass, iconImg }; // Guardamos el icono también
        
        // Si la ventana de contraseña ya está abierta, no la duplicamos
        if(document.getElementById('pass-win')) return; 

        // Creamos la ventana forzando el ID 'pass-win' para que sea destruida sin dejar rastro en RAM
        this.createWindow('pass-win', `Seguridad: ${title}`, `
            <div style="text-align: center; padding: 20px;">
                <p>Ingrese contraseña:</p>
                <input type="password" id="pass-input" onkeypress="if(event.key === 'Enter') os.verifyPassword()">
                <br><button onclick="os.verifyPassword()" style="width:100%;">Entrar</button>
            </div>
        `, false, iconImg); // Pasamos el icono para que la ventana de contraseña también se pueda minimizar
        
        setTimeout(() => {
            const input = document.getElementById('pass-input');
            if(input) input.focus();
        }, 100);
    },

    verifyPassword() {
        const inputVal = document.getElementById('pass-input').value;
        if (inputVal === this.pendingApp.pass) {
            this.closeWindow('pass-win', true); // Destruye completamente la ventana de contraseña
            this.createWindow(`generic-${this.pendingApp.title.replace(/\s+/g, '')}`, this.pendingApp.title, `Acceso concedido a <strong>${this.pendingApp.title}</strong>.`, false, this.pendingApp.iconImg); // Pasa el icono para la genérica
        } else {
            alert("Contraseña incorrecta.");
        }
    },

    // Ventana genérica para mostrar contenido simple de carpetas/archivos
    openGenericWindow(title, content) {
        this.createWindow(`generic-${title.replace(/\s+/g, '')}`, title, content);
    }
};

// Reloj de la barra de tareas
setInterval(() => { 
    const clockEl = document.getElementById('clock'); 
    if (clockEl) clockEl.innerText = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); 
}, 1000);