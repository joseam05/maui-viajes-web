// backend/middlewares/requireDev.js
// Middleware de autorización — solo permite acceso al rol 'dev'

/**
 * Middleware que verifica que el usuario autenticado sea 'dev'.
 * 
 * Soporta dos mecanismos de autenticación:
 * 
 * 1. Firebase Auth Token (Header: Authorization: Bearer <token>)
 *    - Verifica el token con Firebase Admin SDK
 *    - Busca el rol en Custom Claims o en el documento de Firestore
 * 
 * 2. Credenciales existentes (Header: X-Admin-User + X-Admin-Pass)
 *    - Compatible con el sistema actual de login del admin panel
 *    - Verifica contra la colección 'usuarios' de Firestore
 */
function requireDev(db, admin) {
    return async (req, res, next) => {
        try {
            // === Opción 1: Firebase Auth Token ===
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split('Bearer ')[1];
                try {
                    const decoded = await admin.auth().verifyIdToken(token);

                    // Verificar Custom Claims primero
                    if (decoded.role === 'dev') return next();

                    // Si no hay claim, buscar en Firestore por UID
                    const userDoc = await db.collection('usuarios')
                        .where('uid', '==', decoded.uid)
                        .limit(1)
                        .get();

                    if (!userDoc.empty && userDoc.docs[0].data().rol === 'dev') {
                        return next();
                    }

                    return res.status(403).json({
                        success: false,
                        error: '🔒 Acceso denegado. Se requiere rol: dev'
                    });
                } catch (tokenErr) {
                    return res.status(401).json({
                        success: false,
                        error: 'Token inválido o expirado'
                    });
                }
            }

            // === Opción 2: Sistema actual de login (credenciales en headers) ===
            const usuario = req.headers['x-admin-user'];
            const password = req.headers['x-admin-pass'];

            if (usuario && password) {
                const snapshot = await db.collection('usuarios')
                    .where('usuario', '==', usuario)
                    .limit(1)
                    .get();

                if (!snapshot.empty) {
                    const userData = snapshot.docs[0].data();
                    if (userData.password === password && userData.rol === 'dev') {
                        return next();
                    }
                }

                return res.status(403).json({
                    success: false,
                    error: '🔒 Acceso denegado. Se requiere rol: dev'
                });
            }

            // Sin credenciales
            return res.status(401).json({
                success: false,
                error: 'No se proporcionaron credenciales de autenticación'
            });

        } catch (err) {
            console.error('❌ Error en requireDev:', err.message);
            return res.status(500).json({ success: false, error: 'Error de autenticación' });
        }
    };
}

module.exports = requireDev;
