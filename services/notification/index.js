const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

app.post('/events', (req, res) => {
  console.log('Received event', JSON.stringify(req.body));
  // Here you could implement observed lists and notify subscribers
  res.status(200).send({ ok: true });
});

app.listen(4000, () => console.log('Notification service listening on 4000'));
