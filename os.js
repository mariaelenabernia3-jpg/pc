const os = {
    zIndex: 100,
    activeApps: new Map(), // Memoria RAM para persistencia de ventanas
    
    // --- SISTEMA DE ARRASTRE DE VENTANAS (PC y Móvil) ---
    dragWindow(e, el) {
        el.style.zIndex = ++this.zIndex;
        let startX = e.clientX || e.touches[0].clientX;
        let startY = e.clientY || e.touches[0].clientY;
        let startLeft = el.offsetLeft;
        let startTop = el.offsetTop;

        const onMove = (moveEvent) => {
            let dx = (moveEvent.clientX || moveEvent.touches[0].clientX) - startX;
            let dy = (moveEvent.clientY || moveEvent.touches[0].clientY) - startY;
            const maxX = window.innerWidth - el.offsetWidth;
            const maxY = window.innerHeight - el.offsetHeight - 40; // Resta altura de la barra de tareas

            el.style.left = Math.max(0, Math.min(startLeft + dx, maxX)) + 'px';
            el.style.top = Math.max(0, Math.min(newTop, maxY)) + 'px'; // Ojo: newTop ya calculado, no startTop+dy
        };

        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onUp);
        };
        
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, { passive: false }); // 'passive: false' para prevenir el scroll en iOS
        document.addEventListener('touchend', onUp);
    },

    // --- MOTOR DE VENTANAS PERSISTENTE ---
    createWindow(id, title, contentHTML, isLarge = false) {
        // 1. Si la ventana ya existe en la memoria, la restaura y la trae al frente
        if(this.activeApps.has(id)) {
            const win = this.activeApps.get(id);
            win.style.display = 'flex'; // La muestra de nuevo
            win.style.zIndex = ++this.zIndex;
            return win;
        }

        // 2. Si no existe, la crea desde cero
        const win = document.createElement('div');
        win.id = id;
        win.className = 'window';
        
        const isMobile = window.innerWidth < 600;
        let wWidth = isLarge ? (isMobile ? window.innerWidth * 0.95 : 650) : (isMobile ? window.innerWidth * 0.85 : 300);
        let wHeight = isLarge ? (isMobile ? window.innerHeight * 0.8 : 400) : 'auto';
        
        win.style.width = wWidth + 'px';
        if(wHeight !== 'auto') win.style.height = wHeight + 'px';
        
        // Centrar la ventana en la pantalla al abrirla
        win.style.left = (window.innerWidth - wWidth) / 2 + 'px';
        win.style.top = (window.innerHeight - (wHeight === 'auto' ? 200 : parseInt(wHeight))) / 2 - 20 + 'px';
        win.style.zIndex = ++this.zIndex;

        win.innerHTML = `
            <div class="title-bar" onmousedown="os.dragWindow(event, this.parentElement)" ontouchstart="os.dragWindow(event, this.parentElement)">
                <span>${title}</span><button onclick="os.closeWindow('${id}')">X</button>
            </div>
            <div class="content" style="${isLarge ? 'padding:0;' : ''}">${contentHTML}</div>
        `;
        document.body.appendChild(win);
        this.activeApps.set(id, win); // La guarda en memoria RAM
        return win;
    },

    // "Cerrar" ahora significa minimizar/ocultar la ventana
    closeWindow(id) {
        if(this.activeApps.has(id)) {
            this.activeApps.get(id).style.display = 'none';
        }
    },

    // --- VARIABLES DE ESTADO DEL JUEGO (Narrativa) ---
    wifiConnected: false,
    hasNewMail: false, // Indica si hay un nuevo correo misterioso
    chatUser: null, // Nombre de usuario del jugador en Chatting
    foxWorldInstalled: false, // Indica si FoxWorld está instalado
    storyStage: 0, // 0: Inicio, 1: Preguntó por escuela, 2: Instaló FoxWorld, 3: Entró a OmniNet, 4: Recibió Foto Persona
    netSpeedInterval: null, // Intervalo para la variación de velocidad en FoxWorld
    pendingApp: {}, // Guarda qué app y contraseña se intentan abrir

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
        `);
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
            this.createWindow('chat-error', 'Chatting - Error', `<div style="text-align:center; padding:20px; color:red; font-weight:bold;">❌ NO TIENES CONEXIÓN<br><br><span style="color:black; font-weight:normal;">Conéctate a una red Wi-Fi para usar esta aplicación.</span></div>`);
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
            `);
            return;
        }

        this.renderChatInterface(); // Si ya está conectado, abre el chat
    },

    registerChatUser() {
        const val = document.getElementById('chat-username').value.trim();
        if(!val) return alert("Por favor, escribe un nombre.");
        this.chatUser = val;
        
        // Cerramos y eliminamos de RAM la ventana de login porque ya no se usará
        if(this.activeApps.has('chat-login')) { 
            document.getElementById('chat-login').remove(); 
            this.activeApps.delete('chat-login');
        }
        this.renderChatInterface();
    },

    renderChatInterface() {
        const win = this.createWindow('chat-win', 'Chatting v1.2', `
            <div class="chat-container">
                <div class="chat-sidebar">
                    <div style="color: #43b581; font-weight:bold;">Directos</div>
                    <div style="color: #fff; margin-top: 10px; background: #3a3a4a; padding:5px; border-radius:4px;">👤 xX_Z3r0_Xx</div>
                </div>
                <div class="chat-main">
                    <div class="chat-messages" id="chat-msgs"></div>
                    <div class="chat-input-area" id="chat-controls"></div>
                </div>
            </div>
        `, true);

        const msgsContainer = win.querySelector('#chat-msgs');
        const controlsContainer = win.querySelector('#chat-controls');
        
        // Carga el historial si ya empezó la conversación, o la inicia
        if (win.dataset.history) {
            msgsContainer.innerHTML = win.dataset.history;
            controlsContainer.innerHTML = win.dataset.controls;
            msgsContainer.scrollTop = msgsContainer.scrollHeight;
        } else {
            msgsContainer.innerHTML = `<div style="text-align:center; color:#888; font-size:12px;">Conectado como: ${this.chatUser}</div>`;
            setTimeout(() => {
                if(!this.activeApps.has('chat-win')) return;
                msgsContainer.innerHTML += `<div class="msg received"><b>xX_Z3r0_Xx:</b> Hola bro</div>`;
                controlsContainer.innerHTML = `<button class="bubble-btn" onclick="os.sendBubble('Hola, me enseñas el trabajo q hablamos en la escuela', 1)">"Hola, me enseñas el trabajo q hablamos en la escuela"</button>`;
            }, 1500);
        }
    },
    
    sendBubble(text, stage) {
        const win = this.activeApps.get('chat-win');
        const msgs = win.querySelector('#chat-msgs');
        const controls = win.querySelector('#chat-controls');
        
        msgs.innerHTML += `<div class="msg sent"><b>${this.chatUser}:</b> ${text}</div>`;
        msgs.scrollTop = msgs.scrollHeight;
        controls.innerHTML = `<div style="color:#888; text-align:center; font-style:italic;">xX_Z3r0_Xx está escribiendo...</div>`;
        
        // Guardamos progreso del chat
        win.dataset.history = msgs.innerHTML;
        win.dataset.controls = controls.innerHTML;

        setTimeout(() => {
            if(!this.activeApps.has('chat-win')) return;

            if (stage === 1) { // Respuesta al primer mensaje del jugador
                msgs.innerHTML += `<div class="msg received"><b>xX_Z3r0_Xx:</b> te mande un navegador privado y seguro viene con VPN incluido.</div>`;
                controls.innerHTML = `<div style="color:#888; text-align:center; font-style:italic;">Revisa tu correo.</div>`;
                this.storyStage = 1; // Etapa: Preguntó por escuela
                this.hasNewMail = true; // Activa la notificación de correo
                document.getElementById('email-badge').style.display = 'block';
            } 
            else if (stage === 2) { // Respuesta a la instalación de FoxWorld
                msgs.innerHTML += `<div class="msg received"><b>xX_Z3r0_Xx:</b> Bueno me contaste en la escuela q tu internet era algo malo vamos a mejorar eso. Entra en el navegador y verás.</div>`;
                controls.innerHTML = `<div style="color:#888; text-align:center; font-style:italic;">Esperando a que abras el navegador...</div>`;
                this.storyStage = 2; // Etapa: Instaló FoxWorld
                this.updateBrowserLinks(); // Desbloquea la URL de OmniNet en FoxWorld
            }
            else if (stage === 3) { // Respuesta a la pregunta "¿qué significa esto?" sobre OmniNet
                msgs.innerHTML += `<div class="msg received"><b>xX_Z3r0_Xx:</b> vamos a mejorar tu internet mediante un pococ de codigo.</div>`;
                msgs.innerHTML += `<div class="msg received"><b>xX_Z3r0_Xx:</b> <img src="persona1.png" class="chat-image"></div>`;
                msgs.innerHTML += `<div class="msg received"><b>xX_Z3r0_Xx:</b> este sera tu objetivo entra a la pagina de escaneo de caras.</div>`;
                controls.innerHTML = `<div style="color:#888; text-align:center; font-style:italic;">Revisa tu navegador.</div>`;
                this.storyStage = 4; // Etapa: Recibió Foto Persona
                this.updateBrowserLinks(); // Desbloquea la URL de Facescan en FoxWorld
            }
            
            msgs.scrollTop = msgs.scrollHeight;
            win.dataset.history = msgs.innerHTML; // Guardamos el historial actualizado
            win.dataset.controls = controls.innerHTML;
        }, 3000);
    },

    // APP: CORREO (NEXUSMAIL)
    openMailApp() {
        document.getElementById('email-badge').style.display = 'none'; // Quita la notificación
        let mailListHTML = `<div style="padding:15px; color:#999; text-align:center;">Bandeja vacía</div>`;
        
        if (this.hasNewMail) { // Si hay correo nuevo, lo muestra
            mailListHTML = `
                <div class="mail-item unread" id="mystery-mail" onclick="os.readMysteriousMail()">
                    <div style="font-weight:bold; font-family:monospace;">xⱫɆⱤØ_Ⱨ₳₵₭x</div>
                    <div style="font-size:12px; color:#555;">instalalo...</div>
                </div>
            `;
        }
        this.createWindow('mail-win', 'NexusMail v3', `
            <div class="mail-container">
                <div class="mail-sidebar"><div style="background:#34495e;">Inbox</div><div>Sent</div></div>
                <div class="mail-list" id="mail-list-col">${mailListHTML}</div>
                <div class="mail-view" id="mail-view-content"><div style="text-align:center; color:#ccc;">Selecciona un correo.</div></div>
            </div>
        `, true);
    },

    readMysteriousMail() {
        const mailItem = document.getElementById('mystery-mail');
        if(mailItem) mailItem.classList.remove('unread'); // Marca como leído
        
        document.getElementById('mail-view-content').innerHTML = `
            <div class="mail-header"><h2>Navegador Seguro</h2><p><b>De:</b> ⱫɆⱤØ_Ⱨ₳₵₭ (Cifrado)</p></div>
            <div style="font-size: 14px; line-height: 1.5; color: #222;">
                <p>Instalalo.</p>
                <div style="background:#eee; padding:15px; border:1px solid #ccc; margin-top:15px; display:flex; align-items:center; justify-content:space-between;">
                    <b style="font-size:16px;">FoxWorld</b>
                    <button id="dl-fox-btn" onclick="os.startFoxDownload()" style="background:#28a745; color:white; border:none; padding:8px 15px; cursor:pointer; font-weight:bold; border-radius:4px;">⬇️ Descargar</button>
                </div>
                <div id="prog-area" style="display:none; margin-top:15px;"><p style="margin:0 0 5px 0; font-size:12px; color:#555;">Descargando archivos...</p><progress id="fox-prog" value="0" max="100"></progress></div>
                <div id="install-area" style="display:none; margin-top:20px; text-align:center;">
                    <p><b>¿Desea instalar el programa?</b></p>
                    <button onclick="os.installFoxWorld()" style="background:#0078d7; color:white; padding:10px 25px; border:none; border-radius:4px; cursor:pointer; font-weight:bold; font-size:16px;">Aceptar</button>
                </div>
            </div>
        `;
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

        // Borrar el correo de la UI actual
        const mailWindow = this.activeApps.get('mail-win');
        if (mailWindow) {
            mailWindow.querySelector('#mail-view-content').innerHTML = `<div style="text-align:center; color:red; margin-top:50px;">Mensaje auto-destruido.</div>`;
            mailWindow.querySelector('#mail-list-col').innerHTML = `<div style="padding:15px; color:#999; text-align:center;">Bandeja vacía</div>`;
            this.closeWindow('mail-win'); // Cerramos la ventana de correo para la inmersión
        }

        // Crear icono dinámico en escritorio (FoxWorld)
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
            chatWin.dataset.controls = controls.innerHTML; // Guardar estado
        }

        alert("Instalación exitosa. FoxWorld se ha añadido al escritorio.");
    },

    // APP: NAVEGADOR FOXWORLD
    openFoxWorld() {
        this.createWindow('foxworld-win', 'FoxWorld VPN', `
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
        `, true);

        // Inicia la variación de red al abrir la app (si no está iniciada ya)
        if (!this.netSpeedInterval) {
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
        const urlInput = document.getElementById('fw-url-input');
        const content = document.getElementById('fw-main-content');

        if (urlType === 'omninet') {
            urlInput.value = "https://omninet.corp/internal"; // Actualiza la barra de direcciones
            content.innerHTML = `
                <div class="omninet-page">
                    <div class="logo">OMNINET</div>
                    <h1>Conectando el Futuro. Hoy.</h1>
                    <p>OmniNet es la columna vertebral digital de nuestra era. Innovación, seguridad y una red global sin precedentes al alcance de tu mano.</p>
                    <button class="omninet-btn">Explora Nuestros Servicios</button>
                    <div class="omninet-features">
                        <div class="omninet-feature-item">
                            <span class="icon">⚡</span>
                            <p>Velocidad Insuperable</p>
                        </div>
                        <div class="omninet-feature-item">
                            <span class="icon">🔒</span>
                            <p>Seguridad Avanzada</p>
                        </div>
                        <div class="omninet-feature-item">
                            <span class="icon">🌍</span>
                            <p>Cobertura Global</p>
                        </div>
                    </div>
                </div>
            `;
            // Desbloquear opción de chat "¿qué significa esto?"
            if (this.storyStage === 2) {
                this.storyStage = 3; // Pasa a la siguiente etapa de la historia
                const chatWin = this.activeApps.get('chat-win');
                if(chatWin) {
                    const controls = chatWin.querySelector('#chat-controls');
                    controls.innerHTML = `<button class="bubble-btn" onclick="os.sendBubble('que significa esto', 3)">"¿qué significa esto?"</button>`;
                    chatWin.dataset.controls = controls.innerHTML; // Guardar estado del chat
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
    },

    // SEGURIDAD DE CARPETAS (Contraseñas)
    openPasswordWindow(title, pass) {
        this.pendingApp = { title, pass };
        // Si la ventana de contraseña ya está abierta, no la duplicamos
        if(document.getElementById('pass-win')) return; 

        const win = document.createElement('div');
        win.id = 'pass-win'; win.className = 'window';
        win.style.width = '250px'; win.style.top = '150px'; win.style.left = '300px'; win.style.zIndex = ++this.zIndex;
        win.innerHTML = `<div class="title-bar" onmousedown="os.dragWindow(event, this.parentElement)" ontouchstart="os.dragWindow(event, this.parentElement)"><span>Seguridad: ${title}</span><button onclick="this.parentElement.parentElement.remove()">X</button></div><div class="content" style="text-align: center;"><p>Ingrese contraseña:</p><input type="password" id="pass-input" onkeypress="if(event.key === 'Enter') os.verifyPassword()"><br><button onclick="os.verifyPassword()" style="width:100%;">Entrar</button></div>`;
        document.body.appendChild(win);
        setTimeout(() => document.getElementById('pass-input').focus(), 100);
    },

    verifyPassword() {
        if (document.getElementById('pass-input').value === this.pendingApp.pass) {
            document.getElementById('pass-win').remove(); // Elimina la ventana de contraseña
            this.activeApps.delete('pass-win'); // Borra de la memoria RAM también
            this.createWindow('generic-win', this.pendingApp.title, `Acceso concedido a <strong>${this.pendingApp.title}</strong>.`);
        } else {
            alert("Contraseña incorrecta.");
        }
    },

    // Ventana genérica para mostrar contenido simple de carpetas/archivos
    openGenericWindow(title, content) {
        this.createWindow(`generic-${title.replace(/\s+/g, '')}`, title, content);
    }
};

// --- INICIALIZACIÓN Y RELOJ ---
setInterval(() => { 
    const clockEl = document.getElementById('clock'); 
    if (clockEl) clockEl.innerText = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); 
}, 1000);