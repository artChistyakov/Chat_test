const http = require('http');
const fs = require('fs');
const path = require('path');

const pathToIndex = path.join(__dirname, 'static', 'index.html');
const indexHtmlFile = fs.readFileSync(pathToIndex);

const pathToScript = path.join(__dirname, 'static', 'index.js');
const scriptFile = fs.readFileSync(pathToScript);

const pathToStyle = path.join(__dirname, 'static', 'style.css');
const styleFile = fs.readFileSync(pathToStyle);

const server = http.createServer((req, res) => {
    switch(req.url) {
        case '/': return res.end(indexHtmlFile);
        case '/index.js': return res.end(scriptFile);
        case '/style.css': return res.end(styleFile);
    }
    res.statusCode = 404;
    return res.end('Error 404');
});

server.listen(3000);