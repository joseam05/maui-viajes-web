// js/modal.js - VERSIÓN DE LUJO + CORREO 📧

let currentImages = []; // Fotos del paquete actual
let currentImageIndex = 0; // Índice de la foto actual
let paqueteActualTitulo = ""; // <--- NUEVO: Para saber qué paquete se cotiza

window.openPackageModal = function(pkg) {
    const modal = document.getElementById('package-modal');
    if (!modal) return;

    // 1. PREPARAR FOTOS (CARRUSEL)
    currentImages = (pkg.imagenes && pkg.imagenes.length > 0) 
        ? pkg.imagenes 
        : ['img/hero-bg.jpg']; 
    currentImageIndex = 0;
    updateModalImage(); 

    // 2. GUARDAR TÍTULO (IMPORTANTE PARA EL CORREO)
    paqueteActualTitulo = pkg.titulo; 

    // 3. TEXTOS BÁSICOS
    const moneda = pkg.moneda === 'USD' ? 'US$' : 'S/';
    document.getElementById('modal-titulo').textContent = pkg.titulo;
    document.getElementById('modal-precio').textContent = `${moneda} ${pkg.precio}`;
    
    // Vigencia con estilo
    const elVigencia = document.getElementById('modal-vigencia');
    if(elVigencia) elVigencia.innerHTML = `<i class="far fa-calendar-alt"></i> ${pkg.vigencia || "Consultar fechas"}`;

    // 4. FORMATO DE DESCRIPCIÓN (Tu código "Luxury")
    const elDescripcion = document.getElementById('modal-descripcion');
    if (pkg.descripcion) {
        const parrafos = pkg.descripcion.split('\n').filter(line => line.trim() !== '');
        const htmlDescripcion = parrafos.map(p => `<p style="margin-bottom: 15px; line-height: 1.6;">${p}</p>`).join('');
        elDescripcion.innerHTML = htmlDescripcion;
    } else {
        elDescripcion.textContent = "Sin descripción detallada.";
    }

    // 5. LISTA DE "INCLUYE"
    const lista = document.getElementById('modal-incluye');
    lista.innerHTML = '';
    if (pkg.incluye_total) {
        pkg.incluye_total.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `<i class="fas fa-check-circle" style="color:#c5a059; margin-right:8px;"></i> ${item}`;
            lista.appendChild(li);
        });
    }

    // 6. BOTÓN WHATSAPP 🟢
    const btnWsp = document.getElementById('btn-reservar-ws');
    if (btnWsp) {
        btnWsp.onclick = () => {
            const mensaje = `Hola Maui Viajes, estoy interesado en el paquete: ${pkg.titulo}`;
            const url = `https://wa.me/51951091498?text=${encodeURIComponent(mensaje)}`;
            window.open(url, '_blank');
        };
    }

    // 7. BOTÓN CORREO 📧 (NUEVO CÓDIGO)
    const btnMail = document.getElementById('btn-reservar-mail');
    if (btnMail) {
        btnMail.onclick = () => {
            // Cerramos el modal de detalles
            modal.style.display = 'none';
            // Abrimos el modal del formulario (función está en main.js)
            if (typeof abrirModalCotizar === "function") {
                abrirModalCotizar(pkg.titulo); 
            } else {
                console.error("Falta la función abrirModalCotizar en main.js");
            }
        };
    }

    // Mostrar el modal
    modal.style.display = 'flex';
};

// --- FUNCIONES DEL CARRUSEL (INTACTAS) ---

function updateModalImage() {
    const imgElement = document.getElementById('modal-imagen');
    if (imgElement) {
        imgElement.style.opacity = '0';
        setTimeout(() => {
            imgElement.src = currentImages[currentImageIndex];
            imgElement.style.opacity = '1';
        }, 200);
    }
    
    const btnPrev = document.getElementById('modal-prev');
    const btnNext = document.getElementById('modal-next');
    
    if (currentImages.length <= 1) {
        if(btnPrev) btnPrev.style.display = 'none';
        if(btnNext) btnNext.style.display = 'none';
    } else {
        if(btnPrev) btnPrev.style.display = 'block';
        if(btnNext) btnNext.style.display = 'block';
    }
}

window.nextImage = function() {
    currentImageIndex = (currentImageIndex + 1) % currentImages.length;
    updateModalImage();
};

window.prevImage = function() {
    currentImageIndex = (currentImageIndex - 1 + currentImages.length) % currentImages.length;
    updateModalImage();
};

// --- CERRAR MODALES (GLOBAL) ---
document.addEventListener('DOMContentLoaded', () => {
    // Cerrar Modal de Detalles
    const modalPackage = document.getElementById('package-modal');
    const closeBtns = document.querySelectorAll('.close-modal'); // Selecciona todas las 'X'
    
    closeBtns.forEach(btn => {
        btn.onclick = function() {
            // Cierra el modal padre del botón
            const modal = btn.closest('.modal') || btn.closest('.modal-cotizacion');
            if (modal) modal.style.display = 'none';
        }
    });
    
    // Cerrar al dar click afuera (Maneja ambos modales)
    window.onclick = (e) => {
        if (e.target.classList.contains('modal') || e.target.classList.contains('modal-cotizacion')) {
            e.target.style.display = 'none';
        }
    };
});