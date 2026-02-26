// frontend/js/components.js

document.addEventListener("DOMContentLoaded", () => {
  loadHeader();
  loadFooter();
});

// --- CARGAR HEADER (Menú General) ---
function loadHeader() {
  const headerContainer = document.getElementById("app-header");
  if (!headerContainer) return;

  // HTML del Header (Limpio, solo clases)
  const headerHTML = `
    <header class="navbar">
        <div class="nav-container">
            <a href="index.html" class="logo">
                <img src="img/logo.png" alt="Maui Viajes">
            </a>

            <button id="menu-toggle" aria-label="Abrir menú">
                <i class="fa-solid fa-bars"></i>
            </button>

            <nav id="nav-menu-container">
                <ul class="nav-links">
                    <li><a href="index.html">Inicio</a></li>
                    <li><a href="nosotros.html">Nosotros</a></li>
                    <li><a href="paquetes.html">Paquetes</a></li>
                    <li><a href="cruceros.html">Cruceros</a></li>
                    <li><a href="bodas.html">Bodas</a></li>
                </ul>
                
                <a href="https://wa.me/51951091498" class="btn-nav-reserva" target="_blank">
                    <i class="fa-brands fa-whatsapp"></i> Reservar
                </a>
            </nav>
        </div>
    </header>
    `;

  headerContainer.innerHTML = headerHTML;

  // LÓGICA: Marcar la página activa automáticamente
  const path = window.location.pathname;
  const links = headerContainer.querySelectorAll('.nav-links a');

  links.forEach(link => {
    const href = link.getAttribute('href');
    // Si la URL actual incluye el enlace, lo activamos
    if (path.includes(href) && href !== 'index.html') {
      link.classList.add('active');
    }
    // Caso especial para el Home
    if ((path === '/' || path.endsWith('index.html')) && href === 'index.html') {
      link.classList.add('active');
    }
  });

  // LÓGICA: Menú Móvil
  const menuToggle = document.getElementById('menu-toggle');
  const navMenu = document.getElementById('nav-menu-container');

  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      const icon = menuToggle.querySelector('i');
      if (icon) icon.className = navMenu.classList.contains('active') ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
    });
  }
}

// frontend/js/components.js

// ... (La función loadHeader déjala igual) ...

function loadFooter() {
  const footerContainer = document.getElementById("global-footer") || document.getElementById("app-footer");
  if (!footerContainer) return;

  const footerHTML = `
    <footer class="site-footer">
      <div class="container footer-grid">
        
        <div class="footer-col">
          <h4>Explora</h4>
          <ul class="footer-links">
            <li><a href="paquetes.html"><i class="fa-solid fa-chevron-right"></i> Paquetes del Mundo</a></li>
            <li><a href="cruceros.html"><i class="fa-solid fa-chevron-right"></i> Cruceros</a></li>
            <li><a href="bodas.html"><i class="fa-solid fa-chevron-right"></i> Bodas de Destino</a></li>
            <li><a href="nosotros.html"><i class="fa-solid fa-chevron-right"></i> Servicios a Medida</a></li>
          </ul>
        </div>

        <div class="footer-col">
          <h4>Legal & Nosotros</h4>
          <ul class="footer-links">
            <li><a href="nosotros.html#mision"><i class="fa-solid fa-chevron-right"></i> Nuestra Esencia</a></li>
            <li><a href="terminos.html"><i class="fa-solid fa-file-contract"></i> Términos y Condiciones</a></li>
            <li><a href="privacidad.html"><i class="fa-solid fa-shield-halved"></i> Políticas de Privacidad</a></li>
            <li><a href="reclamaciones.html"><i class="fa-solid fa-book-open"></i> Libro de Reclamaciones</a></li>
          </ul>
        </div>

        <div class="footer-col contact-col">
          <h4>Contáctanos</h4>
          
          <div class="contact-item">
            <i class="fa-solid fa-location-dot"></i>
            <p>San Miguel, Lima - Perú</p>
          </div>

          <div class="contact-item">
            <i class="fa-solid fa-phone"></i>
            <div class="phones">
                <p>+51 931 629 438</p>
            </div>
          </div>

          <div class="contact-item">
            <i class="fa-solid fa-envelope"></i>
            <p>reservas@mauiviajes.com</p>
          </div>
        </div>

        <div class="footer-col">
          <h4>Síguenos</h4>
          <div class="social-icons">
            <a href="https://www.facebook.com/mauiviajes" target="_blank" aria-label="Facebook">
              <i class="fa-brands fa-facebook-f"></i>
            </a>
            <a href="https://www.instagram.com/mauiviajesperu/" target="_blank" aria-label="Instagram">
              <i class="fa-brands fa-instagram"></i>
            </a>
            <a href="https://www.tiktok.com/@maui.viajes.per.s" target="_blank" aria-label="TikTok">
              <i class="fa-brands fa-tiktok"></i>
            </a>
          </div>
          
          <h4 style="margin-top: 25px;">Suscríbete</h4>
          <form action="#" class="newsletter">
            <input type="email" placeholder="Tu email" />
            <button type="submit"><i class="fa-solid fa-paper-plane"></i></button>
          </form>
        </div>

      </div>

      <div class="footer-bottom">
        <p>&copy; 2026 Maui Viajes S.A.C | RUC: 20608542770 | Todos los derechos reservados.</p>
        
        <p style="margin-top: 10px; font-size: 0.85rem; opacity: 0.8;">
            Diseñado y Desarrollado por 
            <a href="#" style="color: var(--oro-soft); text-decoration: none; font-weight: 600; transition: 0.3s;">
                Jose Muñoz
            </a>
        </p>
      </div>
    </footer>
    `;

  footerContainer.innerHTML = footerHTML;
}
// --- BOTÓN FLOTANTE DE WHATSAPP (Inyección Automática) ---
function renderFloatingWhatsApp() {
  const numero = "51931629438"; // Tu número
  const mensaje = "Hola, estoy viendo la web y quiero más información.";

  const waButton = document.createElement('a');
  waButton.href = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
  waButton.target = "_blank";
  waButton.className = "whatsapp-float";
  waButton.innerHTML = '<i class="fa-brands fa-whatsapp"></i>';
  waButton.setAttribute('aria-label', 'Chat en WhatsApp');

  document.body.appendChild(waButton);
}

// --- TOAST NOTIFICATION ---
function showToast(message, type = 'success') {
  // Remover toast anterior si existe
  const existing = document.querySelector('.newsletter-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `newsletter-toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
  document.body.appendChild(toast);

  // Animar entrada
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Auto-cerrar después de 4 segundos
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 500);
  }, 4000);
}

// --- NEWSLETTER FUNCIONAL ---
function setupNewsletter() {
  const form = document.querySelector('.newsletter');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = form.querySelector('input[type="email"]');
    const email = input.value.trim();
    const btn = form.querySelector('button');

    if (!email) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (data.success) {
        showToast('¡Suscrito exitosamente! 🎉 Recibirás nuestras mejores ofertas.');
        input.value = '';
      } else if (data.duplicate) {
        showToast('Ya estás suscrito con este email 😊', 'success');
        input.value = '';
      } else {
        showToast('Error al suscribirse. Intenta de nuevo.', 'error');
      }
    } catch (err) {
      console.error('Newsletter error:', err);
      showToast('Error de conexión. Intenta de nuevo.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
    }
  });
}

// Ejecutamos las funciones cuando carga la página
document.addEventListener('DOMContentLoaded', () => {
  renderFloatingWhatsApp();
  setupNewsletter();
});