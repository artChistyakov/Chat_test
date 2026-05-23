// Підключаємо необхідні модулі
const http = require('http'); // Для створення веб-сервера
const fs = require('fs');     // Для читання файлів
const path = require('path');   // Для роботи зі шляхами до файлів

// Підключаємо наш модуль для роботи з базою даних. 
const db = require('./database'); 

const cookie = require('cookie');

const validAuthTokens = [];

// === Підготовка статичних файлів (HTML, CSS, JS) ===
const pathToIndex = path.join(__dirname, 'static', 'index.html');
const indexHtmlFile = fs.readFileSync(pathToIndex);

const pathToScript = path.join(__dirname, 'static', 'index.js');
const scriptFile = fs.readFileSync(pathToScript);

const pathToStyle = path.join(__dirname, 'static', 'style.css');
const styleFile = fs.readFileSync(pathToStyle);

const pathToAuth = path.join(__dirname, 'static', 'auth.js');
const authFile = fs.readFileSync(pathToAuth);

const pathToRegister = path.join(__dirname, 'static', 'register.html');
const registerFile = fs.readFileSync(pathToRegister);

const pathToLogin = path.join(__dirname, 'static', 'login.html');
const loginFile = fs.readFileSync(pathToLogin);

// Створюємо HTTP сервер, який буде віддавати наші файли
const server = http.createServer((req, res) => {
    if(req.method === 'GET'){
        switch(req.url) {
            case '/auth.js': 
                res.writeHead(200, {'Content-Type': 'text/javascript'});
                return res.end(authFile); 
            case '/style.css': 
                res.writeHead(200, {'Content-Type': 'text/css'});
                return res.end(styleFile); 
            case '/register': 
                res.writeHead(200, {'Content-Type': 'text/html'});
                return res.end(registerFile);  
            case '/login': 
                res.writeHead(200, {'Content-Type': 'text/html'});
                return res.end(loginFile); 
            default: return guarded(req, res); 
        }
    }

    if (req.method == 'POST') {
        switch(req.url) {
            case '/api/register': return registerUser(req, res);
            case '/api/login': return login(req, res);
            default: return guarded(req, res);
        }
    }
});

function guarded(req, res) {
    // ВИПРАВЛЕНО: Передаємо саме рядок кукі з заголовків запиту (а не весь об'єкт req)
    const cookieHeader = req.headers?.cookie || '';
    const credentionals = getCredentionals(cookieHeader);

    if(!credentionals) {
        res.writeHead(302, {'Location': '/register'});
        return res.end();
    }

    if(req.method === 'GET') {
        switch(req.url) {
            case '/': 
                res.writeHead(200, {'Content-Type': 'text/html'});
                return res.end(indexHtmlFile);
            case '/index.js': 
                res.writeHead(200, {'Content-Type': 'text/javascript'});
                return res.end(scriptFile);
        }
    }

    res.writeHead(404);
    return res.end('Error 404');
}

// Функція розшифровки токена (приймає саме рядок кукі)
function getCredentionals(c = '') {
    const cookies = cookie.parse(c);
    const token = cookies?.token;
    if(!token || !validAuthTokens.includes(token)) return null;
    const [user_id, login] = token.split('.');
    if(!user_id || !login) return null;
    return {user_id, login};
}

// Реєстрація користувача
function registerUser(req, res) {
    let data = '';
    req.on('data', function(chunk) {
        data += chunk;
    });
    req.on('end', async function () {
        try {
            const user = JSON.parse(data);
            if(!user.login || !user.password) {
                res.writeHead(400); 
                return res.end('Empty login or password');
            }
            if(await db.isUserExist(user.login)) {
                res.writeHead(400); 
                return res.end('User already exists');
            }
            await db.addUser(user);
            res.writeHead(201); 
            return res.end('Registration is successful');
        }
        catch(e) {
            res.writeHead(500);
            return res.end('Error: ' + e);
        }
    });
}

// Вхід в систему
function login(req, res) {
    let data = '';
    req.on('data', function(chunk) {
        data += chunk;
    });
    req.on('end', async function () {
        try {
            const user = JSON.parse(data);
            const token = await db.getAuthToken(user);
            validAuthTokens.push(token);
            res.writeHead(200);
            res.end(token);
        }
        catch (e) {
            res.writeHead(500);
            return res.end('Error: ' + e);
        }
    });
}

// Запускаємо сервер на порту
server.listen(process.env.PORT || 3000, () => {
    console.log("Сервер успішно запущено!");
});

// === Налаштування WebSocket (Socket.IO) ===
const { Server } = require("socket.io");
const io = new Server(server);

// ВИПРАВЛЕНО: Один чистий не вкладений middleware для авторизації сокета
io.use((socket, next) => {
    const cookieHeader = socket.handshake.auth.cookie || '';
    const credentionals = getCredentionals(cookieHeader);
    
    if(!credentionals) {
        return next(new Error("no auth"));
    }
    
    socket.credentionals = credentionals;
    next(); 
});

// Головний слухач подій сокетів
io.on('connection', async (socket) => { 
    console.log('a user connected. id - ' + socket.id);

    let userNickname = socket.credentionals.login;
    let userId = socket.credentionals.user_id;
    
    let messages = await db.getMessages();
    socket.emit('all_messages', messages);

    socket.on('new_message', (message) => {
        db.addMessage(message, userId);
        io.emit('message', `${userNickname}: ${message}`);
    });
});