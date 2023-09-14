const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// app.use((req, res) => { // to show html
//   console.log('req')
//   res.setHeader('Content-Type', 'text/html; charset=UTF-8');
//   res.sendFile('./websocket-client.html', { root: __dirname });
// });

const corsOptions = {
  origin: 'http://localhost:4200', // Replace with your Angular app's URL
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));
app.use(session({ secret: 'your-secret-key', resave: false, saveUninitialized: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


// firebase initialization
var admin = require("firebase-admin");

var serviceAccount = require("./credentials/angular-socket-b8c71-firebase-adminsdk-gkohu-0dbcd42592.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://angular-socket-b8c71-default-rtdb.europe-west1.firebasedatabase.app"
});

const db = admin.database();
// firebase initialization



app.listen(PORT, () => {
  console.log(`Listening on ${PORT}`);
});

app.post('/api/login', (req, res) => {
  if (!req.body) return res.sendStatus(400);
  const { username, password } = req.body;
  const ref = db.ref('/users');

  if (username === '' || password === '') {
    res.status(401).json({ success: false, error: 'Username or password is empty.' });
    return;
  }

  ref.once('value')
    .then((snapshot) => {
      const data = snapshot.val();
      if (isUsernameUnique(data, username)) {
        const dataToWrite = {
            password: password,
            id: Date.now(),
        }
        ref.child(username).set(dataToWrite)
          .then(() => {
            res.status(200).json({ success: true, username, password, error: '' });
          })
          .catch((error) => {
            res.status(500).json({ success: false, error: 'Failed to write data to Firebase' });
          });
      } else {
        res.status(401).json({ success: false, error: 'Username already exist.' });

      }
    })
    .catch((error) => {
      console.error('Error reading data:', error);
    });
  // Check username and password against your database or mock users
  // Return a response indicating successful or failed authentication
});

function isUsernameUnique(data, username) {
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      if (key === username) {
        // The username already exists
        return false;
      }
    }
  }
  // The username is unique
  return true;
}



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
