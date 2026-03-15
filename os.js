const os = {
    zIndex: 100,
    pendingApp: { title: "", pass: "" },
    wifiConnected: false,
    hasNewMail: false,

    // Motor de Toque y Arrastre Unificado (Mouse + Táctil)
    iconInteract(e, el, clickAction) {
        el.style.zIndex = ++this.zIndex;
        let startX = e.clientX, startY = e.clientY;
        let startLeft = el.offsetLeft, startTop = el.offsetTop;
        let isDragging = false;

        const onMove = (moveEvent) => {
            let dx = moveEvent.clientX - startX;
            let dy = moveEvent.clientY - startY;
            
            // Si el dedo/mouse se movió más de 5px, se considera "Arrastre", no un clic.
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isDragging = true;

            let newLeft = startLeft + dx, newTop = startTop + dy;
            const maxX = window.innerWidth - el.offsetWidth;
            const maxY = window.innerHeight - el.offsetHeight - 40;

            el.style.left = Math.max(0, Math.min(newLeft, maxX)) + 'px';
            el.style.top = Math.max(0, Math.min(newTop, maxY)) + 'px';
        };

        const onUp = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            // Si no arrastró (es decir, solo tocó) y hay una acción, ejecútala.
            if (!isDragging && clickAction) clickAction();
        };

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
    },

    // Generador de Ventanas Responsive
    createWindow(id, title, contentHTML, isLarge = false) {
        if(document.getElementById(id)) return; // No abrir dos veces
        
        const win = document.createElement('div');
        win.id = id;
        win.className = 'window';
        
        // Adaptar tamaño a pantalla de Celular o PC
        const isMobile = window.innerWidth < 600;
        let wWidth = isLarge ? (isMobile ? window.innerWidth * 0.95 : 650) : (isMobile ? window.innerWidth * 0.85 : 300);
        let wHeight = isLarge ? (isMobile ? window.innerHeight * 0.8 : 400) : 'auto';
        
        win.style.width = wWidth + 'px';
        if(wHeight !== 'auto') win.style.height = wHeight + 'px';
        
        // Centrar en pantalla
        win.style.left = (window.innerWidth - wWidth) / 2 + 'px';
        win.style.top = (window.innerHeight - (isLarge ? (isMobile ? window.innerHeight*0.8 : 400) : 200)) / 2 - 20 + 'px';
        win.style.zIndex = ++this.zIndex;

        win.innerHTML = `
            <div class="title-bar" onpointerdown="os.iconInteract(event, this.parentElement, null)">
                <span>${title}</span><button onclick="this.parentElement.parentElement.remove()">X</button>
            </div>
            <div class="content" style="${isLarge ? 'padding:0;' : ''}">${contentHTML}</div>
        `;
        document.body.appendChild(win);
    },

    // --- LÓGICA WIFI ---
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
        if (document.getElementById('wifi-user').value === 'admin' && document.getElementById('wifi-pass').value === 'cyber123') {
            this.wifiConnected = true;
            document.getElementById('wifi-status-text').innerHTML = "<span style='color:#0f0'>Red Oculta OK</span>";
            document.getElementById('wifi-form').style.display = 'none';
            document.getElementById('wifi-icon').innerHTML = "📶 Conectado";
            document.getElementById('wifi-icon').style.color = "#0f0";

            setTimeout(() => {
                this.hasNewMail = true;
                document.getElementById('email-badge').style.display = 'block';
            }, 2000);
        } else {
            alert("Acceso denegado.");
        }
    },

    // --- APP DE CORREO ---
    openMailApp() {
        document.getElementById('email-badge').style.display = 'none';
        let mailListHTML = `<div style="padding:15px; color:#999; text-align:center;">Bandeja vacía</div>`;
        if (this.hasNewMail) {
            mailListHTML = `
                <div class="mail-item unread" onclick="os.readMysteriousMail(this)">
                    <div style="font-weight:bold; font-size:14px;">??? (Desconocido)</div>
                    <div style="font-size:12px; color:#555;">No confíes en el...</div>
                </div>
            `;
        }

        this.createWindow('mail-win', 'NexusMail v3', `
            <div class="mail-container">
                <div class="mail-sidebar">
                    <div style="background:#34495e;">Inbox</div>
                    <div>Sent</div>
                </div>
                <div class="mail-list">${mailListHTML}</div>
                <div class="mail-view" id="mail-view-content">
                    <div style="text-align:center; color:#ccc; margin-top:50px;">Selecciona un correo.</div>
                </div>
            </div>
        `, true); // El true indica que es una ventana grande (isLarge)
    },

    readMysteriousMail(el) {
        el.classList.remove('unread');
        document.getElementById('mail-view-content').innerHTML = `
            <div class="mail-header">
                <h2>No confíes en el sistema</h2>
                <p><b>De:</b> ??? (Cifrado)</p>
            </div>
            <div style="font-size: 14px; line-height: 1.5; color: #222;">
                <p>Nos vigilan. Dejé un archivo en la <b>Papelera</b>.</p>
                <p>Clave: el año de la fundación de la corporación. <b>(1984)</b>.</p>
                <p>- X</p>
            </div>
        `;
    },

    // --- SEGURIDAD ---
    openPasswordWindow(title, pass) {
        this.pendingApp = { title, pass };
        this.createWindow('pass-win', `Seguridad: ${title}`, `
            <div style="text-align: center;">
                <p>Ingrese contraseña:</p>
                <input type="password" id="pass-input">
                <br><button onclick="os.verifyPassword()" style="width:100%;">Entrar</button>
            </div>
        `);
        setTimeout(() => document.getElementById('pass-input').focus(), 100);
    },

    verifyPassword() {
        if (document.getElementById('pass-input').value === this.pendingApp.pass) {
            document.getElementById('pass-win').remove();
            this.createWindow('generic-win', this.pendingApp.title, `Acceso concedido a <strong>${this.pendingApp.title}</strong>.`);
        } else {
            alert("Contraseña incorrecta.");
        }
    }
};

setInterval(() => {
    document.getElementById('clock').innerText = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}, 1000);