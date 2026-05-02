const socket = io();
const form = document.getElementById('form');

form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (input.value) {
        socket.emit('new_message', input.value);
        input.value = '';
    }
});

socket.on('message', function(msg) {
    var item = document.createElement('li');
    item.textContent = msg;
    messages.appendChild(item);
    window.scrollTo(0, document.body.scrollHeight);
});

function changeNickname() {
    let nickname = prompt('Choose your nickname');
    if (nickname) {
        socket.emit('set_nickname', nickname)
    }
}

changeNickname();