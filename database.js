const fs = require("fs");

const dbFile = "./chat.db";
const exists = fs.existsSync(dbFile);
const sqlite3 = require('sqlite3').verbose();
const dbWrapper = require("sqlite");
let db;

dbWrapper
    .open({
        filename: dbFile,
        driver: sqlite3.Database
    })

    .then(async dBase => {
        db = dBase;
        try {
            if (!exists) {
                await db.run(
                    `CREATE TABLE USER(
                        USER_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                        login TEXT,
                        password TEXT
                    );`
                );

                await db.run(
                    `INSERT INTO user (login, password) VALUES
                    ('adim', 'admin'),
                    ('Chetam','Kakdela'),
                    ('Nenne','nyne');
                    `
                );


                await db.run(
                    `CREATE TABLE message(
                        msg_id INTEGER PRIMARY KEY AUTOINCREMENT,
                        content TEXT,
                        author INTEGER,
                        FOREIGN KEY(AUTHOR) REFERENCES user(user_id)
                    );`
                )

            } else {
                console.log(await db.all("SELECT * FROM user"));
            }
        } catch (dbError) {
            console.error(dbError);
        }
    });

    module.exports = {
        getMessages: async () => {
            try {
                return await db.all(
                    `SELECT msg_id, content, login, user_id from message
                    JOIN user ON message.author = user.user_id`
                );
            } catch (dbError) {
                console.error(dbError);
            }
        },
        addMessage: async (msg, userId) => {
            await db.run(
                `INSERT INTO message (content, author) VALUES (?, ?)`,
                [msg, userId]
            );
        }

    }