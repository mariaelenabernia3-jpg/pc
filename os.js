const os = {
    zIndex: 100,
    pendingApp: { title: "", pass: "" },
    wifiConnected: false,
    hasNewMail: false, // Variable para saber si hay correo misterioso

    drag(e, el) {
        el.style.zIndex = ++this.zIndex;
        let startX = e.clientX, startY = e.clientY;
        let startLeft = el.offsetLeft, startTop = el.offsetTop;

        const onMove = (moveEvent) => {
            let dx = moveEvent.clientX - startX, dy = moveEvent.clientY - startY;
            let newLeft = startLeft + dx, newTop = startTop + dy;
            const maxX = window.innerWidth - el.offsetWidth;
            const maxY = window.innerHeight - el.offsetHeight - 40;

            el.style.left = Math.max(0, Math.min(newLeft, maxX)) + 'px';
            el.style.top = Math.max(0, Math.min(newTop, maxY)) + 'px';
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', () => document.removeEventListener('mousemove', onMove), { once: true });
    },

    // --- LÓGICA WIFI ---
    openWifiWindow() {
        if(document.getElementById('wifi-window')) return;
        const statusText = this.wifiConnected ? "<span style='color:#0f0'>Conectado</span>" : "<span style='color:red'>Desconectado</span>";
        
        const win = document.createElement('div');
        win.id = 'wifi-window';
        win.className = 'window';
        win.style.width = '300px'; win.style.top = '100px'; win.style.left = '350px';
        win.style.zIndex = ++this.zIndex;
        
        win.innerHTML = `
            <div class="title-bar" onmousedown="os.drag(event, this.parentElement)">
                <span>Redes</span><button onclick="this.parentElement.parentElement.remove()">X</button>
            </div>
            <div class="content" style="background: #111; color: #0f0; text-align:center;">
                <h3>Terminal NET-CONNECT</h3>
                <p>Estado: <b id="wifi-status-text">${statusText}</b></p>
                <div id="wifi-form" style="${this.wifiConnected ? 'display:none;' : 'display:block;'}">
                    <input type="text" id="wifi-user" placeholder="Usuario">
                    <input type="password" id="wifi-pass" placeholder="Contraseña">
                    <br><br><button onclick="os.connectWifi()" style="background:#333; color:#0f0; border:1px solid #0f0;">CONECTAR</button>
                </div>
            </div>
        `;
        document.body.appendChild(win);
    },

    connectWifi() {
        if (document.getElementById('wifi-user').value === 'admin' && document.getElementById('wifi-pass').value === 'cyber123') {
            this.wifiConnected = true;
            document.getElementById('wifi-status-text').innerHTML = "<span style='color:#0f0'>Conectado a Red Oculta</span>";
            document.getElementById('wifi-form').style.display = 'none';
            document.getElementById('wifi-icon').innerHTML = "📶 Conectado";
            document.getElementById('wifi-icon').style.color = "#0f0";

            // ¡El evento narrativo! A los 2 segundos de conectar, llega el correo.
            setTimeout(() => {
                this.hasNewMail = true;
                document.getElementById('email-badge').style.display = 'block';
                // Opcional: Sonido si quisieras
            }, 2000);

        } else {
            alert("Acceso denegado.");
        }
    },

    // --- APP MODERNA DE CORREO ---
    openMailApp() {
        // Al abrir, borramos la notificación roja
        document.getElementById('email-badge').style.display = 'none';
        
        let mailListHTML = `<div style="padding:15px; color:#999; text-align:center;">Bandeja vacía</div>`;
        
        if (this.hasNewMail) {
            mailListHTML = `
                <div class="mail-item unread" onclick="os.readMysteriousMail(this)">
                    <div style="font-weight:bold; font-size:14px;">??? (Desconocido)</div>
                    <div style="font-size:12px; color:#555; margin-top:3px;">No confíes en el...</div>
                </div>
            `;
        }

        const winHTML = `
            <div class="mail-container">
                <div class="mail-sidebar">
                    <div style="background:#34495e;">Inbox</div>
                    <div>Sent</div>
                    <div>Drafts</div>
                </div>
                <div class="mail-list">
                    ${mailListHTML}
                </div>
                <div class="mail-view" id="mail-view-content">
                    <div style="text-align:center; color:#ccc; margin-top:100px;">Selecciona un correo para leerlo.</div>
                </div>
            </div>
        `;

        const win = document.createElement('div');
        win.className = 'window';
        win.style.width = '650px'; // Ventana más grande para la App moderna
        win.style.top = '80px'; win.style.left = '150px';
        win.style.zIndex = ++this.zIndex;
        
        win.innerHTML = `
            <div class="title-bar" onmousedown="os.drag(event, this.parentElement)">
                <span>NexusMail Client v3.1</span><button onclick="this.parentElement.parentElement.remove()">X</button>
            </div>
            <!-- Padding a 0 para que la app moderna ocupe todo -->
            <div class="content" style="padding: 0; border: none;">${winHTML}</div>
        `;
        document.body.appendChild(win);
    },

    readMysteriousMail(element) {
        element.classList.remove('unread'); // Quitar estilo de no leído
        document.getElementById('mail-view-content').innerHTML = `
            <div class="mail-header">
                <h2>No confíes en el sistema</h2>
                <p><b>De:</b> ??? (Cifrado)</p>
                <p><b>Para:</b> Ti</p>
            </div>
            <div style="font-size: 15px; line-height: 1.6; color: #222;">
                <p>Veo que lograste entrar a la red.</p>
                <p>No tenemos mucho tiempo. Nos están vigilando.</p>
                <p>Dejé un archivo oculto en la <b>Papelera de reciclaje</b> justo antes de que borraran mi acceso. La contraseña de la papelera es el año en el que fundaron esta maldita corporación: <b>1984</b>.</p>
                <p>Encuéntralo. Es nuestra única esperanza.</p>
                <p>- X</p>
            </div>
        `;
    },

    // --- LÓGICA DE CONTRASEÑAS (Carpetas) ---
    openPasswordWindow(title, pass) {
        this.pendingApp = { title, pass };
        const win = document.createElement('div');
        win.className = 'window';
        win.style.width = '250px'; win.style.top = '150px'; win.style.left = '300px';
        win.style.zIndex = ++this.zIndex;
        win.innerHTML = `
            <div class="title-bar" onmousedown="os.drag(event, this.parentElement)">
                <span>Seguridad: ${title}</span><button onclick="this.parentElement.parentElement.remove()">X</button>
            </div>
            <div class="content" style="text-align: center;">
                <p>Ingrese contraseña:</p>
                <input type="password" id="pass-input">
                <br><button onclick="os.verifyPassword()">Entrar</button>
            </div>
        `;
        document.body.appendChild(win);
        document.getElementById('pass-input').focus();
    },

    verifyPassword() {
        const input = document.getElementById('pass-input').value;
        if (input === this.pendingApp.pass) {
            document.querySelector('.window').remove();
            this.openGenericWindow(this.pendingApp.title, `Contenido de <strong>${this.pendingApp.title}</strong>.`);
        } else {
            alert("Contraseña incorrecta.");
        }
    },

    openGenericWindow(title, content) {
        const win = document.createElement('div');
        win.className = 'window';
        win.style.top = '100px'; win.style.left = '400px';
        win.style.zIndex = ++this.zIndex;
        win.innerHTML = `
            <div class="title-bar" onmousedown="os.drag(event, this.parentElement)">
                <span>${title}</span><button onclick="this.parentElement.parentElement.remove()">X</button>
            </div>
            <div class="content">${content}</div>
        `;
        document.body.appendChild(win);
    }
};

// Reloj
setInterval(() => {
    document.getElementById('clock').innerText = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}, 1000);