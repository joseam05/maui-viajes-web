// frontend/js/admin.js

const API_URL = '/api';
let usuarioActual = { nombre: '', rol: '' };

// 1. COMPRESIÓN DE IMÁGENES (SÍ, ESTÁ AQUÍ 👇)
async function comprimirImagen(archivo) {
    return new Promise((resolve) => {
        const maxWidth = 1200;
        const quality = 0.7;
        const reader = new FileReader();
        reader.readAsDataURL(archivo);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth; }
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                canvas.toBlob((blob) => {
                    resolve(new File([blob], archivo.name, { type: 'image/jpeg', lastModified: Date.now() }));
                }, 'image/jpeg', quality);
            };
        };
    });
}

// 2. LOGIN
async function login() {
    const u = document.getElementById('user').value.trim();
    const p = document.getElementById('pass').value.trim();
    const errorMsg = document.getElementById('login-error');

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario: u, password: p })
        });
        const data = await res.json();
        if (data.success) {
            usuarioActual = { nombre: u, password: p, rol: data.rol };
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('admin-panel').style.display = 'block';
            configurarInterfaz();
            cargarPaquetes();
        } else {
            errorMsg.textContent = "Credenciales incorrectas.";
        }
    } catch (err) { errorMsg.textContent = "Error de conexión."; }
}

function configurarInterfaz() {
    document.getElementById('admin-name-display').textContent = usuarioActual.nombre;
    document.getElementById('role-display').textContent = usuarioActual.rol.toUpperCase();
    document.getElementById('avatar-initial').textContent = usuarioActual.nombre.charAt(0).toUpperCase();
    document.getElementById('card-crear-paquete').classList.remove('hidden');

    // Counter: no ve Reclamos ni Papelera
    const isAdmin = usuarioActual.rol === 'admin' || usuarioActual.rol === 'dev';
    if (!isAdmin) {
        const navReclamos = document.getElementById('nav-reclamos');
        const navPapelera = document.getElementById('nav-papelera');
        if (navReclamos) navReclamos.style.display = 'none';
        if (navPapelera) navPapelera.style.display = 'none';
    }

    // Solo dev ve Accesos
    if (usuarioActual.rol === 'dev') {
        const navAccesos = document.getElementById('nav-accesos');
        if (navAccesos) navAccesos.style.display = '';
    }
}

function logout() { if (confirm("¿Salir?")) location.reload(); }

