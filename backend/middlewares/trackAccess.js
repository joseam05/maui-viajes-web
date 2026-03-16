// backend/middlewares/trackAccess.js
// Middleware de rastreo de accesos con geolocalización (optimizado)

const axios = require('axios');

// ========== CONFIGURACIÓN DE FILTROS ==========

// User-Agents de bots conocidos (no queremos trackear crawlers)
const BOT_PATTERNS = [
    'bot', 'crawler', 'spider', 'slurp', 'ia_archiver',
    'mediapartners', 'adsbot', 'googlebot', 'bingbot',
    'yandex', 'baidu', 'duckduckbot', 'facebookexternalhit',
    'twitterbot', 'rogerbot', 'linkedinbot', 'embedly',
    'showyoubot', 'outbrain', 'pinterest', 'applebot',
    'semrushbot', 'ahrefsbot', 'mj12bot', 'dotbot',
    'petalbot', 'curl', 'wget', 'python-requests',
    'go-http-client', 'java/', 'libwww', 'httpunit',
    'uptimerobot', 'monit/', 'render', 'health'
];

// Extensiones de archivos estáticos que no queremos registrar
const STATIC_EXTENSIONS = [
    '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg',
    '.ico', '.woff', '.woff2', '.ttf', '.eot', '.map',
    '.webp', '.mp4', '.webm', '.json'
];

// Ventana de deduplicación: 5 minutos (en milisegundos)
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

// Caché de accesos recientes para deduplicar (IP + ruta → timestamp)
const recentAccess = new Map();

// Limpieza periódica del caché (cada 10 minutos)
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of recentAccess) {
        if (now - timestamp > DEDUP_WINDOW_MS) {
            recentAccess.delete(key);
        }
    }
}, 10 * 60 * 1000);

// ========== FUNCIONES AUXILIARES ==========

/**
 * Verifica si el User-Agent corresponde a un bot/crawler
 */
function isBot(userAgent) {
    if (!userAgent) return false;
    const ua = userAgent.toLowerCase();
    return BOT_PATTERNS.some(pattern => ua.includes(pattern));
}

/**
 * Verifica si la ruta es un archivo estático
 */
function isStaticAsset(path) {
    if (!path) return false;
    const lowerPath = path.toLowerCase();
    return STATIC_EXTENSIONS.some(ext => lowerPath.endsWith(ext));
}

/**
 * Verifica si un acceso es duplicado (misma IP + ruta dentro de la ventana)
 */
function isDuplicate(ip, ruta) {
    const key = `${ip}::${ruta}`;
    const lastSeen = recentAccess.get(key);
    const now = Date.now();

    if (lastSeen && (now - lastSeen) < DEDUP_WINDOW_MS) {
        return true; // Duplicado — ya se registró recientemente
    }

    // Registrar este acceso
    recentAccess.set(key, now);
    return false;
}

// ========== MIDDLEWARE PRINCIPAL ==========

/**
 * Middleware que registra cada acceso en Firestore con geolocalización.
 * Optimizado con:
 * - Filtrado de bots/crawlers
 * - Exclusión de archivos estáticos
 * - Deduplicación por IP+ruta con ventana de 5 minutos
 */
function trackAccess(db, admin) {
    return (req, res, next) => {
        // Llamamos next() INMEDIATAMENTE para no bloquear la respuesta
        next();

        // Proceso asíncrono en background
        (async () => {
            try {
                const userAgent = req.headers['user-agent'] || '';
                const ruta = req.originalUrl || req.path;

                // FILTRO 1: Ignorar bots y crawlers
                if (isBot(userAgent)) return;

                // FILTRO 2: Ignorar archivos estáticos
                if (isStaticAsset(ruta)) return;

                // 1. Extraer IP real (Render usa x-forwarded-for)
                const forwarded = req.headers['x-forwarded-for'];
                const ip = forwarded
                    ? forwarded.split(',')[0].trim()
                    : req.socket.remoteAddress || 'desconocida';

                // No rastrear IPs locales en desarrollo
                const isLocal = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);
                if (isLocal) return;

                // FILTRO 3: Deduplicación por IP + ruta (ventana de 5 min)
                if (isDuplicate(ip, ruta)) return;

                // 2. Geolocalización
                let geo = { country: 'Desconocido', city: 'Desconocido', lat: 0, lon: 0 };
                try {
                    const { data } = await axios.get(`http://ip-api.com/json/${ip}`, {
                        timeout: 3000
                    });
                    if (data.status === 'success') {
                        geo = {
                            country: data.country,
                            city: data.city,
                            lat: data.lat,
                            lon: data.lon
                        };
                    }
                } catch (geoErr) {
                    console.warn('⚠️ Geo-API no disponible:', geoErr.message);
                }

                // 3. Persistir en Firestore
                await db.collection('access_logs').add({
                    ip,
                    pais: geo.country,
                    ciudad: geo.city,
                    lat: geo.lat,
                    lon: geo.lon,
                    dispositivo: userAgent,
                    ruta,
                    metodo: req.method,
                    fecha: admin.firestore.FieldValue.serverTimestamp()
                });

            } catch (err) {
                // Error silencioso — nunca bloqueamos al usuario
                console.error('❌ Error en trackAccess:', err.message);
            }
        })();
    };
}

module.exports = trackAccess;
