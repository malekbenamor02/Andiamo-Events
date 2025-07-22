import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { from = 'Andiamo Events <fmalekbenamorf@gmail.com>', to, subject, html } = req.body;

  // Configure SMTP transporter for Gmail
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'fmalekbenamorf@gmail.com',
      pass: 'gdwf jvzu olih ktep',
    },
  });

  try {
    await transporter.sendMail({
      from,
      to,
      subject,
      html,
    });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
}