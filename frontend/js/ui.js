// js/ui.js - VERSIÓN FLEXIBLE

// AHORA ACEPTA "destinationId" (Opcional). Si no se lo das, usa 'paquetes-grid' por defecto.
window.renderPackageGrid = function(paquetes, destinationId = 'paquetes-grid') {
    
    const grid = document.getElementById(destinationId);
    
    if (!grid) {
        // Esto evita el error rojo si estamos en una página que no tiene ese grid
        // console.warn(`⚠️ No encontré el contenedor #${destinationId} en esta página.`);
        return; 
    }
    
    grid.innerHTML = '';

    paquetes.forEach(pkg => {
        const moneda = pkg.moneda === 'USD' ? 'US$' : 'S/';
        
        // Imagen segura
        let imgUrl = 'img/hero-bg.jpg';
        if (pkg.imagenes && pkg.imagenes.length > 0) {
            imgUrl = pkg.imagenes[0];
        }

        // Lista Resumen
        let listaHTML = '';
        if (pkg.resumen_tarjeta) {
            pkg.resumen_tarjeta.forEach(item => {
                listaHTML += `<li><i class="fas fa-check"></i> ${item}</li>`;
            });
        }

        const card = document.createElement('div');
        card.className = 'paquete-card';
        card.innerHTML = `
            <div class="card-image-container">
                <img src="${imgUrl}" alt="${pkg.titulo}" onerror="this.src='img/hero-bg.jpg'">
                ${pkg.is_promo ? '<span class="promo-badge">🔥 OFERTA</span>' : ''}
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
                        <strong>${moneda} ${pkg.precio}</strong>
                    </div>
                    <button class="btn-detalles">VER DETALLES</button>
                </div>
            </div>
        `;

        card.querySelector('.btn-detalles').onclick = () => {
            if (window.openPackageModal) window.openPackageModal(pkg);
        };

        grid.appendChild(card);
    });
};