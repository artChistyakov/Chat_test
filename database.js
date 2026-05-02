// Підключаємо вбудований модуль Node.js для роботи з файловою системою
const fs = require("fs");

// Вказуємо назву файлу, де буде зберігатися вся наша база даних
const dbFile = "./chat.db";
// Перевіряємо, чи існує цей файл. Це потрібно, щоб зрозуміти, 
// чи це перший запуск програми, чи ні.
const exists = fs.existsSync(dbFile);

// Підключаємо "двигун" бази даних SQLite. .verbose() вмикає детальніші повідомлення про помилки.
const sqlite3 = require('sqlite3').verbose();
// Підключаємо зручну "обгортку" (кермо), яка дозволяє нам використовувати async/await
const dbWrapper = require("sqlite");
// Створюємо порожню змінну, в якій буде зберігатися наше підключення до БД
let db;

// 🚨 ВАЖЛИВА ПРИМІТКА: Ця конструкція з .then() та module.exports зовні може створювати "гонку станів",
// коли server.js намагається використати функції ще до того, як база даних відкрилася.
// Код працює, але в майбутньому краще використовувати `async function init()` як ми робили раніше.

// Починаємо асинхронний процес відкриття (або створення) файлу бази даних
dbWrapper
    .open({
        filename: dbFile,      // Який файл відкривати
        driver: sqlite3.Database // Який "двигун" використовувати
    })
    // .then(...) — цей блок коду виконається ТІЛЬКИ ПІСЛЯ того, як база даних успішно відкриється.
    // dBase — це готовий об'єкт для роботи з базою.
    .then(async dBase => {
        // Записуємо готове підключення в нашу глобальну змінну `db`, щоб воно було доступне всюди
        db = dBase;
        
        // Обгортаємо весь код у try/catch, щоб "зловити" будь-які помилки SQL
        try {
            // Якщо файлу бази даних НЕ існувало (!exists)...
            if (!exists) {
                // ...тоді ми створюємо всю структуру з нуля.
                // await змушує програму чекати, поки команда виконається, і тільки потім іти далі.
                await db.run(
                    // Створюємо таблицю користувачів
                    `CREATE TABLE user(
                        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                        login TEXT,
                        password TEXT
                    );`
                );

                // Наповнюємо таблицю трьома початковими користувачами
                await db.run(
                    `INSERT INTO user (login, password) VALUES
                    ('admin', 'admin'),
                    ('Chetam','Kakdela'),
                    ('Nenne','nyne');
                    `
                );

                // Створюємо таблицю повідомлень зі зв'язком (FOREIGN KEY) до таблиці user
                await db.run(
                    `CREATE TABLE message(
                        msg_id INTEGER PRIMARY KEY AUTOINCREMENT,
                        content TEXT,
                        author INTEGER,
                        FOREIGN KEY(author) REFERENCES user(user_id)
                    );`
                );

            } else {
                // Якщо файл бази даних ВЖЕ існував, просто виводимо список користувачів у консоль,
                // щоб переконатися, що підключення працює.
                console.log("База даних вже існує. Користувачі в ній:");
                console.log(await db.all("SELECT * FROM user"));
            }
        } catch (dbError) {
            // Якщо будь-яка з команд у блоці try видасть помилку, вона "зловиться" тут
            console.error(dbError);
        }
    });

    // Експортуємо об'єкт із функціями, які зможе викликати наш server.js
    module.exports = {
        // Функція для отримання всіх повідомлень з бази
        getMessages: async () => {
            try {
                // Робимо запит, який "склеює" (JOIN) таблиці message та user,
                // щоб отримати не просто ID автора, а його логін.
                return await db.all(
                    `SELECT msg_id, content, login, user_id from message
                    JOIN user ON message.author = user.user_id`
                );
            } catch (dbError) {
                // Якщо щось піде не так, виводимо помилку в консоль
                console.error(dbError);
            }
        },
        // Функція для додавання нового повідомлення в базу
        addMessage: async (msg, userId) => {
            // Використовуємо параметризований запит (?, ?) - це захист від SQL-ін'єкцій.
            // Замість знаків питання база сама безпечно підставить значення з масиву [msg, userId].
            await db.run(
                `INSERT INTO message (content, author) VALUES (?, ?)`,
                [msg, userId]
            );
        }
    }