// Variable global para almacenar los datos del JSON completo
let allData = [];
let currentPrimaryFilter = 'todos'; // Variable para guardar el filtro Nivel 1 (tipo: nacional/internacional)

// ================================================================
// ==== FUNCIÓN GLOBAL PARA CARGAR DATOS Y HACER EL FILTRADO ======
// ================================================================

async function loadAllData() {
    try {
        const response = await fetch('packages.json');
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} - El archivo packages.json no se pudo cargar.`);
        }
        
        window.allData = await response.json(); 
        
        // Inicialización y renderizado
        renderAllSections(window.allData);
        setupFilters(); // Incluye Nivel 1 y Nivel 0
        setupModals();
        
    } catch (error) {
        console.error('ERROR CRÍTICO: No se pudieron cargar los datos dinámicos. Revisar packages.json o Live Server.', error);
        
        const promocionesSection = document.getElementById('promociones');
        const paquetesSection = document.querySelector('.paquetes-section');
        if (promocionesSection) promocionesSection.style.display = 'none';
        if (paquetesSection) paquetesSection.style.display = 'none';
        
        setupFilters(); 
    }
}

// Función central para crear el HTML de las tarjetas
function renderCards(packagesArray, targetId) {
    const targetGrid = document.getElementById(targetId);
    if (!targetGrid) return; 

    // 1. Identificar la sección padre (para controlar la visibilidad)
    const parentSection = (targetId === 'paquetes') 
        ? targetGrid.closest('main') // Para 'paquetes', la sección es <main class="paquetes-section">
        : targetGrid.closest('section'); // Para 'promociones-grid', la sección es <section id="promociones">

    // 2. CONTROL VISIBILITY LOGIC (Solución al problema de títulos vacíos)
    if (packagesArray.length === 0) {
        if (parentSection) parentSection.style.display = 'none';
        targetGrid.innerHTML = ''; 
        return;
    }
    
    if (parentSection) parentSection.style.display = 'block';
    
    // 3. RENDER CONTENT
    targetGrid.innerHTML = ''; 

    packagesArray.forEach(paquete => {
        const resumenHTML = paquete.incluye_resumen && Array.isArray(paquete.incluye_resumen) ? 
            paquete.incluye_resumen.map(item => `<li>${item}</li>`).join('') : '';
        
        const precioHTML = paquete.precio_desde ? 
            `<p class="precio" style="font-weight: 700; color: var(--azul);">Desde: ${paquete.precio_desde}</p>` : '';
            
        const cardHTML = `
            <div class="paquete" data-destino="${paquete.destino}" data-tipo="${paquete.tipo}" data-region="${paquete.region}">
                <img src="${paquete.imagen_url}" alt="${paquete.titulo}" />
                <div class="content">
                    <h3>${paquete.titulo}</h3>
                    <p>${paquete.subtitulo}</p>
                    <ul class="resumen-paquete">${resumenHTML}</ul>
                    ${precioHTML}
                    <a href="#" class="btn-secondary btn-ver-mas" data-target="#${paquete.modal_id}">Ver más</a>
                </div>
            </div>
        `;
        targetGrid.innerHTML += cardHTML;
        
        renderModal(paquete);
    });
    
    setupModals();
}

// Renderiza ambas secciones (Paquetes y Promociones) al inicio
function renderAllSections(data) {
    const promotions = data.filter(p => p.is_promo === true);
    const regularPackages = data.filter(p => p.is_promo === false);
    
    renderCards(promotions, 'promociones-grid');
    renderCards(regularPackages, 'paquetes');
    
    if (document.getElementById('promociones-grid')) {
         window.promociones = document.querySelectorAll('#promociones-grid .paquete'); 
         showPromoPage(1);
    }
}


// ================================================================
// ==== LÓGICA DE TRIPLE FILTRADO (Nivel 1, 2, 3) =================
// ================================================================

// NIVEL 3: Destinos Específicos
function generateTertiaryFilters(data, tipo, region) {
    const terciarioContainer = document.getElementById('filtrador-terciario');
    if (!terciarioContainer) return;

    terciarioContainer.style.display = 'flex';
    terciarioContainer.innerHTML = '';
    
    const filteredByRegion = data.filter(p => p.tipo === tipo && p.region === region);
    const destinations = new Set(filteredByRegion.map(p => p.destino));

    if (destinations.size > 0) {
        
        const allBtn = document.createElement('button');
        allBtn.textContent = `Todos los Destinos en ${region}`;
        allBtn.classList.add('filter-chip', 'active');
        allBtn.dataset.nivel = 'terciario';
        allBtn.dataset.filtro = region; // Filtro de reset
        terciarioContainer.appendChild(allBtn);


        destinations.forEach(destino => {
            const btn = document.createElement('button');
            btn.textContent = destino;
            btn.classList.add('filter-chip');
            btn.dataset.nivel = 'terciario';
            btn.dataset.filtro = destino;
            terciarioContainer.appendChild(btn);
        });

        terciarioContainer.querySelectorAll('.filter-chip').forEach(btn => {
            btn.addEventListener('click', handleTertiaryFilterClick);
        });
        
    } else {
        terciarioContainer.style.display = 'none';
    }
}

// NIVEL 2: Regiones (Sudamérica, Caribe, Cusco)
function generateSecondaryFilters(data, tipo) {
    const secundarioContainer = document.getElementById('filtrador-secundario');
    const terciarioContainer = document.getElementById('filtrador-terciario');

    if (!secundarioContainer) return;
    
    secundarioContainer.style.display = 'flex';
    secundarioContainer.innerHTML = '';
    
    if (terciarioContainer) terciarioContainer.style.display = 'none'; // Ocultar Nivel 3 al cambiar Nivel 1
    
    const filteredByPrimary = data.filter(p => p.tipo === tipo);
    const regions = new Set(filteredByPrimary.map(p => p.region));

    if (regions.size > 0) {
        
        const allBtn = document.createElement('button');
        allBtn.textContent = `Todas las Regiones`;
        allBtn.classList.add('filter-chip', 'active');
        allBtn.dataset.nivel = 'secundario';
        allBtn.dataset.filtro = tipo; 
        secundarioContainer.appendChild(allBtn);


        regions.forEach(region => {
            const btn = document.createElement('button');
            btn.textContent = region;
            btn.classList.add('filter-chip');
            btn.dataset.nivel = 'secundario';
            btn.dataset.filtro = region; 
            secundarioContainer.appendChild(btn);
        });

        secundarioContainer.querySelectorAll('.filter-chip').forEach(btn => {
            btn.addEventListener('click', handleSecondaryFilterClick);
        });
        
    } else {
        secundarioContainer.style.display = 'none';
    }
}


// NIVEL 1: MANEJADOR DEL CLIC EN EL FILTRO PRINCIPAL (Nacional/Internacional/Promociones/Todos)
function handlePrimaryFilterClick(event) {
    const btn = event.currentTarget;
    const filtro = btn.dataset.filtro;
    const filtrosPrincipal = document.querySelectorAll('#filtrador-principal .filter-chip');
    
    filtrosPrincipal.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    currentPrimaryFilter = filtro;
    
    document.getElementById('filtrador-secundario').style.display = 'none';
    document.getElementById('filtrador-terciario').style.display = 'none';
    if (!window.allData || window.allData.length === 0) return;

    if (filtro === 'nacional' || filtro === 'internacional') {
        generateSecondaryFilters(window.allData, filtro);
        
        const paquetesFiltrados = window.allData.filter(p => p.tipo === filtro && p.is_promo === false);
        renderCards(paquetesFiltrados, 'paquetes');
        
        renderCards(window.allData.filter(p => p.tipo === filtro && p.is_promo === true), 'promociones-grid');
        
    } else if (filtro === 'todos') {
        renderAllSections(window.allData);
        
    } else if (filtro === 'promociones') {
        // Limpia la sección de paquetes regulares
        const paquetesMain = document.getElementById('paquetes');
        if (paquetesMain) {
            paquetesMain.innerHTML = '';
            const mainSection = paquetesMain.closest('main');
            if (mainSection) mainSection.style.display = 'none';
        }
        
        renderCards(window.allData.filter(p => p.is_promo === true), 'promociones-grid');
    }
    
    window.promociones = document.querySelectorAll('#promociones-grid .paquete'); 
    showPromoPage(1);
}

// MANEJADOR DEL CLIC EN EL NIVEL 2 (Región)
function handleSecondaryFilterClick(event) {
    const btn = event.currentTarget;
    const regionFiltro = btn.dataset.filtro;
    const secundarioContainer = document.getElementById('filtrador-secundario');
    
    secundarioContainer.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    currentSecondaryFilter = regionFiltro; 
    
    let paquetesFiltrados = [];
    
    if (regionFiltro === currentPrimaryFilter) { 
        // Botón "Todas las Regiones"
        paquetesFiltrados = window.allData.filter(p => p.tipo === currentPrimaryFilter && p.is_promo === false);
        const promosFiltradas = window.allData.filter(p => p.tipo === currentPrimaryFilter && p.is_promo === true);
        
        document.getElementById('filtrador-terciario').style.display = 'none';
        renderCards(promosFiltradas, 'promociones-grid');

    } else {
        // Región específica (ej: Sudamérica)
        paquetesFiltrados = window.allData.filter(p => 
            p.tipo === currentPrimaryFilter && 
            p.region === regionFiltro &&
            p.is_promo === false
        );
        const promosFiltradas = window.allData.filter(p => 
            p.tipo === currentPrimaryFilter && 
            p.region === regionFiltro && 
            p.is_promo === true
        );
        
        // Mostrar el Nivel 3
        generateTertiaryFilters(window.allData, currentPrimaryFilter, regionFiltro);
        renderCards(promosFiltradas, 'promociones-grid');
    }
    
    renderCards(paquetesFiltrados, 'paquetes');
    window.promociones = document.querySelectorAll('#promociones-grid .paquete'); 
    showPromoPage(1);
}


// MANEJADOR DEL CLIC EN EL NIVEL 3 (Destino)
function handleTertiaryFilterClick(event) {
    const btn = event.currentTarget;
    const destinoFiltro = btn.dataset.filtro;
    const terciarioContainer = document.getElementById('filtrador-terciario');
    
    terciarioContainer.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const activeRegionBtn = document.querySelector('#filtrador-secundario .filter-chip.active');
    if (!activeRegionBtn) return;
    
    const regionActiva = activeRegionBtn.dataset.filtro;
    
    let paquetesFiltrados = [];
    
    if (destinoFiltro === regionActiva) { 
        // Botón "Todos los Destinos" - Volvemos al filtro de Nivel 2
        paquetesFiltrados = window.allData.filter(p => 
            p.tipo === currentPrimaryFilter && 
            p.region === regionActiva &&
            p.is_promo === false
        );
        
    } else {
        // Destino específico (ej: Buenos Aires)
        paquetesFiltrados = window.allData.filter(p => 
            p.tipo === currentPrimaryFilter && 
            p.region === regionActiva &&
            p.destino === destinoFiltro &&
            p.is_promo === false
        );
    }
    
    // Promociones: Filtramos por el destino específico (o la región si es el botón 'Todos')
    const promosFiltradas = window.allData.filter(p => 
        p.is_promo === true && 
        p.tipo === currentPrimaryFilter &&
        (destinoFiltro === regionActiva ? p.region === regionActiva : p.destino === destinoFiltro)
    );
    
    renderCards(paquetesFiltrados, 'paquetes');
    renderCards(promosFiltradas, 'promociones-grid');
    
    window.promociones = document.querySelectorAll('#promociones-grid .paquete'); 
    showPromoPage(1);
}


// NIVEL 0: FILTRO POR INTERESES
function setupInterestFilters() {
    document.querySelectorAll('#filtrador-intereses .filter-chip').forEach(btn => {
        btn.addEventListener('click', handleInterestFilterClick);
    });
}

function handleInterestFilterClick(event) {
    const btn = event.currentTarget;
    const interesFiltro = btn.dataset.filtro;
    const filtrosInteres = document.querySelectorAll('#filtrador-intereses .filter-chip');
    
    const isActive = btn.classList.toggle('active');
    
    let activeInterests = Array.from(filtrosInteres)
        .filter(b => b.classList.contains('active'))
        .map(b => b.dataset.filtro);
    
    // Si no hay intereses activos, mostrar todos los paquetes y reseteamos el Nivel 1
    if (activeInterests.length === 0) {
        // Resetear activos del Nivel 1
        document.querySelectorAll('#filtrador-principal .filter-chip').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-filtro="todos"]').classList.add('active');
        
        renderAllSections(window.allData);
        return;
    }
    
    // Filtramos la data donde *todos* los tags activos estén presentes en el array 'intereses' del paquete
    const filteredData = window.allData.filter(paquete => 
        activeInterests.every(interest => paquete.intereses && paquete.intereses.includes(interest))
    );
    
    // Limpiar y desactivar filtros geográficos (Nivel 1)
    document.querySelectorAll('#filtrador-principal .filter-chip').forEach(b => b.classList.remove('active'));
    document.getElementById('filtrador-secundario').style.display = 'none';
    document.getElementById('filtrador-terciario').style.display = 'none';
    
    // Renderizar resultados filtrados (separando promociones y paquetes regulares)
    renderCards(filteredData.filter(p => p.is_promo === true), 'promociones-grid');
    renderCards(filteredData.filter(p => p.is_promo === false), 'paquetes');
    
    window.promociones = document.querySelectorAll('#promociones-grid .paquete'); 
    showPromoPage(1);
}


// REEMPLAZO DE setupFilters()
function setupFilters() {
    document.querySelectorAll('#filtrador-principal .filter-chip').forEach(btn => {
        btn.addEventListener('click', handlePrimaryFilterClick);
    });
    
    // Inicialización del filtro de Intereses
    setupInterestFilters(); 
    
    if (window.allData && window.allData.length > 0) {
        renderAllSections(window.allData); 
    }
}


// ... (El resto del código se mantiene igual: Modales, Carruseles, etc.) ...


// ================================================================
// ==== MODALES Y CARRUSEL DINÁMICO ===============================
// ================================================================

// Función para generar un modal (ventana emergente) CON CARRUSEL
function renderModal(paquete) {
    const modalContainer = document.getElementById('dynamic-modals-container');
    // Si no tiene la data de imágenes para el carrusel o detalles, no se crea el modal.
    if (!modalContainer || !paquete.detalles_modal || !paquete.carousel_images || paquete.carousel_images.length === 0) return; 

    const detallesHTML = paquete.detalles_modal.incluye.map(item => `<li>${item}</li>`).join('');
    
    // 1. Generar el HTML de las imágenes del carrusel
    const carouselImagesHTML = paquete.carousel_images.map((imgUrl, index) => `
        <img src="${imgUrl}" 
             alt="${paquete.titulo} - Foto ${index + 1}" 
             class="modal-carousel-img" 
             style="${index === 0 ? 'display: block;' : 'display: none;'}">
    `).join('');

    // 2. Insertar toda la estructura del modal
    const modalHTML = `
        <div id="${paquete.modal_id}" class="modal">
            <div class="modal-content">
                <div class="modal-img">
                    <div class="modal-carousel-container">
                        ${carouselImagesHTML}
                        <button class="carousel-nav prev" data-target-modal="#${paquete.modal_id}" data-direction="-1">&#10094;</button>
                        <button class="carousel-nav next" data-target-modal="#${paquete.modal_id}" data-direction="1">&#10095;</button>
                    </div>
                </div>
                <div class="modal-info">
                    <span class="close" data-modal-id="#${paquete.modal_id}">&times;</span>
                    <h2>${paquete.titulo}</h2>
                    <p><strong>Operador:</strong> ${paquete.detalles_modal.operador || 'Consultar'}</p>
                    <p>${paquete.detalles_modal.duracion || paquete.subtitulo}</p>
                    <h4>Incluye:</h4>
                    <ul class="modal-includes">${detallesHTML}</ul>
                    ${paquete.detalles_modal.precio_detalle ? `<p class="modal-price"><strong>${paquete.detalles_modal.precio_detalle}</strong></p>` : ''}
                    <button class="btn-reservar" onclick="window.open('https://wa.me/51951091498?text=Hola, me interesa el paquete ${paquete.titulo}', '_blank')">
                      Lo Quiero
                    </button>
                </div>
            </div>
        </div>
    `;
    modalContainer.innerHTML += modalHTML;
}

// Función que controla el movimiento del carrusel en el modal
function moveCarousel(modalId, direction) {
    const modal = document.querySelector(modalId);
    if (!modal) return;
    
    const images = modal.querySelectorAll('.modal-carousel-img');
    let currentIndex = -1;
    images.forEach((img, index) => {
        if (img.style.display === 'block') {
            currentIndex = index;
        }
    });
    if (currentIndex === -1) return; 

    images[currentIndex].style.display = 'none';
    let newIndex = (currentIndex + direction + images.length) % images.length;
    images[newIndex].style.display = 'block';
}

// Función para inicializar modales después de que las tarjetas se han creado
function setupModals() {
    // 1. Abrir Modales
    document.querySelectorAll('.btn-ver-mas').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const target = this.getAttribute('data-target');
        const modal = document.querySelector(target);
        if (modal) modal.style.display = "flex";
      });
    });

    // 2. Cerrar Modales (botón X)
    document.querySelectorAll('.modal .close').forEach(btn => {
      btn.addEventListener('click', function () {
        this.closest('.modal').style.display = "none";
      });
    });
    
    // 3. Cerrar Modales (clic fuera)
    window.addEventListener('click', function (e) {
      if (e.target.classList.contains('modal')) e.target.style.display = "none";
    });

    // 4. Lógica de Navegación del Carrusel
    document.querySelectorAll('.carousel-nav').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const modalId = this.getAttribute('data-target-modal');
            const direction = parseInt(this.getAttribute('data-direction'));
            moveCarousel(modalId, direction);
        });
    });
}


// ================================================================
// ==== CÓDIGO RESTANTE DEL SITIO (HOME, NAV, CARRUSEL CLIENTES) ==
// ================================================================

// Ejecutar la carga al inicio de la página (si estamos en paquetes.html)
if (document.getElementById('paquetes') || document.getElementById('promociones')) {
    loadAllData(); 
}

// ==== PAGINACIÓN DE PROMOCIONES (Mantenido) ====
const promocionesSection = document.querySelector('#promociones');
if (promocionesSection) {
  const paginationContainer = document.createElement('div');
  paginationContainer.classList.add('pagination');
  promocionesSection.after(paginationContainer);

  const itemsPerPage = 3;
  let currentPromoPage = 1;

  function showPromoPage(page) {
    const promociones = document.querySelectorAll('#promociones-grid .paquete');
    currentPromoPage = page;
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;

    promociones.forEach((promo, i) => {
      promo.style.display = (i >= start && i < end) ? 'block' : 'none';
    });
    renderPromoPagination();
  }

  function renderPromoPagination() {
    const promociones = document.querySelectorAll('#promociones-grid .paquete');
    paginationContainer.innerHTML = '';
    const totalPromoPages = Math.ceil(promociones.length / itemsPerPage);

    for (let i = 1; i <= totalPromoPages; i++) {
      const btn = document.createElement('button');
      btn.textContent = i;
      btn.classList.toggle('active', i === currentPromoPage);
      btn.addEventListener('click', () => showPromoPage(i));
      paginationContainer.appendChild(btn);
    }
  }
}

// --- Carrusel automático en index.html ---
const images = [
  'img/carrusel1.jpg',
  'img/carrusel2.jpg',
  'img/carrusel3.jpg'
];
let heroIndex = 0;
const heroCarousel = document.querySelector('.carousel');
function changeBackground() {
  if (heroCarousel) {
    heroCarousel.style.backgroundImage = `url('${images[heroIndex]}')`;
    heroIndex = (heroIndex + 1) % images.length;
  }
}
changeBackground();
setInterval(changeBackground, 5000);


// --- Menú fijo al hacer scroll ---
window.addEventListener('scroll', () => {
  const header = document.querySelector('header.navbar'); 
  if (window.scrollY > 50) {
    header.classList.add('sticky');
  } else {
    header.classList.remove('sticky');
  }
});

// --- Botón flotante de WhatsApp ---
const whatsappBtn = document.querySelector('.whatsapp-float');
if (whatsappBtn) {
  whatsappBtn.addEventListener('click', () => {
    window.open('https://wa.me/51951091498', '_blank');
  });
}

// --- Animaciones suaves al hacer scroll ---
const animatedElements = document.querySelectorAll('.animate-on-scroll');
function checkAnimation() {
  const triggerBottom = window.innerHeight * 0.85;
  animatedElements.forEach(el => {
    const elementTop = el.getBoundingClientRect().top;
    if (elementTop < triggerBottom) el.classList.add('show');
  });
}
window.addEventListener('scroll', checkAnimation);
checkAnimation();

// --- Menú hamburguesa ---
const menuToggle = document.getElementById('menu-toggle');
const navMenu = document.querySelector('#nav-menu');
if (menuToggle && navMenu) {
  menuToggle.addEventListener('click', () => navMenu.classList.toggle('show'));
  navMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => navMenu.classList.remove('show')));
}

// --- Carrusel clientes con dots y botones ---
const clientesCarousel = document.querySelector('.clientes-carousel');
const dotsContainer = document.querySelector('.carousel-dots');
if (clientesCarousel) {
  const clientesImages = clientesCarousel.querySelectorAll('img');
  let currentIndex = 0;
  const totalItems = clientesImages.length;
  
  clientesImages.forEach((_, i) => {
    const dot = document.createElement('button');
    if (i === 0) dot.classList.add('active');
    dot.addEventListener('click', () => { 
        currentIndex = i; 
        updateClientesCarousel(); 
    });
    dotsContainer.appendChild(dot);
  });

  function updateClientesCarousel() {
    const imageWidth = clientesImages[0].clientWidth + 24; 
    const itemsVisible = window.innerWidth >= 992 ? 3 : 1;
    const maxIndex = Math.max(0, totalItems - itemsVisible);
    
    currentIndex = Math.min(Math.max(0, currentIndex), maxIndex);
    
    clientesCarousel.style.transform = `translateX(${-currentIndex * imageWidth}px)`;

    dotsContainer.querySelectorAll('button').forEach((dot, i) => {
      dot.classList.toggle('active', i === currentIndex);
      
      if (window.innerWidth >= 992) {
          dot.style.display = (i <= maxIndex) ? 'block' : 'none';
      } else {
          dot.style.display = 'block';
      }
    });
  }
  window.addEventListener('resize', updateClientesCarousel);
  updateClientesCarousel();
}
// Reemplaza esta función en tu script.js
function renderCards(packagesArray, targetId) {
    const targetGrid = document.getElementById(targetId);
    if (!targetGrid) return; 

    // 1. Identificar la sección padre (para controlar la visibilidad)
    const parentSection = (targetId === 'paquetes') 
        ? targetGrid.closest('main') // targetId 'paquetes' está dentro de <main class="paquetes-section">
        : targetGrid.closest('section'); // targetId 'promociones-grid' está dentro de <section id="promociones">

    // 2. CONTROL VISIBILITY LOGIC
    if (packagesArray.length === 0) {
        // Si no hay resultados, OCULTAR toda la sección y limpiar el grid
        if (parentSection) parentSection.style.display = 'none';
        targetGrid.innerHTML = ''; 
        return;
    }
    
    // Si hay resultados, MOSTRAR la sección
    if (parentSection) parentSection.style.display = 'block';
    
    // 3. RENDER CONTENT
    targetGrid.innerHTML = ''; 

    packagesArray.forEach(paquete => {
        // Esto asume que el objeto 'paquete' tiene 'incluye_resumen', etc.
        const resumenHTML = paquete.incluye_resumen && Array.isArray(paquete.incluye_resumen) ? 
            paquete.incluye_resumen.map(item => `<li>${item}</li>`).join('') : '';
        
        const precioHTML = paquete.precio_desde ? 
            `<p class="precio" style="font-weight: 700; color: var(--azul);">Desde: ${paquete.precio_desde}</p>` : '';
            
        const cardHTML = `
            <div class="paquete" data-destino="${paquete.destino}" data-tipo="${paquete.tipo}" data-region="${paquete.region}">
                <img src="${paquete.imagen_url}" alt="${paquete.titulo}" />
                <div class="content">
                    <h3>${paquete.titulo}</h3>
                    <p>${paquete.subtitulo}</p>
                    <ul class="resumen-paquete">${resumenHTML}</ul>
                    ${precioHTML}
                    <a href="#" class="btn-secondary btn-ver-mas" data-target="#${paquete.modal_id}">Ver más</a>
                </div>
            </div>
        `;
        targetGrid.innerHTML += cardHTML;
        
        renderModal(paquete);
    });
    
    setupModals();
}

// Reemplaza esta función en tu script.js
function handlePrimaryFilterClick(event) {
    const btn = event.currentTarget;
    const filtro = btn.dataset.filtro;
    const filtrosPrincipal = document.querySelectorAll('#filtrador-principal .filter-chip');
    
    filtrosPrincipal.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    currentPrimaryFilter = filtro;
    
    document.getElementById('filtrador-secundario').style.display = 'none';
    if (!window.allData || window.allData.length === 0) return;

    if (filtro === 'nacional' || filtro === 'internacional') {
        generateSecondaryFilters(window.allData, filtro);
        
        const paquetesFiltrados = window.allData.filter(p => p.tipo === filtro && p.is_promo === false);
        renderCards(paquetesFiltrados, 'paquetes');
        
        renderCards(window.allData.filter(p => p.tipo === filtro && p.is_promo === true), 'promociones-grid');
        
    } else if (filtro === 'todos') {
        renderAllSections(window.allData);
        
    } else if (filtro === 'promociones') {
        // Manejo para el botón "Promociones"
        const paquetesRegulares = window.allData.filter(p => p.is_promo === false);
        
        // Limpiar sección de paquetes regulares (si no hay, renderCards la ocultará)
        renderCards([], 'paquetes'); 
        
        // Mostrar solo promociones
        renderCards(window.allData.filter(p => p.is_promo === true), 'promociones-grid');
    }
    
    window.promociones = document.querySelectorAll('#promociones-grid .paquete'); 
    showPromoPage(1);
}