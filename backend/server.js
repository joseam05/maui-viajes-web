// backend/server.js

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');

// 1. CONFIGURACIÓN INICIAL
const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*'}));
app.use(express.json());

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../')));

// 2. CONEXIÓN FIREBASE
// IMPORTANTE: NO subas credenciales (service account) a GitHub.
// Usa variables de entorno.
// Opciones:
//  A) FIREBASE_SERVICE_ACCOUNT_PATH -> ruta a un JSON (fuera del repo)
//  B) FIREBASE_SERVICE_ACCOUNT_JSON -> contenido JSON en una sola línea
//  C) Producción -> applicationDefault (Cloud Run / etc.)
let credential;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
        const json = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        credential = admin.credential.cert(json);
    } catch (e) {
        console.error('FIREBASE_SERVICE_ACCOUNT_JSON no es un JSON válido.');
        throw e;
    }
} else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    credential = admin.credential.cert(serviceAccount);
} else {
    credential = admin.credential.applicationDefault();
}

admin.initializeApp({
    credential,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "mauiviajes-9e5a1.firebasestorage.app"
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

// 3. MULTER (Para subir fotos)
const upload = multer({ storage: multer.memoryStorage() });

// ==========================================
// 🔐 AUTENTICACIÓN
// ==========================================
app.post('/api/login', async (req, res) => {
    const { usuario, password } = req.body;
    try {
        const snapshot = await db.collection('usuarios').where('usuario', '==', usuario).get();
        if (snapshot.empty) return res.status(401).json({ success: false, message: 'Usuario no encontrado' });

        const userData = snapshot.docs[0].data();
        if (userData.password === password) {
            res.json({ success: true, rol: userData.rol || 'admin', nombre: userData.nombre || usuario });
        } else {
            res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error del servidor' });
    }
});

// ==========================================
// 📦 GESTIÓN DE PAQUETES
// ==========================================

app.get('/api/paquetes-admin', async (req, res) => {
    try {
        const snapshot = await db.collection('paquetes').orderBy('fecha_creacion', 'desc').get();
        const paquetes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(paquetes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/crear-paquete', upload.array('fotos'), async (req, res) => {
    try {
        const { titulo, precio, descripcion, categoria, tipo, is_promo, moneda, duracion, vigencia, intereses, incluye, subtitulo, ubicacion } = req.body;
        
        // Corrección de array de intereses
        let tags = intereses ? (Array.isArray(intereses) ? intereses : [intereses]) : [];
        
        // Si es crucero, forzamos la etiqueta para que los filtros funcionen
        if (tipo === 'crucero') {
            if (!tags.includes('crucero')) tags.push('crucero');
        }

        // Subida de Fotos
        const archivos = req.files;
        let urls = [];
        if (archivos && archivos.length > 0) {
            for (const archivo of archivos) {
                const nombreArchivo = `paquetes/${Date.now()}_${archivo.originalname}`;
                const file = bucket.file(nombreArchivo);
                await file.save(archivo.buffer, { metadata: { contentType: archivo.mimetype }, public: true });
                urls.push(`https://storage.googleapis.com/${bucket.name}/${nombreArchivo}`);
            }
        }

        // Guardar en Firestore
        const nuevoPaquete = {
            titulo, subtitulo, ubicacion,
            precio: parseFloat(precio),
            moneda, duracion, vigencia,
            descripcion, incluye, categoria,
            tipo: tipo || 'paquete',
            intereses: tags,
            is_promo: is_promo === 'true',
            imagenes: urls,
            fecha_creacion: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('paquetes').add(nuevoPaquete);
        console.log("✅ Paquete creado:", titulo);
        res.json({ success: true, message: 'Creado exitosamente' });

    } catch (error) {
        console.error("Error creando paquete:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/borrar-paquete/:id', async (req, res) => {
    try {
        await db.collection('paquetes').doc(req.params.id).delete();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// 📨 CRM Y SOLICITUDES (CORREGIDO)
// ==========================================

// Obtener solicitudes para el panel Admin
app.get('/api/ver-solicitudes', async (req, res) => {
    try {
        const snapshot = await db.collection('solicitudes').orderBy('fecha', 'desc').limit(50).get();
        const lista = snapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, ...data, fecha: data.fecha && data.fecha.toDate ? data.fecha.toDate() : new Date() };
        });
        res.json(lista);
    } catch (error) {
        res.status(500).json({ error: "Error CRM" });
    }
});

// Borrar solicitud
app.delete('/api/borrar-solicitud/:id', async (req, res) => {
    console.log("🗑️ Borrando solicitud ID:", req.params.id);
    try {
        await db.collection('solicitudes').doc(req.params.id).delete();
        res.json({ success: true, message: 'Solicitud eliminada' });
    } catch (error) {
        console.error("❌ Error borrando:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// CORRECCIÓN CRÍTICA: La ruta debe llamarse 'solicitar-info', NO 'enviar-correo'
app.post('/api/solicitar-info', async (req, res) => {
    console.log("📨 Recibiendo solicitud en /api/solicitar-info ...");
    const { nombre, email, celular, mensaje, paquete_interes, pasajeros, fecha_viaje } = req.body;

    // 1. Guardar en Base de Datos (Prioridad)
    try {
        await db.collection('solicitudes').add({
            nombre, email, celular, mensaje, paquete_interes, pasajeros, fecha_viaje,
            fecha: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log("✅ Datos guardados en CRM");
    } catch (dbError) {
        console.error("❌ Error DB:", dbError);
        return res.status(500).json({ success: false, error: "Error al guardar" });
    }

    // 2. Enviar Correo (Opcional, no rompe el flujo si falla)
    try {
        const userEmail = process.env.GMAIL_USER;
        const appPassword = process.env.GMAIL_APP_PASSWORD;
        const toEmail = process.env.LEADS_NOTIFY_TO || userEmail;

        if (!userEmail || !appPassword) {
            console.log("⚠️ Correo no configurado, omitiendo envío (pero guardado en BD).");
        } else {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: userEmail, pass: appPassword }
            });

            const mailOptions = {
                from: 'Maui Viajes',
                to: toEmail,
                subject: `🔥 Lead: ${nombre} - ${paquete_interes}`,
                text: `Cliente: ${nombre}\nCelular: ${celular}\nInterés: ${paquete_interes}\nMensaje: ${mensaje}`
            };

            await transporter.sendMail(mailOptions);
            console.log("✅ Alerta enviada por correo");
        }
    } catch (mailError) {
        console.error("⚠️ Error envío correo (no crítico):", mailError.message);
    }

    res.json({ success: true, message: 'Solicitud enviada correctamente' });
});

// ==========================================
// 🚀 INICIO
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor Corriendo en http://localhost:${PORT}`);
});