const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const corsOptions = {
  origin: 'http://localhost:4200', // Replace with your Angular app's URL
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));

app.use(session({ secret: 'your-secret-key', resave: false, saveUninitialized: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=UTF-8');
  res.sendFile('./websocket-client.html', { root: __dirname });
});

app.listen(PORT, () => {
  console.log(`Listening on ${PORT }`);
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  console.log('req.body', req.body)
  res.json({ success: true });
  // if (username !== '' && password !== '') {
  //   res.json({ success: true });
  // }
  // else {
  //   res.status(401).json({ success: false, message: 'Authentication failed' });
  // }
  // Check username and password against your database or mock users
  // Return a response indicating successful or failed authentication
});



// webSocket
const WebSocket = require('ws');
const wsServer = new WebSocket.Server({port: 9000});
wsServer.on('connection', onConnect);

function onConnect(wsClient) {
  console.log('Новый пользователь');
  wsClient.send(JSON.stringify("Привет")); // Here I am send string data

  wsClient.on("message", data => {
    console.log(' wsClient.on("message"', data);
    wsServer.clients.forEach(client => {
      client.send(JSON.stringify(data)); // Here I am send Buffer data
    });
  })

  wsClient.on('close', function() {
    console.log("Пользователь отключился");
  });
}
// webSocket
