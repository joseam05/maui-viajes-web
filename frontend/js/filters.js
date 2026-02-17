// js/filters.js - VERSIÓN INTELIGENTE MULTI-CAMPO 🧠

window.applyFilters = function (data, primaryFilter, activeInterests = []) {
    if (!data || !Array.isArray(data)) return [];

    let filtered = data;

    // 1. FILTRO PRINCIPAL (Botones Superiores: Tabs o Píldoras)
    if (primaryFilter && primaryFilter !== 'todos') {
        const filtro = primaryFilter.toLowerCase(); // ej: 'caribe', 'nacional'

        filtered = filtered.filter(p => {
            // Buscamos coincidencia en VARIOS campos a la vez para máxima flexibilidad:

            // A. Categoría exacta (ej: 'nacional')
            const categoriaMatch = p.categoria && p.categoria.toLowerCase() === filtro;

            // B. Etiquetas/Tags (ej: si tiene tag 'caribe' o 'disney')
            const etiquetas = p.intereses || p.tags || [];
            const tagMatch = etiquetas.some(t => t.toLowerCase() === filtro);

            // C. Ubicación (ej: si la ubicación dice 'Europa')
            const ubicacionMatch = p.ubicacion && p.ubicacion.toLowerCase().includes(filtro);

            // D. Título (ej: si el título dice 'Crucero Disney')
            const tituloMatch = p.titulo && p.titulo.toLowerCase().includes(filtro);

            // E. Promo (si el botón es 'promociones')
            const isPromo = (filtro === 'promociones' || filtro === 'ofertas') && p.is_promo;

            // Si cumple CUALQUIERA de estas, pasa el filtro
            return categoriaMatch || tagMatch || ubicacionMatch || tituloMatch || isPromo;
        });
    }

    // 2. FILTRO SECUNDARIO (Intereses / Checkboxes)
    if (activeInterests.length > 0) {
        filtered = filtered.filter(p => {
            // Buscamos en los TAGS oficiales (lo más preciso)
            const etiquetas = p.intereses || p.tags || [];
            const tieneTag = etiquetas.length > 0 && activeInterests.some(interes => etiquetas.includes(interes.toLowerCase()));

            // Buscamos en el TEXTO (respaldo por si no se etiquetó bien)
            const textoPaquete = `
                ${p.titulo} 
                ${p.descripcion} 
                ${p.ubicacion} 
                ${p.categoria}
            `.toLowerCase();

            const tieneTexto = activeInterests.some(interes => textoPaquete.includes(interes.toLowerCase()));

            return tieneTag || tieneTexto;
        });
    }

    return filtered;
};