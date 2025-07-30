const express = require('express');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(bodyParser.json());

app.post('/api/send-email', async (req, res) => {
  const { to, subject, html } = req.body;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer re_ecJhwtbD_F9X8NowF2njj2Kt6miabAN9d',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to,
      subject,
      html,
    }),
  });
  if (response.ok) {
    res.status(200).json({ success: true });
  } else {
    const error = await response.text();
    res.status(500).json({ error: 'Failed to send email', details: error });
  }
});

app.listen(8080, () => console.log('API server running on http://localhost:8080')); 