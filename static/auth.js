// Знаходимо форми реєстрації та входу в HTML за їхніми унікальними ID
const registerForm = document.getElementById('register-form');
const loginForm = document.getElementById('login-form');

// === ЛОГІКА РЕЄСТРАЦІЇ ===
// Використовуємо значок `?.` (Optional Chaining).
// Оскільки цей скрипт підключений і на сторінці реєстрації, і на сторінці входу,
// на сторінці входу змінна registerForm буде null. Значок `?.` захищає код від падіння,
// якщо форми на цій конкретній сторінці просто немає.
registerForm?.addEventListener('submit', (event) => {
    // Зупиняємо стандартну поведінку браузера (перезавантаження сторінки)
    event.preventDefault();
    
    // Дістаємо інпути форми реєстрації за їхніми атрибутами `name`
    const {login, password, passwordRepeat} = registerForm;
    
    // Локальна перевірка на збіг паролів
    if(password.value !== passwordRepeat.value) {
        return alert('Паролі не співпадають');
    }
    
    // Запаковуємо логін і пароль у текстовий JSON-формат
    const user = JSON.stringify({
        login: login.value,
        password: password.value
    });

    // Створюємо AJAX-запит через XMLHttpRequest
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/register');

    // Кажемо серверу, що надсилаємо саме JSON
    xhr.setRequestHeader('Content-Type', 'application/json');

    // Надсилаємо дані
    xhr.send(user);
    
    // Коли сервер відповість
    xhr.onload = () => {
        // Якщо сервер відповів успішно (наприклад, повернув статус 201)
        if (xhr.status === 201) {
            alert(xhr.response); // Показуємо успішне повідомлення
            window.location.assign('/login'); // Автоматично перенаправляємо користувача на сторінку входу
        } else if (xhr.response === 'User already exist') {
            window.location.assign('/login');
        } else {
            alert(xhr.response); // Якщо помилка — просто показуємо її
        }
    }
});

// === ЛОГІКА ВХОДУ (АВТОРИЗАЦІЇ) ===
// Також використовуємо `?.` на випадок, якщо ми зараз на сторінці реєстрації
loginForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    
    const {login, password} = loginForm;
    const user = JSON.stringify({
        login: login.value,
        password: password.value
    });
    
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/login');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(user);
    
    xhr.onload = () => {
        // Якщо сервер підтвердив пароль і повернув токен (статус 200)
        if(xhr.status === 200) {
            const token = xhr.response; // Отримуємо сам токен доступу
            
            // Записуємо токен в cookie браузера. 
            // Тепер браузер буде автоматично прикріплювати його до кожного запиту на наш сервер.
            document.cookie = `token=${token}`;
            
            // Успішно переходимо на головну сторінку чату!
            window.location.assign('/');
        } else {
            // Якщо пароль чи логін неправильні — виводимо помилку з сервера
            return alert(xhr.response);
        }
    };
});