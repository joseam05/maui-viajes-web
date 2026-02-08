// js/api.js - VERSIÓN OPTIMIZADA (CACHE FIRST)

// 1. IMPORTANTE: Usamos URLs completas (https://...), NO "firebase/app"
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 2. Importamos tus llaves
import { firebaseConfig } from "./firebase-config.js";

// 3. Inicializamos Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Guardamos la DB en window para pruebas (Opcional)
window.db = db;

// CONSTANTES PARA EL CACHÉ
const CACHE_KEY = 'maui_paquetes_data'; // Nombre del archivo en memoria
const CACHE_TIME_KEY = 'maui_last_update'; // Cuándo se guardó

// 4. Definimos la función globalmente
window.fetchPackages = async function() {
    console.log("🚀 Iniciando carga de paquetes...");

    // A. ESTRATEGIA: CACHE FIRST (Primero memoria, luego internet)
    const cachedData = localStorage.getItem(CACHE_KEY);
    
    if (cachedData) {
        console.log("⚡ ¡Boom! Cargando desde caché instantáneo.");
        
        // Lanzamos la actualización en segundo plano (sin await para no frenar la web)
        actualizarCacheEnSilencio();

        // Devolvemos los datos guardados INMEDIATAMENTE
        return JSON.parse(cachedData);
    }

    // B. SI ES LA PRIMERA VEZ (No hay caché), descargamos normal
    console.log("🌐 Primera visita: Descargando de Internet...");
    return await descargarDeFirebase();
};


// --- FUNCIONES AUXILIARES (LOGICA INTERNA) ---

// Función que descarga de verdad de Firebase
async function descargarDeFirebase() {
    try {
        const paquetesCol = collection(db, 'paquetes');
        const snapshot = await getDocs(paquetesCol);
        
        const lista = snapshot.docs.map(doc => {
            // Convertimos la fecha de Firebase a algo legible si es necesario
            const data = doc.data();
            return { id: doc.id, ...data };
        });

        if (lista.length > 0) {
            // GUARDAMOS EN MEMORIA PARA LA PRÓXIMA
            localStorage.setItem(CACHE_KEY, JSON.stringify(lista));
            localStorage.setItem(CACHE_TIME_KEY, Date.now());
            console.log(`💾 ${lista.length} paquetes guardados en memoria.`);
        }

        return lista;

    } catch (error) {
        console.error("❌ Error conectando a Firebase:", error);
        return [];
    }
}

// Función que actualiza los datos "por detrás" sin que el usuario se de cuenta
async function actualizarCacheEnSilencio() {
    // Solo actualizamos si pasó más de 1 minuto desde la última vez (para no gastar lecturas de Firebase)
    const lastUpdate = localStorage.getItem(CACHE_TIME_KEY);
    const ahora = Date.now();

    // 60000 ms = 1 minuto. Puedes subirlo a 5 minutos (300000) si prefieres
    if (lastUpdate && (ahora - lastUpdate) < 60000) { 
        console.log("⏳ Datos frescos. No es necesario molestar a Firebase aún.");
        return;
    }

    console.log("🔄 Buscando actualizaciones en segundo plano...");
    await descargarDeFirebase(); // Esto descargará y sobrescribirá el caché nuevo
}