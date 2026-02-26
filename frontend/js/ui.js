// js/ui.js - VERSIÓN CON WISHLIST Y CONVERSOR DE MONEDA

// =========================================
// WISHLIST (FAVORITOS) con localStorage
// =========================================
const WISHLIST_KEY = 'maui_wishlist';

window.getWishlist = function () {
    try {
        return JSON.parse(localStorage.getItem(WISHLIST_KEY)) || [];
    } catch { return []; }
};

window.isInWishlist = function (id) {
    return window.getWishlist().includes(id);
};

window.toggleWishlist = function (id, btn) {
    let list = window.getWishlist();
    if (list.includes(id)) {
        list = list.filter(x => x !== id);
        if (btn) btn.classList.remove('active');
    } else {
        list.push(id);
        if (btn) btn.classList.add('active');
    }
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(list));
};

// =========================================
// CONVERSOR DE MONEDA
// =========================================
const EXCHANGE_RATE = 3.75; // 1 USD = 3.75 PEN

function convertPrice(precio, monedaOriginal, monedaDestino) {
    if (!monedaDestino || monedaDestino === 'original') return { precio, moneda: monedaOriginal };

    const origCurrency = (monedaOriginal || 'PEN').toUpperCase();

    if (origCurrency === monedaDestino) return { precio, moneda: monedaOriginal };

    if (monedaDestino === 'USD' && origCurrency === 'PEN') {
        return { precio: Math.round(precio / EXCHANGE_RATE), moneda: 'USD' };
    }
    if (monedaDestino === 'PEN' && origCurrency === 'USD') {
        return { precio: Math.round(precio * EXCHANGE_RATE), moneda: 'PEN' };
    }

    return { precio, moneda: monedaOriginal };
}

// =========================================
// RENDER GRID (Con Wishlist + Moneda)
// =========================================
window.renderPackageGrid = function (paquetes, destinationId = 'paquetes-grid') {

    const grid = document.getElementById(destinationId);

    if (!grid) {
        return;
    }

    grid.innerHTML = '';

    const displayCurrency = window.displayCurrency || 'original';

    paquetes.forEach(pkg => {
        // Imagen segura
        let imgUrl = 'img/carrusel1.jpg';
        if (pkg.imagenes && pkg.imagenes.length > 0) {
            imgUrl = pkg.imagenes[0];
        }

        // Conversión de moneda
        const converted = convertPrice(pkg.precio, pkg.moneda, displayCurrency);
        const monedaSymbol = converted.moneda === 'USD' ? 'US$' : 'S/.';

        // Lista Resumen (con fallback para paquetes antiguos)
        let listaHTML = '';
        let resumen = pkg.resumen_tarjeta;
        if (!resumen && pkg.incluye && typeof pkg.incluye === 'string') {
            resumen = pkg.incluye.split('\n').map(l => l.replace(/^[•\-\*]\s*/, '').trim()).filter(l => l.length > 0);
        }
        if (resumen) {
            resumen.forEach(item => {
                listaHTML += `<li><i class="fas fa-check"></i> ${item}</li>`;
            });
        }

        // Wishlist
        const isFav = window.isInWishlist(pkg.id);

        const card = document.createElement('div');
        card.className = 'paquete-card';
        card.innerHTML = `
            <div class="card-image-container">
                <img src="${imgUrl}" alt="${pkg.titulo}" onerror="this.onerror=null;this.src='img/carrusel1.jpg'">
                ${pkg.is_promo ? '<span class="promo-badge">🔥 OFERTA</span>' : ''}
                <button class="wishlist-btn ${isFav ? 'active' : ''}" data-id="${pkg.id}" aria-label="Agregar a favoritos">
                    <i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>
                </button>
                <div class="card-overlay">
                    <span class="duracion-tag"><i class="far fa-clock"></i> ${pkg.duracion}</span>
                </div>
            </div>
            
            <div class="card-content">
                <div class="card-header">
                    <h3>${pkg.titulo}</h3>
                    <p class="subtitulo">${pkg.subtitulo || pkg.ubicacion}</p>
                </div>
                
                <ul class="card-features">
                    ${listaHTML}
                </ul>

                <div class="card-footer">
                    <div class="precio-box">
                        <small>Desde</small>
                        <strong>${monedaSymbol} ${converted.precio.toLocaleString()}</strong>
                    </div>
                    <button class="btn-detalles">VER DETALLES</button>
                </div>
            </div>
        `;

        // Wishlist click handler
        const wishBtn = card.querySelector('.wishlist-btn');
        wishBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.toggleWishlist(pkg.id, wishBtn);
            const icon = wishBtn.querySelector('i');
            if (wishBtn.classList.contains('active')) {
                icon.className = 'fa-solid fa-heart';
            } else {
                icon.className = 'fa-regular fa-heart';
            }
        });

        card.querySelector('.btn-detalles').onclick = () => {
            if (window.openPackageModal) window.openPackageModal(pkg);
        };

        grid.appendChild(card);
    });
};