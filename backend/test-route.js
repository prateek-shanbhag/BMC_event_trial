const express = require('express');
const app = express();

const r1 = express.Router();
r1.get('/team', (req, res) => res.json({ r1: true }));

const r2 = express.Router();
r2.get('/valuation/:round', (req, res) => res.json({ r2: true }));

app.use('/api/participant', r1);
app.use('/api/participant/portfolio', r2);

app.listen(5002, () => console.log('started'));
