document.addEventListener("DOMContentLoaded", function() {
    // Buscar el contenedor donde iría el footer
    const footerContainer = document.getElementById("global-footer");

    if (footerContainer) {
        fetch('footer.html')
            .then(response => {
                if (!response.ok) throw new Error("No se encontró el footer");
                return response.text();
            })
            .then(html => {
                footerContainer.innerHTML = html;
            })
            .catch(error => console.error("Error cargando el footer:", error));
    }
});