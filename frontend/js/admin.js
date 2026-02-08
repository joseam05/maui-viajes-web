// frontend/js/admin.js

const API_URL = 'http://localhost:3000/api';
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
            usuarioActual = { nombre: u, rol: data.rol };
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
    // Counter ve formulario pero no borra
    document.getElementById('card-crear-paquete').classList.remove('hidden'); 
}

function logout() { if(confirm("¿Salir?")) location.reload(); }

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
                btnDelete = `<button class="btn-delete" onclick="borrarPaquete('${p.id}')"><i class="fa-solid fa-trash"></i></button>`;
            }

            const item = document.createElement('div');
            item.className = 'package-item';
            item.innerHTML = `
                <img src="${img}" class="package-img">
                <div class="package-info">
                    <h4>${p.titulo} ${tagPromo} ${tagCrucero}</h4>
                    <p><strong>${p.moneda} ${p.precio}</strong> | ${p.duracion}</p>
                </div>
                ${btnDelete}
            `;
            lista.appendChild(item);
        });
    } catch (e) { console.error(e); }
}

async function borrarPaquete(id) {
    if (!confirm("¿Eliminar paquete permanentemente?")) return;
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
        if(data.success) { 
            alert("✅ Publicado"); 
            e.target.reset(); 
            document.getElementById('gallery').innerHTML = '';
            cargarPaquetes();
        } else { alert("Error: " + data.error); }
    } catch (err) { alert("Error de red"); }
    finally { btn.disabled = false; loader.style.display = 'none'; }
});

// 5. CRM (SOLICITUDES)
async function cargarSolicitudes() {
    const tbody = document.getElementById('lista-solicitudes');
    tbody.innerHTML = '<tr><td colspan="5">Cargando...</td></tr>';

    try {
        const res = await fetch(`${API_URL}/ver-solicitudes`);
        const data = await res.json();
        tbody.innerHTML = '';

        if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Bandeja vacía ✨</td></tr>'; return; }

        data.forEach(s => {
            const fecha = s.fecha ? new Date(s.fecha).toLocaleDateString() : '-';
            
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

// 6. UI
window.cambiarPestana = function(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    
    const idx = tab === 'paquetes' ? 0 : 1;
    document.querySelectorAll('.nav-btn')[idx].classList.add('active');
    if(tab === 'solicitudes') cargarSolicitudes();
};

window.actualizarEstiloTipo = function(tipo) {
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

window.previewImages = function(input) {
    const g = document.getElementById('gallery'); g.innerHTML = '';
    if (input.files) Array.from(input.files).forEach(f => {
        const r = new FileReader();
        r.onload = e => { const i = document.createElement('img'); i.src = e.target.result; g.appendChild(i); };
        r.readAsDataURL(f);
    });
};