const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(bodyParser.json());

// Configure Gmail SMTP transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'fmalekbenamorf@gmail.com',
    pass: 'gdwf jvzu olih ktep',
  },
});

app.post('/api/send-email', async (req, res) => {
  const { to, subject, html } = req.body;
  
  try {
    await transporter.sendMail({
      from: 'Andiamo Events <fmalekbenamorf@gmail.com>',
      to,
      subject,
      html,
    });
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Email sending failed:', error);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
});

app.listen(8080, () => console.log('API server running on http://localhost:8080')); 