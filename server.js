const express = require('express');
const mysql = require('mysql2'); // <--- PASTIKAN BARIS INI ADA DI PALING ATAS
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const db = mysql.createConnection({
    host: '127.0.0.1',      // Sesuai dengan host di HeidiSQL
    user: 'root',           // Sesuai dengan user di HeidiSQL
    password: '',           // Sesuai dengan password di HeidiSQL (biasanya kosong)
    database:'VCare' // Masukkan nama database yang sedang Anda buka/buat di HeidiSQL
});

db.connect((err) => {
    if (err) {
        console.error('Koneksi ke MySQL gagal:', err);
        return;
    }
    console.log('Berhasil terhubung ke database MySQL (VCare).');
});

// 2. TAMBAHKAN INI: Contoh Endpoint untuk mengambil data dari tabel MySQL
// (Ganti 'nama_tabel_anda' dengan nama tabel yang ada di database VCare)
app.get('/api/data', (req, res) => {
    db.query('SELECT * FROM user', (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// Endpoint untuk memperbarui profil pengguna (termasuk avatar)
app.put('/api/users/:userId', (req, res) => {
    const userId = req.params.userId;
    const { name, email, phone, avatar } = req.body;
    
    const query = 'UPDATE users SET name = ?, email = ?, phone = ?, avatar = ? WHERE id_user = ?';
    db.query(query, [name, email, phone, avatar, userId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Profil berhasil diperbarui' });
    });
});

// 3. TAMBAHKAN INI: Menjalankan server di port 3000
app.listen(3000, () => {
    console.log('Server backend berjalan di http://localhost:3000');
});

// Endpoint untuk Register Akun Baru
app.post('/api/register', (req, res) => {
    const { name, email, password, phone } = req.body;

    if (!email || !password || !name) {
        return res.status(400).json({ error: 'Nama, email, dan password wajib diisi!' });
    }

    const query = 'INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, "user")';
    
    db.query(query, [name, email, password, phone || ''], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Registrasi berhasil!', userId: results.insertId });
    });
});

// Endpoint untuk login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    // 1. Cek dulu apakah email-nya ada di database
    const checkEmailQuery = 'SELECT * FROM users WHERE email = ?';
    db.query(checkEmailQuery, [email], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // Jika hasil pencarian kosong, berarti email belum terdaftar
        if (results.length === 0) {
            return res.status(404).json({ error: 'Email tidak terdaftar!' });
        }

        const user = results[0];

        // 2. Jika email ada, cek apakah passwordnya cocok
        if (user.password !== password) {
            return res.status(401).json({ error: 'Kata sandi salah!' });
        }

        // Jika email dan password benar
        res.json({ message: 'Login berhasil', user: user });
    });
});

// Endpoint untuk mengambil detail user berdasarkan ID
app.get('/api/login-user/:userId', (req, res) => {
    const userId = req.params.userId;
    db.query('SELECT * FROM users WHERE id_user = ?', [userId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'User tidak ditemukan' });
        res.json(results[0]);
    });
});

// 1. Ambil data kendaraan berdasarkan user yang login
app.get('/api/vehicles/:userId', (req, res) => {
    const userId = req.params.userId;
    // Pastikan menggunakan owner_id = ?
    db.query('SELECT * FROM vehicles WHERE owner_id = ?', [userId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 2. Tambah kendaraan baru yang terikat ke user tertentu
app.post('/api/vehicles', (req, res) => {
    const { owner_id, name, plate, year, odometer } = req.body;
    const query = 'INSERT INTO vehicles (owner_id, name, plate, year, odometer) VALUES (?, ?, ?, ?, ?)';
    
    db.query(query, [owner_id, name, plate, year, odometer], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Kendaraan berhasil ditambahkan', vehicleId: results.insertId });
    });
});

// 3. Ambil data servis berdasarkan kendaraan milik user
app.get('/api/services/:userId', (req, res) => {
    const userId = req.params.userId;
    // Mengambil servis yang kendaraan miliknya adalah milik user tersebut
    const query = `
        SELECT s.* FROM services s 
        JOIN vehicles v ON s.vehicle_id = v.id 
        WHERE v.owner_id = ?
    `;
    db.query(query, [userId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 4. Tambah data servis baru
app.post('/api/services', (req, res) => {
    const { vehicle_id, service_type_id, date, odometer, workshop, cost, notes, status } = req.body;
    const query = `INSERT INTO services (vehicle_id, service_type_id, date, odometer, workshop, cost, notes, status) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.query(query, [vehicle_id, service_type_id, date, odometer, workshop, cost, notes, status], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Servis berhasil dicatat', serviceId: results.insertId });
    });
});

// Endpoint untuk mengambil semua data (khusus Admin)
app.get('/api/admin/all-data', (req, res) => {
    db.query('SELECT * FROM users', (err, users) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.query('SELECT * FROM vehicles', (err, vehicles) => {
            if (err) return res.status(500).json({ error: err.message });
            
            db.query('SELECT * FROM services', (err, services) => {
                if (err) return res.status(500).json({ error: err.message });
                
                res.json({ users, vehicles, services });
            });
        });
    });
});

// Endpoint untuk memperbarui profil pengguna (termasuk avatar)
app.put('/api/users/:userId', (req, res) => {
    const userId = req.params.userId;
    const { name, email, phone, avatar } = req.body;
    
    const query = 'UPDATE users SET name = ?, email = ?, phone = ?, avatar = ? WHERE id_user = ?';
    db.query(query, [name, email, phone, avatar, userId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Profil berhasil diperbarui' });
    });
});


