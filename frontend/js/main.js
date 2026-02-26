// js/main.js - VERSIÓN FINAL INTEGRADA

window.rawData = [];
window.currentPrimary = 'todos';
window.activeInterests = [];
window.searchQuery = '';
window.displayCurrency = 'original';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🏁 INICIANDO SISTEMA MAUI VIAJES...");

    // 1. CARGAR Y SEPARAR DATOS
    if (window.fetchPackages) {
        try {
            // A. Traemos TODO de la base de datos
            let allData = await window.fetchPackages();
            console.log(`📡 Total descargas: ${allData.length} items.`);

            // B. DETECTAR PÁGINA Y FILTRAR LA DATA GLOBAL
            const path = window.location.pathname;

            if (path.includes('cruceros.html')) {
                console.log("⚓ MODO CRUCEROS ACTIVADO");
                // Solo guardamos los que sean tipo 'crucero'
                window.rawData = allData.filter(p => p.tipo === 'crucero');
            }
            else if (path.includes('paquetes.html')) {
                console.log("📦 MODO PAQUETES ACTIVADO");
                // Guardamos paquetes O que no tengan tipo (para compatibilidad con los viejos)
                // Y EXCLUIMOS los cruceros
                window.rawData = allData.filter(p => p.tipo === 'paquete' || (!p.tipo && p.tipo !== 'crucero'));
            }
            else {
                // En el Home (index.html) o cualquier otra, guardamos todo
                console.log("🏠 MODO GLOBAL (Home)");
                window.rawData = allData;
            }

            console.log(`✅ Datos filtrados para esta página: ${window.rawData.length}`);

        } catch (error) {
            console.error("❌ Error descargando datos:", error);
        }
    }

    // 2. ACTIVAR BOTONES DE FILTRO
    setupFilters();
    // --- 3. PINTAR LA PANTALLA (CORREGIDO) ---

    const gridPaquetes = document.getElementById('paquetes-grid');
    const gridPromos = document.getElementById('promociones-grid');

    // A. PINTAR PROMOCIONES (Si existe el contenedor en ESTA página)
    // Esto funcionará tanto en el Home como en Paquetes.html
    if (gridPromos) {
        // Filtramos solo los que tienen is_promo = true
        // IMPORTANTE: Asegúrate que en Firebase tus paquetes tengan el campo "is_promo" como boolean true
        const soloPromos = window.rawData.filter(p => p.is_promo === true);

        console.log(`🔥 Promociones encontradas: ${soloPromos.length}`);

        if (soloPromos.length > 0) {
            if (window.renderPackageGrid) {
                window.renderPackageGrid(soloPromos, 'promociones-grid');
            }
        } else {
            // Opcional: Ocultar la sección entera si no hay promociones activas
            const sectionPromos = document.getElementById('promociones');
            if (sectionPromos) sectionPromos.style.display = 'none';
        }
    }

    // B. PINTAR GRID PRINCIPAL (Si existe)
    // Esto pintará el resto de paquetes debajo
    if (gridPaquetes) {
        window.updateUI(); // Pinta la grilla con los filtros activos
    }

    // 4. UI GLOBAL
    setupGlobalUI();
});

