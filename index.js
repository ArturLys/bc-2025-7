const express = require('express');
const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const http = require('http');
const multer = require('multer');

program
  .requiredOption('-h, --host <host>', 'Host address')
  .requiredOption('-p, --port <port>', 'Port number')
  .requiredOption('-c, --cache <path>', 'Cache path');

program.parse();
const options = program.opts();

if (!fs.existsSync(options.cache)) {
    fs.mkdirSync(options.cache, { recursive: true });
}

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const upload = multer({ dest: options.cache });
let inventory = {};

app.post('/register', upload.single('photo'), (req, res) => {
    const { inventory_name, description } = req.body;
    if (!inventory_name) {
        return res.status(400).send('Bad Request');
    }
    const id = Date.now().toString();
    inventory[id] = {
        id,
        inventory_name,
        description,
        photoPath: req.file ? req.file.filename : null,
    };
    res.status(201).json(inventory[id]);
});

app.get('/inventory', (req, res) => {
    res.status(200).json(Object.values(inventory));
});

app.get('/inventory/:id', (req, res) => {
    const item = inventory[req.params.id];
    if (item) res.status(200).json(item);
    else res.status(404).send('Not Found');
});

app.put('/inventory/:id', (req, res) => {
    const item = inventory[req.params.id];
    if (item) {
        if (req.body.inventory_name) item.inventory_name = req.body.inventory_name;
        if (req.body.description) item.description = req.body.description;
        res.status(200).json(item);
    } else {
        res.status(404).send('Not Found');
    }
});

app.get('/inventory/:id/photo', (req, res) => {
    const item = inventory[req.params.id];
    if (item && item.photoPath) {
        res.set('Content-Type', 'image/jpeg');
        res.sendFile(path.join(process.cwd(), options.cache, item.photoPath));
    } else {
        res.status(404).send('Not Found');
    }
});

app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
    const item = inventory[req.params.id];
    if (item) {
        if (req.file) item.photoPath = req.file.filename;
        res.status(200).json(item);
    } else {
        res.status(404).send('Not Found');
    }
});

app.delete('/inventory/:id', (req, res) => {
    if (inventory[req.params.id]) {
        delete inventory[req.params.id];
        res.status(200).send('Deleted');
    } else {
        res.status(404).send('Not Found');
    }
});

app.get('/RegisterForm.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'RegisterForm.html'));
});

app.get('/SearchForm.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'SearchForm.html'));
});

app.post('/search', (req, res) => {
    const { id, has_photo } = req.body;
    const item = inventory[id];
    if (item) {
        let response = { ...item };
        if (!has_photo || has_photo !== 'on') delete response.photoPath;
        res.status(200).json(response);
    } else {
        res.status(404).send('Not Found');
    }
});

app.use((req, res) => {
    res.status(405).send('Method Not Allowed');
});

const server = http.createServer(app);
server.listen(options.port, options.host, () => {
    console.log(`Server running at http://${options.host}:${options.port}/`);
});