// 3. CARGAR PAQUETES (CON BADGES LUXURY ✨)
async function cargarPaquetes() {
    const lista = document.getElementById('lista-paquetes');
    lista.innerHTML = '<div style="text-align:center; padding:20px;">Cargando...</div>';

    try {
        const res = await fetch(`${API_URL}/paquetes-admin`);
        const paquetes = await res.json();
        lista.innerHTML = '';

        if (paquetes.length === 0) { lista.innerHTML = '<p style="text-align:center;">No hay paquetes.</p>'; return; }

        paquetes.forEach(p => {
            const img = (p.imagenes && p.imagenes.length > 0) ? p.imagenes[0] : 'img/placeholder.jpg';

            // GENERAR BADGES HTML
            const tagPromo = p.is_promo ? '<span class="badge badge-promo">🔥 OFERTA</span>' : '';
            const tagCrucero = p.tipo === 'crucero' ? '<span class="badge badge-cruise">🚢 CRUCERO</span>' : '';

            // BOTÓN BORRAR (Admin/Dev)
            let btnDelete = '';
            if (usuarioActual.rol === 'admin' || usuarioActual.rol === 'dev') {
                btnDelete = `<button class="btn-action btn-action-danger" onclick="borrarPaquete('${p.id}')" title="Eliminar"><i class="fa-solid fa-trash"></i></button>`;
            }

            const monedaLabel = p.moneda === 'USD' ? 'USD' : 'SOL';
            const tituloSafe = (p.titulo || '').replace(/'/g, "\\'");
            const duracionSafe = (p.duracion || '').replace(/'/g, "\\'");

            const item = document.createElement('div');
            item.className = 'package-item';
            item.innerHTML = `
                <img src="${img}" class="package-img">
                <div class="package-info">
                    <h4>${p.titulo} ${tagPromo} ${tagCrucero}</h4>
                    <p><strong>${monedaLabel} ${p.precio}</strong> | ${p.duracion}</p>
                </div>
                <div class="package-actions">
                    <button class="btn-action" onclick="clonarPaquete('${p.id}')" title="Clonar"><i class="fa-solid fa-copy"></i></button>
                    <button class="btn-action" onclick="generarCotizacion('${p.id}')" title="Cotización PDF"><i class="fa-solid fa-file-pdf"></i></button>
                    <button class="btn-action" onclick="quickCopy('${p.id}', '${tituloSafe}', '${monedaLabel}', '${p.precio}', '${duracionSafe}', '${p.is_promo}')" title="Quick Copy"><i class="fa-solid fa-share-nodes"></i></button>
                    ${btnDelete}
                </div>
            `;
            lista.appendChild(item);
        });
    } catch (e) { console.error(e); }
}

async function borrarPaquete(id) {
    if (!confirm("¿Mover este paquete a la papelera?")) return;
    await fetch(`${API_URL}/borrar-paquete/${id}`, { method: 'DELETE' });
    cargarPaquetes();
}

// 4. PUBLICAR (CON COMPRESIÓN)
document.getElementById('tour-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!confirm("¿Publicar servicio?")) return;

    const btn = document.getElementById('btn-submit');
    const loader = document.getElementById('loader');
    btn.disabled = true; loader.style.display = 'block';

    try {
        const formData = new FormData();
        // Campos texto
        const inputs = e.target.querySelectorAll('input:not([type="file"]):not([type="checkbox"]), select, textarea');
        inputs.forEach(i => formData.append(i.name, i.value));
        // Checkboxes
        e.target.querySelectorAll('input[name="intereses"]:checked').forEach(c => formData.append('intereses', c.value));
        formData.append('is_promo', document.querySelector('[name="is_promo"]').checked);

        // IMÁGENES + COMPRESIÓN
        const fileInput = document.getElementById('file-input');
        if (fileInput.files.length > 0) {
            for (let i = 0; i < fileInput.files.length; i++) {
                try {
                    const compressed = await comprimirImagen(fileInput.files[i]);
                    formData.append('fotos', compressed);
                } catch (err) { formData.append('fotos', fileInput.files[i]); }
            }
        }

        const res = await fetch(`${API_URL}/crear-paquete`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
            alert("✅ Publicado");
            e.target.reset();
            document.getElementById('gallery').innerHTML = '';
            cargarPaquetes();
        } else { alert("Error: " + data.error); }
    } catch (err) { alert("Error de red"); }
    finally { btn.disabled = false; loader.style.display = 'none'; }
});

// 5. CRM (SOLICITUDES CON KANBAN)
const ESTADOS_KANBAN = {
    'nuevo': { label: '🆕 Nuevo', class: 'badge-nuevo' },
    'contactado': { label: '📞 Contactado', class: 'badge-contactado' },
    'negociacion': { label: '🤝 Negociación', class: 'badge-negociacion' },
    'cerrado': { label: '✅ Cerrado', class: 'badge-cerrado' }
};

async function cargarSolicitudes() {
    const tbody = document.getElementById('lista-solicitudes');
    tbody.innerHTML = '<tr><td colspan="6">Cargando...</td></tr>';

    try {
        const res = await fetch(`${API_URL}/ver-solicitudes`);
        const data = await res.json();
        tbody.innerHTML = '';

        if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Bandeja vacía ✨</td></tr>'; return; }

        data.forEach(s => {
            const fecha = s.fecha ? new Date(s.fecha).toLocaleDateString() : '-';
            const estado = s.estado || 'nuevo';
            const estadoInfo = ESTADOS_KANBAN[estado] || ESTADOS_KANBAN['nuevo'];

            // Dropdown de estado
            const selectHTML = `
                <select class="kanban-select ${estadoInfo.class}" onchange="cambiarEstadoSolicitud('${s.id}', this.value)">
                    ${Object.entries(ESTADOS_KANBAN).map(([key, val]) =>
                `<option value="${key}" ${key === estado ? 'selected' : ''}>${val.label}</option>`
            ).join('')}
                </select>`;

            // BOTÓN BORRAR (Admin/Dev)
            let btnBorrar = '';
            if (usuarioActual.rol === 'admin' || usuarioActual.rol === 'dev') {
                btnBorrar = `<button class="btn-delete" onclick="borrarSolicitud('${s.id}')" title="Borrar"><i class="fa-solid fa-xmark"></i></button>`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${fecha}</td>
                <td><strong>${s.nombre}</strong><br><small>${s.email}</small></td>
                <td>${s.paquete_interes}<br><small>Pax: ${s.pasajeros}</small></td>
                <td>${selectHTML}</td>
                <td><a href="https://wa.me/${s.celular}" target="_blank" class="btn-whatsapp-sm"><i class="fa-brands fa-whatsapp"></i> Chat</a></td>
                <td style="text-align:center;">${btnBorrar}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

async function borrarSolicitud(id) {
    if (!confirm("¿Borrar solicitud?")) return;
    await fetch(`${API_URL}/borrar-solicitud/${id}`, { method: 'DELETE' });
    cargarSolicitudes();
}

window.cambiarEstadoSolicitud = async function (id, nuevoEstado) {
    try {
        await fetch(`${API_URL}/solicitud-estado/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: nuevoEstado })
        });
        // Actualizar color del select
        cargarSolicitudes();
    } catch (e) { console.error(e); }
};

// 6. UI
window.cambiarPestana = function (tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');

    const tabs = ['paquetes', 'solicitudes', 'newsletter', 'reclamos', 'papelera', 'clientes', 'dashboard', 'accesos'];
    const idx = tabs.indexOf(tab);
    if (idx >= 0) document.querySelectorAll('.nav-btn')[idx].classList.add('active');

    if (tab === 'solicitudes') cargarSolicitudes();
    if (tab === 'newsletter') cargarNewsletter();
    if (tab === 'reclamos') cargarReclamos();
    if (tab === 'papelera') cargarPapelera();
    if (tab === 'clientes') cargarClientes();
    if (tab === 'dashboard') cargarDashboard();
    if (tab === 'accesos') cargarAccesos();
};

// === NEWSLETTER ===
async function cargarNewsletter() {
    const tbody = document.getElementById('lista-newsletter');
    tbody.innerHTML = '<tr><td colspan="4">Cargando...</td></tr>';
    try {
        const res = await fetch(`${API_URL}/newsletter-subs`);
        const data = await res.json();
        tbody.innerHTML = '';
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay suscriptores aún ✨</td></tr>';
            return;
        }
        data.forEach(s => {
            const fecha = s.fecha ? new Date(s.fecha).toLocaleDateString() : '-';
            const tr = document.createElement('tr');
            let btnBorrar = '';
            if (usuarioActual.rol === 'admin' || usuarioActual.rol === 'dev') {
                btnBorrar = `<button class="btn-delete" onclick="borrarNewsletter('${s.id}')" title="Eliminar"><i class="fa-solid fa-xmark"></i></button>`;
            }
            tr.innerHTML = `
                <td>${fecha}</td>
                <td><strong>${s.email}</strong></td>
                <td><span class="badge badge-active">Activo</span></td>
                <td>${btnBorrar}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

async function borrarNewsletter(id) {
    if (!confirm('¿Eliminar este suscriptor?')) return;
    await fetch(`${API_URL}/newsletter-sub/${id}`, { method: 'DELETE' });
    cargarNewsletter();
}

// === RECLAMOS ===
async function cargarReclamos() {
    const tbody = document.getElementById('lista-reclamos');
    tbody.innerHTML = '<tr><td colspan="6">Cargando...</td></tr>';
    try {
        const res = await fetch(`${API_URL}/reclamaciones-admin`);
        const data = await res.json();
        tbody.innerHTML = '';
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Sin reclamaciones ✨</td></tr>';
            return;
        }
        data.forEach(r => {
            const fecha = r.fecha ? new Date(r.fecha).toLocaleDateString() : '-';
            const badgeClass = r.estado === 'pendiente' ? 'badge-pending' : 'badge-active';
            let btnBorrar = '';
            if (usuarioActual.rol === 'admin' || usuarioActual.rol === 'dev') {
                btnBorrar = `<button class="btn-delete" onclick="borrarReclamo('${r.id}')" title="Eliminar"><i class="fa-solid fa-xmark"></i></button>`;
            }
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${r.codigo}</strong></td>
                <td>${fecha}</td>
                <td>${r.nombre}<br><small>${r.email || ''}</small></td>
                <td><span class="badge ${r.tipo === 'queja' ? 'badge-promo' : 'badge-cruise'}">${r.tipo}</span></td>
                <td style="max-width:250px;">${r.detalle ? r.detalle.substring(0, 100) + (r.detalle.length > 100 ? '...' : '') : '-'}</td>
                <td><span class="badge ${badgeClass}">${r.estado}</span></td>
                <td>${btnBorrar}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

async function borrarReclamo(id) {
    if (!confirm('¿Eliminar este reclamo?')) return;
    await fetch(`${API_URL}/borrar-reclamo/${id}`, { method: 'DELETE' });
    cargarReclamos();
}

// === PAPELERA ===
async function cargarPapelera() {
    const lista = document.getElementById('lista-papelera');
    lista.innerHTML = '<div style="text-align:center; padding:20px;">Cargando...</div>';
    try {
        const res = await fetch(`${API_URL}/papelera`);
        const paquetes = await res.json();
        lista.innerHTML = '';
        if (paquetes.length === 0) {
            lista.innerHTML = '<p style="text-align:center; padding:40px; color:#64748b;"><i class="fa-solid fa-trash-can" style="font-size:2rem; display:block; margin-bottom:12px; color:#cbd5e1;"></i>La papelera está vacía</p>';
            return;
        }
        paquetes.forEach(p => {
            const img = (p.imagenes && p.imagenes.length > 0) ? p.imagenes[0] : 'img/placeholder.jpg';
            const item = document.createElement('div');
            item.className = 'package-item papelera-item';
            item.innerHTML = `
                <img src="${img}" class="package-img">
                <div class="package-info">
                    <h4>${p.titulo}</h4>
                    <p><strong>${p.moneda} ${p.precio}</strong> | ${p.duracion}</p>
                </div>
                <div class="papelera-actions">
                    <button class="btn-restore" onclick="restaurarPaquete('${p.id}')" title="Restaurar">
                        <i class="fa-solid fa-rotate-left"></i>
                    </button>
                    <button class="btn-delete" onclick="borrarPermanente('${p.id}')" title="Eliminar permanentemente">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
            lista.appendChild(item);
        });
    } catch (e) { console.error(e); }
}

async function restaurarPaquete(id) {
    if (!confirm('¿Restaurar este paquete?')) return;
    await fetch(`${API_URL}/restaurar-paquete/${id}`, { method: 'POST' });
    cargarPapelera();
}

async function borrarPermanente(id) {
    if (!confirm('⚠️ ¿Eliminar PERMANENTEMENTE? Esta acción no se puede deshacer.')) return;
    await fetch(`${API_URL}/borrar-permanente/${id}`, { method: 'DELETE' });
    cargarPapelera();
}

window.actualizarEstiloTipo = function (tipo) {
    const box = document.querySelector('.type-selector-box');
    const gPaq = document.querySelector('.group-paquete');
    const gCru = document.querySelector('.group-crucero');

    if (tipo === 'crucero') {
        box.style.background = '#e0f2fe'; box.style.borderColor = '#7dd3fc';
        gPaq.style.display = 'none'; gCru.style.display = 'inline';
    } else {
        box.style.background = '#fff7ed'; box.style.borderColor = '#fed7aa';
        gPaq.style.display = 'inline'; gCru.style.display = 'none';
    }
};

window.previewImages = function (input) {
    const g = document.getElementById('gallery'); g.innerHTML = '';
    if (input.files) Array.from(input.files).forEach(f => {
        const r = new FileReader();
        r.onload = e => { const i = document.createElement('img'); i.src = e.target.result; g.appendChild(i); };
        r.readAsDataURL(f);
    });
};

// === CLIENTES ===
async function cargarClientes() {
    const tbody = document.getElementById('lista-clientes');
    tbody.innerHTML = '<tr><td colspan="5">Cargando...</td></tr>';
    try {
        const res = await fetch(`${API_URL}/clientes`);
        const data = await res.json();
        tbody.innerHTML = '';
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay clientes registrados ✨</td></tr>';
            return;
        }
        data.forEach(c => {
            const ultima = c.ultima_consulta ? new Date(c.ultima_consulta).toLocaleDateString() : '-';
            const interesesHTML = c.intereses.map(i => `<span class="badge-interest">${i}</span>`).join(' ');
            const celLink = c.celular
                ? `<a href="https://wa.me/${c.celular}" target="_blank" class="btn-whatsapp-sm"><i class="fa-brands fa-whatsapp"></i> ${c.celular}</a>`
                : (c.email || '-');
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${c.nombre}</strong><br><small>${c.email}</small></td>
                <td>${celLink}</td>
                <td>${interesesHTML}</td>
                <td style="text-align:center;"><span class="badge-count">${c.total_consultas}</span></td>
                <td>${ultima}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}
window.cargarClientes = cargarClientes;

// === FASE 4: CLONADOR DE PAQUETES ===
window.clonarPaquete = async function (id) {
    if (!confirm('¿Crear una copia de este paquete?')) return;
    try {
        const res = await fetch(`${API_URL}/clonar-paquete/${id}`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            alert('📋 Paquete clonado exitosamente');
            cargarPaquetes();
        } else { alert('Error: ' + (data.error || 'Desconocido')); }
    } catch (e) { alert('Error clonando paquete'); }
};

// === FASE 4: COTIZACIÓN PDF ===
window.generarCotizacion = function (id) {
    window.open(`${API_URL}/cotizacion/${id}`, '_blank');
};

// === FASE 4: QUICK COPY ===
window.quickCopy = function (id, titulo, moneda, precio, duracion, isPromo) {
    const emoji = isPromo === 'true' ? '🔥 *OFERTA ESPECIAL* 🔥\n' : '';
    const simbolo = moneda === 'USD' ? 'US$' : 'S/.';
    const texto = `${emoji}✈️ *${titulo}*\n📅 ${duracion}\n💰 Desde ${simbolo} ${precio} por persona\n\n📲 Consulta por WhatsApp para más info\n🌐 www.mauiviajes.com`;

    navigator.clipboard.writeText(texto).then(() => {
        // Show tooltip
        const toast = document.createElement('div');
        toast.className = 'toast-copied';
        toast.innerHTML = '<i class="fa-solid fa-check"></i> Copiado al portapapeles';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }).catch(() => {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = texto; document.body.appendChild(ta);
        ta.select(); document.execCommand('copy');
        document.body.removeChild(ta);
        alert('📋 Texto copiado');
    });
};

// === FASE 4: DASHBOARD DE MÉTRICAS ===
async function cargarDashboard() {
    try {
        const res = await fetch(`${API_URL}/dashboard-metricas`);
        const m = await res.json();
        const container = document.getElementById('dashboard-content');

        // KPI cards
        const kpiHTML = `
            <div class="dashboard-kpis">
                <div class="kpi-card kpi-blue">
                    <i class="fa-solid fa-suitcase-rolling"></i>
                    <div class="kpi-value">${m.total_paquetes}</div>
                    <div class="kpi-label">Paquetes Activos</div>
                </div>
                <div class="kpi-card kpi-green">
                    <i class="fa-solid fa-envelope-open-text"></i>
                    <div class="kpi-value">${m.total_solicitudes}</div>
                    <div class="kpi-label">Solicitudes</div>
                </div>
                <div class="kpi-card kpi-gold">
                    <i class="fa-solid fa-at"></i>
                    <div class="kpi-value">${m.total_newsletter}</div>
                    <div class="kpi-label">Suscriptores</div>
                </div>
                <div class="kpi-card kpi-red">
                    <i class="fa-solid fa-book-open"></i>
                    <div class="kpi-value">${m.total_reclamos}</div>
                    <div class="kpi-label">Reclamos</div>
                </div>
            </div>
        `;

        // Pipeline de estados
        const total = m.total_solicitudes || 1;
        const pipeHTML = `
            <div class="dashboard-section">
                <h3>📊 Pipeline de Ventas</h3>
                <div class="pipeline">
                    <div class="pipe-stage">
                        <div class="pipe-bar pipe-nuevo" style="width:${(m.estados.nuevo / total * 100).toFixed(0)}%"></div>
                        <span>Nuevo <strong>${m.estados.nuevo}</strong></span>
                    </div>
                    <div class="pipe-stage">
                        <div class="pipe-bar pipe-contactado" style="width:${(m.estados.contactado / total * 100).toFixed(0)}%"></div>
                        <span>Contactado <strong>${m.estados.contactado}</strong></span>
                    </div>
                    <div class="pipe-stage">
                        <div class="pipe-bar pipe-negociacion" style="width:${(m.estados.negociacion / total * 100).toFixed(0)}%"></div>
                        <span>Negociación <strong>${m.estados.negociacion}</strong></span>
                    </div>
                    <div class="pipe-stage">
                        <div class="pipe-bar pipe-cerrado" style="width:${(m.estados.cerrado / total * 100).toFixed(0)}%"></div>
                        <span>Cerrado <strong>${m.estados.cerrado}</strong></span>
                    </div>
                </div>
            </div>
        `;

        // Top paquetes
        let topHTML = '<div class="dashboard-section"><h3>🏆 Top Paquetes Más Consultados</h3>';
        if (m.top_paquetes.length === 0) {
            topHTML += '<p style="color:#94a3b8;">Sin datos aún</p>';
        } else {
            topHTML += '<div class="top-list">';
            m.top_paquetes.forEach((p, i) => {
                const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                topHTML += `<div class="top-item"><span class="top-medal">${medals[i]}</span><span class="top-name">${p.nombre}</span><span class="top-count">${p.count} consultas</span></div>`;
            });
            topHTML += '</div>';
        }
        topHTML += '</div>';

        container.innerHTML = kpiHTML + pipeHTML + topHTML;
    } catch (e) {
        console.error(e);
        document.getElementById('dashboard-content').innerHTML = '<p>Error cargando métricas</p>';
    }
}
window.cargarDashboard = cargarDashboard;

// === FASE: REGISTRO DE ACCESOS (solo dev) ===
async function cargarAccesos() {
    const tbody = document.getElementById('lista-accesos');
    const stats = document.getElementById('accesos-stats');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;">Cargando...</td></tr>';

    try {
        const res = await fetch(`${API_URL}/dev/logs?limit=200`, {
            headers: {
                'X-Admin-User': usuarioActual.nombre,
                'X-Admin-Pass': usuarioActual.password || ''
            }
        });
        const data = await res.json();

        if (!data.success) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#ef4444;">${data.error}</td></tr>`;
            return;
        }

        const logs = data.logs;

        // Stats: visitantes únicos y países
        const uniqueIPs = new Set(logs.map(l => l.ip)).size;
        const countries = {};
        logs.forEach(l => { countries[l.pais] = (countries[l.pais] || 0) + 1; });
        const topCountries = Object.entries(countries).sort((a, b) => b[1] - a[1]).slice(0, 5);

        stats.innerHTML = `
            <div class="accesos-stats-bar">
                <div class="stat-chip"><i class="fa-solid fa-eye"></i> <strong>${logs.length}</strong> accesos totales</div>
                <div class="stat-chip"><i class="fa-solid fa-users"></i> <strong>${uniqueIPs}</strong> IPs únicas</div>
                ${topCountries.map(([p, c]) => `<div class="stat-chip stat-country"><i class="fa-solid fa-globe"></i> ${p} <strong>${c}</strong></div>`).join('')}
            </div>
        `;

        tbody.innerHTML = '';
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#94a3b8;">Sin registros aún</td></tr>';
            return;
        }

        logs.forEach(l => {
            // Parsear user agent para mostrar info resumida
            const ua = l.dispositivo || '';
            let device = 'Desconocido';
            if (ua.includes('iPhone')) device = '📱 iPhone';
            else if (ua.includes('Android')) device = '📱 Android';
            else if (ua.includes('iPad')) device = '📱 iPad';
            else if (ua.includes('Mac')) device = '💻 Mac';
            else if (ua.includes('Windows')) device = '💻 Windows';
            else if (ua.includes('Linux')) device = '🐧 Linux';
            else if (ua.includes('bot') || ua.includes('Bot') || ua.includes('spider')) device = '🤖 Bot';
            else if (ua.includes('curl')) device = '⚡ curl';

            // Extraer navegador
            let browser = '';
            if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
            else if (ua.includes('Firefox')) browser = 'Firefox';
            else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
            else if (ua.includes('Edg')) browser = 'Edge';

            const fecha = l.fecha ? new Date(l.fecha).toLocaleString('es-PE') : '-';
            const isLocal = l.ip === '127.0.0.1' || l.ip === '::1';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><code class="ip-code${isLocal ? ' ip-local' : ''}">${l.ip}</code></td>
                <td>${l.pais || '-'}</td>
                <td>${l.ciudad || '-'}</td>
                <td><span class="device-badge">${device}${browser ? ' · ' + browser : ''}</span></td>
                <td><code>${l.ruta || '-'}</code></td>
                <td><small>${fecha}</small></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#ef4444;">Error cargando logs</td></tr>';
    }
}
window.cargarAccesos = cargarAccesos;