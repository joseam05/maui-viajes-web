✈️ Maui Viajes – Plataforma de Gestión Turística




Plataforma Full Stack desarrollada para digitalizar la gestión de una agencia de viajes real en Perú, centralizando la administración de paquetes turísticos y la captación de leads desde la web pública.

📖 Sobre el Proyecto

Este proyecto surge de una necesidad real: reemplazar procesos manuales por una solución digital segura y escalable.
No se trata solo de una landing page, sino de un sistema completo de gestión con backend propio, control de roles y persistencia en la nube.

El sistema aborda problemas reales de negocio como:

Gestión centralizada de paquetes turísticos desde un panel administrativo.

Optimización de recursos mediante compresión de imágenes antes de subirlas a la nube.

Seguridad operativa, separando responsabilidades entre roles administrativos.

Captación y notificación de leads desde el frontend hacia un backend controlado.

🚀 Funcionalidades Principales
🛡️ Panel Administrativo (CMS)

Gestión de Contenido (CRUD):
Creación, lectura y eliminación de paquetes turísticos y cruceros desde un panel privado.

Compresión de Imágenes (Client-Side):
Implementación en JavaScript puro que reduce imágenes de varios MB a tamaños optimizados antes de ser enviadas al servidor, disminuyendo costos de almacenamiento y ancho de banda.

Control de Roles (RBAC):

Admin: Acceso completo (gestión de contenido y visualización de leads).

Counter: Acceso restringido (creación y visualización, sin permisos de eliminación).

Formularios Dinámicos:
El panel adapta su interfaz y validaciones dependiendo del tipo de producto (paquete o crucero).

🌍 Frontend Público

Catálogo interactivo de paquetes turísticos, con filtrado por categorías.

Carga optimizada de imágenes desde Firebase Storage.

Canales de conversión integrados, incluyendo contacto vía WhatsApp y formularios web.

📨 Backend & Arquitectura

El backend está construido con Node.js y Express, y utiliza Firebase Admin SDK para operar de forma segura sobre los servicios de Firebase.

🔐 Autenticación y Seguridad

El backend no expone credenciales ni claves sensibles en el repositorio.

Las credenciales de Firebase Admin se gestionan exclusivamente mediante variables de entorno.

El archivo .env nunca se versiona y está protegido por .gitignore.

🗄️ Base de Datos

Firebase Firestore se utiliza como base de datos NoSQL para:

Usuarios administrativos

Paquetes turísticos

Leads captados desde el frontend

🖼️ Almacenamiento de Archivos

Firebase Storage se utiliza para almacenar imágenes de los paquetes.

Las imágenes se suben desde el backend usando Firebase Admin.

El frontend solo consume las URLs públicas generadas.

✉️ Sistema de Notificaciones

Integración con Nodemailer para notificar por correo cada nuevo lead registrado.

🛠️ Tecnologías Utilizadas

Frontend: HTML5 semántico, CSS3 (responsive y animaciones), JavaScript (ES6+)

Backend: Node.js, Express.js

Base de Datos: Firebase Firestore

Almacenamiento: Firebase Storage

Herramientas: Git, Nodemailer