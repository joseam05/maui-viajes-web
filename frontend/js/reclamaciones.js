// frontend/js/reclamaciones.js

const formReclamos = document.getElementById('form-reclamaciones');

if (formReclamos) {
    formReclamos.addEventListener('submit', async (e) => {
        e.preventDefault(); // Evita que la página se recargue

        // 1. Capturar datos
        const formData = new FormData(formReclamos);
        const datos = Object.fromEntries(formData.entries());

        // Botón en estado de carga
        const btnSubmit = formReclamos.querySelector('button[type="submit"]');
        const textoOriginal = btnSubmit.innerText;
        btnSubmit.innerText = 'Enviando...';
        btnSubmit.disabled = true;

        try {
            // 2. Enviar al Backend (Asegúrate que el puerto sea el correcto, usualmente 3000 o 5000)
            const response = await fetch('http://localhost:3000/api/reclamaciones', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(datos)
            });

            const result = await response.json();

            if (result.success) {
                // 3. Éxito
                Swal.fire({
                    title: '¡Reclamo Registrado!',
                    text: `Tu código de seguimiento es: ${result.codigo}. Hemos recibido tu solicitud.`,
                    icon: 'success',
                    confirmButtonColor: '#0f172a'
                });
                formReclamos.reset(); // Limpiar formulario
            } else {
                throw new Error(result.error || 'Error desconocido');
            }

        } catch (error) {
            // 4. Error
            console.error(error);
            Swal.fire({
                title: 'Error',
                text: 'Hubo un problema al enviar el reclamo. Por favor intenta nuevamente.',
                icon: 'error',
                confirmButtonColor: '#0f172a'
            });
        } finally {
            // Restaurar botón
            btnSubmit.innerText = textoOriginal;
            btnSubmit.disabled = false;
        }
    });
}