// --- FUNCIÓN DE CONFIGURACIÓN DE BOTONES ---
function setupFilters() {
    // 1. TABS PRINCIPALES (Píldoras o Botones Superiores)
    const filtrosPrincipales = document.querySelectorAll('#filtrador-principal .tab-btn, #filtrador-principal .pill-btn');

    filtrosPrincipales.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Visual
            filtrosPrincipales.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');

            // Lógica
            window.currentPrimary = e.currentTarget.dataset.filtro; // ej: 'caribe', 'nacional'
            window.updateUI();
        });
    });

    // 2. CHIPS DE INTERESES (Checkboxes secundarios)
    const filtrosIntereses = document.querySelectorAll('#filtrador-intereses .filter-chip');

    filtrosIntereses.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.currentTarget.classList.toggle('active');
            const interest = e.currentTarget.dataset.filtro;

            if (e.currentTarget.classList.contains('active')) {
                window.activeInterests.push(interest);
            } else {
                window.activeInterests = window.activeInterests.filter(i => i !== interest);
            }
            window.updateUI();
        });
    });

    // 3. BUSCADOR INTELIGENTE (con debounce)
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        let searchTimer = null;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                window.searchQuery = e.target.value.trim();
                window.updateUI();
            }, 300);
        });
    }

    // 4. CONVERSOR DE MONEDA
    const currencyToggle = document.getElementById('currency-toggle');
    if (currencyToggle) {
        const currencyBtns = currencyToggle.querySelectorAll('.currency-btn');
        currencyBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                currencyBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                window.displayCurrency = btn.dataset.currency;
                window.updateUI();
                // También volver a pintar promos
                const gridPromos = document.getElementById('promociones-grid');
                if (gridPromos && window.rawData) {
                    const soloPromos = window.rawData.filter(p => p.is_promo === true);
                    if (soloPromos.length > 0 && window.renderPackageGrid) {
                        window.renderPackageGrid(soloPromos, 'promociones-grid');
                    }
                }
            });
        });
    }
}

// --- FUNCIÓN QUE ACTUALIZA LA PANTALLA ---
// --- FUNCIÓN QUE ACTUALIZA LA PANTALLA (EN JS/MAIN.JS) ---
window.updateUI = function () {
    const grid = document.getElementById('paquetes-grid');
    if (!grid) return;

    // 1. Validar si hay datos
    if (!window.rawData || window.rawData.length === 0) {
        grid.innerHTML = '<p style="text-align:center; width:100%; color:#666;">No hay resultados disponibles.</p>';
        return;
    }

    // 2. Filtro de FAVORITOS (caso especial)
    let dataShow = window.rawData;
    if (window.currentPrimary === 'favoritos') {
        const wishlist = window.getWishlist ? window.getWishlist() : [];
        dataShow = dataShow.filter(p => wishlist.includes(p.id));
    } else {
        // Filtrar datos normales
        if (window.applyFilters) {
            dataShow = window.applyFilters(window.rawData, window.currentPrimary, window.activeInterests);
        }
    }

    // 3. LOGICA ANTI-DUPLICADOS (EL CAMBIO MÁGICO ✨)
    const topPromosSection = document.getElementById('promociones'); // La sección de arriba

    if (topPromosSection) {
        if (window.currentPrimary === 'promociones' || window.currentPrimary === 'favoritos') {
            // Si el usuario filtró "Ofertas" o "Favoritos", ocultamos la sección de arriba para no ver doble
            topPromosSection.style.display = 'none';
        } else {
            // Si filtró "Todos" u otra cosa, mostramos las destacadas arriba
            topPromosSection.style.display = 'block';
        }
    }

    // 4. Mostrar mensaje si no hay resultados
    if (dataShow.length === 0) {
        if (window.currentPrimary === 'favoritos') {
            grid.innerHTML = '<p style="text-align:center; width:100%; color:#666; padding: 40px 0;"><i class="fa-regular fa-heart" style="font-size:2rem; color:#e74c3c; display:block; margin-bottom:12px;"></i>Aún no tienes favoritos.<br><small>Haz clic en el ❤ de un paquete para agregarlo.</small></p>';
        } else {
            grid.innerHTML = '<p style="text-align:center; width:100%; color:#666;">No se encontraron resultados.</p>';
        }
        return;
    }

    // 5. Pintar la grilla de abajo
    if (window.renderPackageGrid) {
        window.renderPackageGrid(dataShow, 'paquetes-grid');
    }
};

// --- FUNCIONES PARA EL MODAL DE COTIZACIÓN ---
// Estas funciones deben ser globales para que los botones HTML las encuentren

