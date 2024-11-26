// app.use(express.json());
// app.use(session({ secret: 'your-secret-key', resave: false, saveUninitialized: true }));

// app.use((req, res) => { // to show html
//   console.log('req')
//   res.setHeader('Content-Type', 'text/html; charset=UTF-8');
//   res.sendFile('./websocket-client.html', { root: __dirname });
// });

// firebase initialization
// var admin = require("firebase-admin");
// var serviceAccount = require("./credentials/angular-socket-b8c71-firebase-adminsdk-gkohu-0dbcd42592.json");
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
//   databaseURL: "https://angular-socket-b8c71-default-rtdb.europe-west1.firebasedatabase.app"
// });
// const db = admin.database();
// firebase initialization

// webSocket
// const webSocketPort = process.env.PORT;
// const WebSocket = required('ws');
// const wsServer = new WebSocket.Server({port: 8080});
// wsServer.on('connection', onConnect);

// function onConnect(wsClient) {
//   console.log('Новый пользователь');
//   wsClient.send(JSON.stringify("Привет")); // Here I am send string data

//   wsClient.on("message", data => {
//     console.log(' wsClient.on("message"', data);
//     wsServer.clients.forEach(client => {
//       client.send(JSON.stringify(data)); // Here I am send Buffer data
//     });
//   })

//   wsClient.on('close', function() {
//     console.log("Пользователь отключился");
//   });
// }
// webSocket
