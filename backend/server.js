// backend/server.js

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
const trackAccess = require('./middlewares/trackAccess');
const requireDev = require('./middlewares/requireDev');

// 1. CONFIGURACIÓN INICIAL
const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// 2. CONEXIÓN FIREBASE (antes de static middleware para habilitar tracking)
// IMPORTANTE: NO subas credenciales (service account) a GitHub.
// Usa variables de entorno.
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

// 3. TRACKING DE ACCESOS (antes de static para interceptar visitas a páginas)
const publicPages = ['/', '/index.html', '/paquetes.html', '/nosotros.html', '/bodas.html', '/cruceros.html', '/contacto.html'];
app.use(publicPages, trackAccess(db, admin));

// 4. Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../frontend')));

// 5. MULTER (Para subir fotos)
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
        const paquetes = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(p => !p.eliminado);
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

        // Parsear "incluye" en arrays para tarjeta y modal
        let incluyeArray = [];
        if (incluye && typeof incluye === 'string') {
            incluyeArray = incluye
                .split('\n')
                .map(line => line.replace(/^[•\-\*]\s*/, '').trim())
                .filter(line => line.length > 0);
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
            resumen_tarjeta: incluyeArray,
            incluye_total: incluyeArray,
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

// Clonar paquete
app.post('/api/clonar-paquete/:id', async (req, res) => {
    try {
        const doc = await db.collection('paquetes').doc(req.params.id).get();
        if (!doc.exists) return res.status(404).json({ success: false, error: 'No encontrado' });
        const data = doc.data();
        delete data.eliminado;
        delete data.fecha_eliminacion;
        const clon = {
            ...data,
            titulo: data.titulo + ' (copia)',
            fecha_creacion: admin.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('paquetes').add(clon);
        console.log("📋 Paquete clonado:", clon.titulo);
        res.json({ success: true, message: 'Paquete clonado' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Generar cotización PDF
app.get('/api/cotizacion/:id', async (req, res) => {
    try {
        const doc = await db.collection('paquetes').doc(req.params.id).get();
        if (!doc.exists) return res.status(404).json({ error: 'No encontrado' });
        const pkg = doc.data();
        const moneda = pkg.moneda === 'USD' ? 'US$' : 'S/.';

        const PDFDocument = require('pdfkit');
        const pdfDoc = new PDFDocument({ size: 'A4', margin: 60 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=cotizacion-${pkg.titulo.replace(/\s+/g, '-')}.pdf`);
        pdfDoc.pipe(res);

        // Header
        pdfDoc.fontSize(28).fillColor('#1e293b').text('MAUI VIAJES', { align: 'center' });
        pdfDoc.fontSize(10).fillColor('#c5a059').text('Tu aventura comienza aquí', { align: 'center' });
        pdfDoc.moveDown(0.5);
        pdfDoc.moveTo(60, pdfDoc.y).lineTo(535, pdfDoc.y).strokeColor('#c5a059').lineWidth(2).stroke();
        pdfDoc.moveDown(1);

        // Title
        pdfDoc.fontSize(11).fillColor('#94a3b8').text('COTIZACIÓN DE VIAJE', { align: 'center' });
        pdfDoc.moveDown(0.5);
        pdfDoc.fontSize(22).fillColor('#1e293b').text(pkg.titulo, { align: 'center' });
        if (pkg.subtitulo) pdfDoc.fontSize(12).fillColor('#64748b').text(pkg.subtitulo, { align: 'center' });
        pdfDoc.moveDown(1.5);

        // Details grid
        const details = [
            ['Duración', pkg.duracion || '-'],
            ['Vigencia', pkg.vigencia || 'Consultar'],
            ['Categoría', pkg.categoria || '-'],
            ['Tipo', pkg.tipo === 'crucero' ? 'Crucero' : 'Paquete Turístico']
        ];
        details.forEach(([label, value]) => {
            pdfDoc.fontSize(10).fillColor('#94a3b8').text(label.toUpperCase(), { continued: true });
            pdfDoc.fillColor('#1e293b').text(`   ${value}`);
            pdfDoc.moveDown(0.3);
        });
        pdfDoc.moveDown(1);

        // Description
        if (pkg.descripcion) {
            pdfDoc.fontSize(13).fillColor('#c5a059').text('Descripción');
            pdfDoc.moveDown(0.3);
            pdfDoc.fontSize(10).fillColor('#334155').text(pkg.descripcion, { lineGap: 4 });
            pdfDoc.moveDown(1);
        }

        // Incluye
        const items = pkg.incluye_total || pkg.resumen_tarjeta || [];
        if (items.length > 0) {
            pdfDoc.fontSize(13).fillColor('#c5a059').text('El paquete incluye');
            pdfDoc.moveDown(0.3);
            items.forEach(item => {
                pdfDoc.fontSize(10).fillColor('#334155').text(`  ✓  ${item}`, { lineGap: 3 });
            });
            pdfDoc.moveDown(1);
        }

        // Price
        pdfDoc.moveTo(60, pdfDoc.y).lineTo(535, pdfDoc.y).strokeColor('#e2e8f0').lineWidth(1).stroke();
        pdfDoc.moveDown(1);
        pdfDoc.fontSize(11).fillColor('#94a3b8').text('PRECIO POR PERSONA', { align: 'right' });
        pdfDoc.fontSize(26).fillColor('#c5a059').text(`${moneda} ${pkg.precio}`, { align: 'right' });
        pdfDoc.moveDown(2);

        // Footer
        pdfDoc.fontSize(8).fillColor('#94a3b8').text(`Generado el ${new Date().toLocaleDateString('es-PE')} — Maui Viajes`, { align: 'center' });
        pdfDoc.fontSize(8).text('Esta cotización es referencial y está sujeta a disponibilidad.', { align: 'center' });

        pdfDoc.end();
    } catch (error) {
        console.error("❌ Error generando PDF:", error);
        res.status(500).json({ error: error.message });
    }
});

// Dashboard métricas
app.get('/api/dashboard-metricas', async (req, res) => {
    try {
        const [paqSnap, solSnap, newsSnap, recSnap] = await Promise.all([
            db.collection('paquetes').get(),
            db.collection('solicitudes').get(),
            db.collection('newsletter_subs').get(),
            db.collection('reclamaciones').get()
        ]);

        // Contar paquetes activos (excluir eliminados)
        const paquetesActivos = paqSnap.docs.filter(d => !d.data().eliminado).length;

        // Solicitudes por estado
        const estados = { nuevo: 0, contactado: 0, negociacion: 0, cerrado: 0 };
        solSnap.docs.forEach(d => {
            const e = d.data().estado || 'nuevo';
            if (estados[e] !== undefined) estados[e]++;
        });

        // Top paquetes consultados
        const paqCount = {};
        solSnap.docs.forEach(d => {
            const p = d.data().paquete_interes;
            if (p) paqCount[p] = (paqCount[p] || 0) + 1;
        });
        const topPaquetes = Object.entries(paqCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

        res.json({
            total_paquetes: paquetesActivos,
            total_solicitudes: solSnap.size,
            total_newsletter: newsSnap.size,
            total_reclamos: recSnap.size,
            estados,
            top_paquetes: topPaquetes.map(([nombre, count]) => ({ nombre, count }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Soft delete (mover a papelera)
app.delete('/api/borrar-paquete/:id', async (req, res) => {
    try {
        await db.collection('paquetes').doc(req.params.id).update({
            eliminado: true,
            fecha_eliminacion: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('🗑️ Paquete movido a papelera:', req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Restaurar desde papelera
app.post('/api/restaurar-paquete/:id', async (req, res) => {
    try {
        await db.collection('paquetes').doc(req.params.id).update({
            eliminado: false,
            fecha_eliminacion: admin.firestore.FieldValue.deleteField ? admin.firestore.FieldValue.delete() : null
        });
        console.log('♻️ Paquete restaurado:', req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Borrar permanentemente
app.delete('/api/borrar-permanente/:id', async (req, res) => {
    try {
        await db.collection('paquetes').doc(req.params.id).delete();
        console.log('❌ Paquete eliminado permanentemente:', req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Papelera: listar eliminados
app.get('/api/papelera', async (req, res) => {
    try {
        const snapshot = await db.collection('paquetes').where('eliminado', '==', true).get();
        const paquetes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(paquetes);
    } catch (error) {
        res.status(500).json({ error: error.message });
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
            estado: 'nuevo',
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
// 📋 LIBRO DE RECLAMACIONES
// ==========================================
app.post('/api/reclamaciones', async (req, res) => {
    console.log("📋 Recibiendo reclamo en /api/reclamaciones ...");
    const { nombre, dni, email, telefono, tipo, detalle, pedido } = req.body;

    try {
        // Generar código de seguimiento
        const codigo = `RCL-${Date.now().toString(36).toUpperCase()}`;

        await db.collection('reclamaciones').add({
            codigo,
            nombre: nombre || '',
            dni: dni || '',
            email: email || '',
            telefono: telefono || '',
            tipo: tipo || 'reclamo',
            detalle: detalle || '',
            pedido: pedido || '',
            estado: 'pendiente',
            fecha: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log("✅ Reclamo registrado con código:", codigo);

        // Enviar notificación por correo
        try {
            const userEmail = process.env.GMAIL_USER;
            const appPassword = process.env.GMAIL_APP_PASSWORD;
            const toEmail = process.env.LEADS_NOTIFY_TO || userEmail;

            if (userEmail && appPassword) {
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: { user: userEmail, pass: appPassword }
                });

                await transporter.sendMail({
                    from: 'Maui Viajes',
                    to: toEmail,
                    subject: `📋 Nuevo Reclamo: ${codigo} - ${nombre}`,
                    text: `Código: ${codigo}\nTipo: ${tipo}\nCliente: ${nombre}\nDNI: ${dni}\nEmail: ${email}\nTeléfono: ${telefono}\nDetalle: ${detalle}\nPedido: ${pedido || 'N/A'}`
                });
                console.log("✅ Alerta de reclamo enviada por correo");
            } else {
                console.log("⚠️ Correo no configurado, reclamo guardado sin envío.");
            }
        } catch (mailErr) {
            console.error("⚠️ Error envío correo reclamo (no crítico):", mailErr.message);
        }

        res.json({ success: true, codigo });

    } catch (error) {
        console.error("❌ Error guardando reclamo:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin: ver reclamaciones
app.get('/api/reclamaciones-admin', async (req, res) => {
    try {
        const snapshot = await db.collection('reclamaciones').orderBy('fecha', 'desc').limit(50).get();
        const lista = snapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, ...data, fecha: data.fecha && data.fecha.toDate ? data.fecha.toDate() : new Date() };
        });
        res.json(lista);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo reclamaciones' });
    }
});

// Admin: borrar reclamo
app.delete('/api/borrar-reclamo/:id', async (req, res) => {
    try {
        await db.collection('reclamaciones').doc(req.params.id).delete();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin: ver suscriptores newsletter
app.get('/api/newsletter-subs', async (req, res) => {
    try {
        const snapshot = await db.collection('newsletter_subs').orderBy('fecha', 'desc').get();
        const lista = snapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, ...data, fecha: data.fecha && data.fecha.toDate ? data.fecha.toDate() : new Date() };
        });
        res.json(lista);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo suscriptores' });
    }
});

// Admin: eliminar suscriptor
app.delete('/api/newsletter-sub/:id', async (req, res) => {
    try {
        await db.collection('newsletter_subs').doc(req.params.id).delete();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// 📬 NEWSLETTER
// ==========================================
app.post('/api/newsletter', async (req, res) => {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
        return res.status(400).json({ success: false, error: 'Email inválido' });
    }

    try {
        // Verificar duplicados
        const existing = await db.collection('newsletter_subs')
            .where('email', '==', email.toLowerCase().trim())
            .get();

        if (!existing.empty) {
            return res.json({ success: false, duplicate: true, message: 'Email ya registrado' });
        }

        // Guardar nuevo suscriptor
        await db.collection('newsletter_subs').add({
            email: email.toLowerCase().trim(),
            fecha: admin.firestore.FieldValue.serverTimestamp(),
            activo: true
        });

        console.log("📬 Nuevo suscriptor newsletter:", email);
        res.json({ success: true, message: 'Suscrito exitosamente' });

    } catch (error) {
        console.error("❌ Error newsletter:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// 👥 BASE DE DATOS DE CLIENTES (AUTO)
// ==========================================
app.get('/api/clientes', async (req, res) => {
    try {
        const snapshot = await db.collection('solicitudes').orderBy('fecha', 'desc').get();
        const solicitudes = snapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, ...data, fecha: data.fecha && data.fecha.toDate ? data.fecha.toDate() : new Date() };
        });

        // Agrupar por celular o email (cliente único)
        const clientesMap = {};
        solicitudes.forEach(s => {
            const key = (s.celular || s.email || s.nombre).toLowerCase().trim();
            if (!clientesMap[key]) {
                clientesMap[key] = {
                    nombre: s.nombre,
                    email: s.email || '',
                    celular: s.celular || '',
                    primera_consulta: s.fecha,
                    ultima_consulta: s.fecha,
                    total_consultas: 0,
                    intereses: []
                };
            }
            clientesMap[key].total_consultas++;
            clientesMap[key].ultima_consulta = s.fecha > clientesMap[key].ultima_consulta ? s.fecha : clientesMap[key].ultima_consulta;
            if (s.paquete_interes && !clientesMap[key].intereses.includes(s.paquete_interes)) {
                clientesMap[key].intereses.push(s.paquete_interes);
            }
        });

        const listaClientes = Object.values(clientesMap).sort((a, b) => new Date(b.ultima_consulta) - new Date(a.ultima_consulta));
        res.json(listaClientes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 📊 KANBAN — CAMBIAR ESTADO DE SOLICITUD
// ==========================================
app.patch('/api/solicitud-estado/:id', async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    const estadosValidos = ['nuevo', 'contactado', 'negociacion', 'cerrado'];

    if (!estadosValidos.includes(estado)) {
        return res.status(400).json({ success: false, error: 'Estado inválido' });
    }

    try {
        await db.collection('solicitudes').doc(id).update({ estado });
        console.log(`📊 Solicitud ${id} → ${estado}`);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// 📡 MONITOREO DE ACCESOS
// ==========================================

// Endpoint protegido: ver logs de acceso (solo dev)
app.get('/api/dev/logs', requireDev(db, admin), async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const snapshot = await db.collection('access_logs')
            .orderBy('fecha', 'desc')
            .limit(limit)
            .get();

        const logs = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                fecha: data.fecha && data.fecha.toDate ? data.fecha.toDate() : null
            };
        });

        res.json({
            success: true,
            total: logs.length,
            logs
        });
    } catch (error) {
        console.error('❌ Error obteniendo logs:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// 🚀 INICIO
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor Corriendo en http://localhost:${PORT}`);
});