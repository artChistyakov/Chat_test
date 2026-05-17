// Підключаємо необхідні модулі
const http = require('http'); // Для створення веб-сервера
const fs = require('fs');     // Для читання файлів
const path = require('path');   // Для роботи зі шляхами до файлів

// Підключаємо наш модуль для роботи з базою даних. 
// Тепер у змінній `db` лежить об'єкт { getMessages, addMessage }.
const db = require('./database'); 

const cookie = require('cookie');

const validAuthTokens = [];

// === Підготовка статичних файлів (HTML, CSS, JS) ===
// Ми читаємо файли в пам'ять ОДИН РАЗ при запуску сервера.
// Це ефективніше, ніж читати їх з диска при кожному запиті.
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
            case '/auth.js': return res.end(authFile); 
            case '/style.css': return res.end(styleFile); // Якщо браузер просить стилі, віддаємо CSS
            case '/register': return res.end(registerFile);  
            case '/login': return res.end(loginFile); 
            default: return guarded(req, res); 
        }
    }

    if (req.method == 'POST') {
        switch(req.url) {
            case '/api/register': return registerUser(req, res);
            case '/api/login': return login(req, res);
            default: return quarded(req, res);
        }
    }
});

function guarded(req, res) {
    const credentionals = getCredentionals(req);

    if(!credentionals) {
        res.writeHead(302, {'Location': '/register'})
    }

    if(req.method === 'GET') {
        switch(req.url) {
            case '/': return res.end(indexHtmlFile);
            case '/index.js': return res.end(scriptFile);
        }
    }

    res.writeHead(404);
    return res.end('Error 404');
}

function getCredentionals(req) {
    const cookies = cookie.parse(req.headers?.cookie || '');
    const token = cookies?.token;
    if(!token || !validAuthTokens.includes(token)) return null;
    const [user_id, login] = token.split('.');
    if(!user_id || !login) return null;
    return {user_id, login};
}


function registerUser(req, res) {
    let data = '';
    req.on('data', function(chunk) {
        data += chunk;
    });
    req.on('end', async function () {
        try {
            const user = JSON.parse(data);
            if(!user.login || !user.password) {
                return res.end('Empty login or passwors');
            }
            if(await db.isUserExist(user.login)) {
                return res.end('User already exist');
            }
            await db.addUser(user);
            return res.end('Registration is successfull');
        }
        catch(e) {
            return res.end('Error: ' + e);
        }
    });
}

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
            res.end(500);
            return res.end('Error: ' + e);
        }
    });
}

// Запускаємо сервер на 3000 порту
server.listen(3000);

// === Налаштування WebSocket (Socket.IO) ===
// Підключаємо клас Server з бібліотеки socket.io
const { Server } = require("socket.io");

// Створюємо екземпляр сокет-сервера, "прив'язуючи" його до нашого HTTP-сервера
const io = new Server(server);

// Головний слухач подій. Цей код спрацьовує щоразу, коли новий користувач відкриває чат
io.on('connection', async (socket) => { // Робимо функцію асинхронною, бо чекаємо на відповідь від БД
    
    // Виводимо в консоль сервера інформацію про нового користувача
    console.log('a user connected. id - ' + socket.id);

    // Встановлюємо нікнейм за замовчуванням (поки що для всіх однаковий)
    let userNickname = 'admin';
    
    // Отримуємо історію повідомлень з бази даних
    let messages = await db.getMessages();

    // Відправляємо всю історію повідомлень ТІЛЬКИ ЦЬОМУ новому користувачу
    // socket.emit - відправка одному, io.emit - відправка всім
    socket.emit('all_messages', messages);

    // Створюємо слухач для події 'new_message', яку нам надсилає клієнт
    socket.on('new_message', (message) => {
        
        // 1. Зберігаємо отримане повідомлення в базу даних (поки що автор завжди user_id=1)
        db.addMessage(message, 1);
        
        // 2. Розсилаємо це повідомлення ВСІМ підключеним користувачам
        io.emit('message', `${userNickname}: ${message}`);
    });
});