window.abrirModalCotizar = function (nombrePaquete) {
    const modal = document.getElementById('modal-cotizar');
    const badge = document.getElementById('badge-paquete');
    const inputHidden = document.getElementById('input-paquete');

    if (modal) {
        // Llenamos el modal con el nombre del paquete que le dimos click
        badge.innerText = "Interés: " + nombrePaquete;
        inputHidden.value = nombrePaquete;
        modal.style.display = "flex";
    }
}

window.cerrarModalCotizar = function () {
    const modal = document.getElementById('modal-cotizar');
    if (modal) modal.style.display = "none";
}

// NOTA: Borré el window.onclick de aquí porque ya está en modal.js y maneja ambos modales.

// --- MANEJO DEL ENVÍO DEL FORMULARIO ---
const formCotizar = document.getElementById('form-cotizar');
if (formCotizar) {
    formCotizar.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = formCotizar.querySelector('button');
        const textoOriginal = btn.innerText;

        btn.innerText = "Enviando...";
        btn.disabled = true;

        const formData = new FormData(formCotizar);
        const datos = Object.fromEntries(formData.entries());

        try {
            // Asegúrate que el puerto coincida con tu backend (3000 o 5000)
            const res = await fetch('/api/solicitar-info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datos)
            });

            const data = await res.json();

            if (data.success) {
                // Usamos SweetAlert si existe, sino alert normal
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        title: '¡Solicitud Enviada!',
                        text: 'Revisa tu correo pronto, te enviaremos la información.',
                        icon: 'success',
                        confirmButtonColor: '#0f172a'
                    });
                } else {
                    alert('¡Solicitud Enviada! Revisa tu correo pronto.');
                }

                cerrarModalCotizar();
                formCotizar.reset();
            } else {
                throw new Error();
            }
        } catch (error) {
            console.error(error);
            if (typeof Swal !== 'undefined') {
                Swal.fire('Error', 'Hubo un problema al enviar la solicitud.', 'error');
            } else {
                alert('Error al enviar la solicitud.');
            }
        } finally {
            btn.innerText = textoOriginal;
            btn.disabled = false;
        }
    });
}

// --- UI GLOBAL (Menú, Carrusel) ---
function setupGlobalUI() {
    // Menú móvil: el listener ya se registra en components.js al inyectar el header.
    // No duplicamos aquí para evitar toggle doble.

    // Carrusel Hero con CROSSFADE suave (Solo si existe)
    const heroSection = document.querySelector('.hero');
    if (heroSection) {
        const images = ['img/carrusel1.jpg', 'img/carrusel2.jpg', 'img/carrusel3.jpg'];
        let currentIndex = 0;

        // Precargar todas las imágenes para evitar flashes
        images.forEach(src => {
            const img = new Image();
            img.src = src;
        });

        // Crear la capa de crossfade
        const fadeLayer = document.createElement('div');
        fadeLayer.className = 'hero-crossfade';
        // Insertarla ANTES del overlay (::before) pero dentro del hero
        heroSection.insertBefore(fadeLayer, heroSection.firstChild);

        setInterval(() => {
            // Avanzar al siguiente índice
            currentIndex = (currentIndex + 1) % images.length;
            const nextImage = images[currentIndex];

            // 1. Poner la nueva imagen en la capa de fade (invisible aún)
            fadeLayer.style.backgroundImage = `url('${nextImage}')`;

            // 2. Hacer visible la capa (transición CSS de opacity)
            fadeLayer.classList.add('visible');

            // 3. Cuando termina la transición, poner la imagen en el fondo base y ocultar la capa
            setTimeout(() => {
                heroSection.style.backgroundImage = `url('${nextImage}')`;
                fadeLayer.classList.remove('visible');
            }, 1300); // Un poco más que la duración de la transición CSS (1.2s)
        }, 5000);
    }
}