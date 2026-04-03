require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const http = require('http');
const multer = require('multer');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const CACHE_DIR = process.env.CACHE_DIR || './cache';

if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
});

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const upload = multer({ dest: CACHE_DIR });

// Register a new inventory item
app.post('/register', upload.single('photo'), async (req, res) => {
    const { inventory_name, description } = req.body;
    if (!inventory_name) {
        return res.status(400).send('Bad Request');
    }

    const id = Date.now().toString();
    const photoPath = req.file ? req.file.filename : null;

    await pool.query(
        'INSERT INTO inventory (id, name, description, photo_path) VALUES ($1, $2, $3, $4)',
        [id, inventory_name, description || null, photoPath]
    );

    res.status(201).json({ id, inventory_name, description, photoPath });
});

// List all inventory items
app.get('/inventory', async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM inventory');
    res.status(200).json(rows);
});

// Get a single item
app.get('/inventory/:id', async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM inventory WHERE id = $1', [req.params.id]);
    if (rows.length > 0) {
        res.status(200).json(rows[0]);
    } else {
        res.status(404).send('Not Found');
    }
});

// Update item details
app.put('/inventory/:id', async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM inventory WHERE id = $1', [req.params.id]);
    if (rows.length === 0) {
        return res.status(404).send('Not Found');
    }

    const name = req.body.inventory_name || rows[0].name;
    const description = req.body.description !== undefined ? req.body.description : rows[0].description;

    const result = await pool.query(
        'UPDATE inventory SET name = $1, description = $2 WHERE id = $3 RETURNING *',
        [name, description, req.params.id]
    );

    res.status(200).json(result.rows[0]);
});

// Get item photo
app.get('/inventory/:id/photo', async (req, res) => {
    const { rows } = await pool.query('SELECT photo_path FROM inventory WHERE id = $1', [req.params.id]);
    if (rows.length > 0 && rows[0].photo_path) {
        res.set('Content-Type', 'image/jpeg');
        res.sendFile(path.resolve(CACHE_DIR, rows[0].photo_path));
    } else {
        res.status(404).send('Not Found');
    }
});

// Update item photo
app.put('/inventory/:id/photo', upload.single('photo'), async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM inventory WHERE id = $1', [req.params.id]);
    if (rows.length === 0) {
        return res.status(404).send('Not Found');
    }

    if (req.file) {
        await pool.query(
            'UPDATE inventory SET photo_path = $1 WHERE id = $2',
            [req.file.filename, req.params.id]
        );
    }

    const result = await pool.query('SELECT * FROM inventory WHERE id = $1', [req.params.id]);
    res.status(200).json(result.rows[0]);
});

// Delete item
app.delete('/inventory/:id', async (req, res) => {
    const result = await pool.query('DELETE FROM inventory WHERE id = $1', [req.params.id]);
    if (result.rowCount > 0) {
        res.status(200).send('Deleted');
    } else {
        res.status(404).send('Not Found');
    }
});

// HTML forms
app.get('/RegisterForm.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'RegisterForm.html'));
});

app.get('/SearchForm.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'SearchForm.html'));
});

// Search by ID
app.post('/search', async (req, res) => {
    const { id, has_photo } = req.body;
    const { rows } = await pool.query('SELECT * FROM inventory WHERE id = $1', [id]);

    if (rows.length > 0) {
        let response = { ...rows[0] };
        if (!has_photo || has_photo !== 'on') delete response.photo_path;
        res.status(200).json(response);
    } else {
        res.status(404).send('Not Found');
    }
});

// Catch-all
app.use((req, res) => {
    res.status(405).send('Method Not Allowed');
});

const server = http.createServer(app);
server.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}/`);
});
