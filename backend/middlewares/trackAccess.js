// backend/middlewares/trackAccess.js
// Middleware de rastreo de accesos con geolocalización

const axios = require('axios');

/**
 * Middleware que registra cada acceso en Firestore con geolocalización.
 * - Captura la IP real (detrás del proxy de Render vía x-forwarded-for)
 * - Consulta ip-api.com para geolocalización
 * - Persiste en colección 'access_logs'
 * - Si falla, no bloquea la respuesta al usuario
 */
function trackAccess(db, admin) {
    return (req, res, next) => {
        // Llamamos next() INMEDIATAMENTE para no bloquear la respuesta
        next();

        // Proceso asíncrono en background
        (async () => {
            try {
                // 1. Extraer IP real (Render usa x-forwarded-for)
                const forwarded = req.headers['x-forwarded-for'];
                const ip = forwarded
                    ? forwarded.split(',')[0].trim()
                    : req.socket.remoteAddress || 'desconocida';

                // No rastrear IPs locales en desarrollo
                const isLocal = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);

                // 2. Geolocalización
                let geo = { country: 'Desconocido', city: 'Desconocido', lat: 0, lon: 0 };
                if (!isLocal) {
                    try {
                        const { data } = await axios.get(`http://ip-api.com/json/${ip}`, {
                            timeout: 3000 // 3 segundos máximo
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
                        // Si la API de geolocalización falla o llega al límite,
                        // seguimos con datos por defecto
                        console.warn('⚠️ Geo-API no disponible:', geoErr.message);
                    }
                }

                // 3. Persistir en Firestore
                await db.collection('access_logs').add({
                    ip,
                    pais: geo.country,
                    ciudad: geo.city,
                    lat: geo.lat,
                    lon: geo.lon,
                    dispositivo: req.headers['user-agent'] || 'Desconocido',
                    ruta: req.originalUrl || req.path,
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
