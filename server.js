// Підключаємо вбудовані та зовнішні модулі Node.js
const http = require('http'); // Модуль для створення HTTP-сервера
const fs = require('fs');     // Модуль для читання файлів з диска
const path = require('path');   // Модуль для безпечної роботи зі шляхами до файлів

// Підключаємо наш файл бази даних (отримуємо функції getMessages, addMessage, addUser тощо)
const db = require('./database'); 

// Підключаємо бібліотеку для парсингу (розбору) кукі-рядків у зручні об'єкти
const cookie = require('cookie');

// Створюємо порожній масив для зберігання активних (валідних) токенів користувачів.
// Це наша тимчасова серверна "база перепусток".
const validAuthTokens = [];

// === Підготовка статичних файлів ===
// Ми читаємо всі HTML, CSS та JS файли в оперативну пам'ять один раз при запуску.
// Це робить роботу сервера швидкою, бо не потрібно знову і знову читати файли з диска.
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

// Створюємо головний HTTP сервер
const server = http.createServer((req, res) => {
    
    // 1. Обробка GET-запитів (коли користувач просить файл або сторінку)
    if(req.method === 'GET'){
        switch(req.url) {
            case '/auth.js': return res.end(authFile); 
            case '/style.css': return res.end(styleFile); 
            case '/register': return res.end(registerFile);  
            case '/login': return res.end(loginFile); 
            // Якщо це будь-яка інша адреса (наприклад "/" чи "/index.js"),
            // відправляємо запит до "охоронця" guarded.
            default: return guarded(req, res); 
        }
    }

    // 2. Обробка POST-запитів (коли користувач надсилає дані, наприклад форму)
    if (req.method == 'POST') {
        switch(req.url) {
            case '/api/register': return registerUser(req, res);
            case '/api/login': return login(req, res);
            // Якщо невідомий POST запит - відправляємо до guarded
            default: return guarded(req, res);
        }
    }
});

// Функція "Охоронець" (guarded)
// Вона захищає приватні файли (index.html та index.js) від неавторизованих користувачів
function guarded(req, res) {
    // Перевіряємо, чи є в кукі дійсний токен авторизації
    const credentionals = getCredentionals(req.headers?.cookie);

    // Якщо користувач не авторизований (getCredentionals повернув null)
    if(!credentionals) {
        // Робимо редирект (код 302) і кажемо браузеру перенаправити людину на сторінку реєстрації
        res.writeHead(302, {'Location': '/register'});
        return res.end(); // Обов'язково завершуємо роботу, щоб код нижче не виконувався
    }

    // Якщо користувач пройшов фейс-контроль, віддаємо йому приватні файли
    if(req.method === 'GET') {
        switch(req.url) {
            case '/': return res.end(indexHtmlFile);
            case '/index.js': return res.end(scriptFile);
        }
    }

    // Якщо ми дійшли сюди — файл не знайдено, відправляємо 404
    res.writeHead(404);
    return res.end('Error 404');
}

// Функція розшифровки та перевірки токена (getCredentionals)
// Очікує на вхід сирий рядок кукі (наприклад, "token=1.admin.abcde123")
function getCredentionals(c = '') {
    // Розбираємо рядок кукі на об'єкт. Якщо кукі порожні, передаємо порожній рядок ''
    const cookies = cookie.parse(c);
    const token = cookies?.token; // Дістаємо значення токена
    
    // Якщо токена немає, АБО його немає в нашому списку дозволених (validAuthTokens)
    if(!token || !validAuthTokens.includes(token)) return null; // Повертаємо null (доступ заборонено)
    
    // Розбиваємо токен по крапках. Перші дві частини — це id та login
    const [user_id, login] = token.split('.');
    
    // Якщо дані пошкоджені
    if(!user_id || !login) return null;
    
    // Якщо все добре, повертаємо об'єкт з даними користувача
    return {user_id, login};
}

// Функція реєстрації нового користувача
function registerUser(req, res) {
    let data = '';
    // Збираємо дані, які прилітають по шматочках від форми реєстрації
    req.on('data', function(chunk) {
        data += chunk;
    });
    // Коли всі дані отримані
    req.on('end', async function () {
        try {
            const user = JSON.parse(data); // Перетворюємо отриманий JSON-текст на об'єкт
            
            // Валідація: логін та пароль не мають бути порожніми
            if(!user.login || !user.password) {
                res.writeHead(400); 
                return res.end('Empty login or password');
            }
            // Перевіряємо за допомогою бази даних, чи вільний логін
            if(await db.isUserExist(user.login)) {
                res.writeHead(400); 
                return res.end('User already exist');
            }
            // Якщо все добре, записуємо нового юзера в БД
            await db.addUser(user);
            res.writeHead(201); // Статус 201 означає "Успішно створено"
            return res.end('Registration is successful');
        }
        catch(e) {
            res.writeHead(500);
            return res.end('Error: ' + e);
        }
    });
}

// Функція авторизації (Входу)
function login(req, res) {
    let data = '';
    // Накопичуємо дані від форми входу
    req.on('data', function(chunk) {
        data += chunk;
    });
    req.on('end', async function () {
        try {
            const user = JSON.parse(data);
            
            // Викликаємо метод БД, який перевіряє пароль і генерує токен
            const token = await db.getAuthToken(user);
            
            // Записуємо згенерований токен у масив активних пропусків
            validAuthTokens.push(token);
            
            // Повертаємо токен користувачу зі статусом 200 (ОК)
            res.writeHead(200);
            res.end(token);
        }
        catch (e) {
            // Якщо логін чи пароль неправильні (база викине помилку)
            res.writeHead(500);
            return res.end('Error: ' + e);
        }
    });
}

// Запускаємо сервер на 3000 порту
server.listen(process.env.PORT || 3000, () => {
    console.log("Сервер запущено!");
});


// === Налаштування сокетів (Socket.IO) ===
const { Server } = require("socket.io");
const io = new Server(server);

// МІДЛВЕР (Middleware) для авторизації сокетів
// Спрацьовує при ПЕРШОМУ підключенні (handshake) браузера до сокет-сервера
io.use((socket, next) => {
    // Дістаємо кукі, які клієнт примусово прикріпив до сокету
    const cookieHeader = socket.handshake.auth.cookie || '';
    
    // Перевіряємо валідність токена
    const credentionals = getCredentionals(cookieHeader);
    
    // Якщо токен невалідний
    if(!credentionals) {
        // Обриваємо підключення сокета з помилкою
        return next(new Error("no auth"));
    }
    
    // Записуємо дані юзера прямо в об'єкт сокета (щоб не розгадувати токен заново при кожному повідомленні)
    socket.credentionals = credentionals;
    next(); // Пропускаємо підключення далі
});

// Головний обробник сокетів (для авторизованих користувачів)
io.on('connection', async (socket) => { 
    console.log('a user connected. id - ' + socket.id);

    // Дістаємо логін та ID користувача, які ми раніше записали в сокет у мідлвері
    let userNickname = socket.credentionals?.login;
    let userId = socket.credentionals?.user_id;
    
    // Отримуємо історію повідомлень з бази
    let messages = await db.getMessages();

    // Відправляємо історію тільки цьому новому юзеру
    socket.emit('all_messages', messages);

    // Слухаємо нові повідомлення
    socket.on('new_message', (message) => {
        // Зберігаємо в базу з РЕАЛЬНИМ ID автора (userId)
        db.addMessage(message, userId);
        
        // Розсилаємо всім повідомлення з реальним ніком автора
        io.emit('message', `${userNickname}: ${message}`);
    });
});