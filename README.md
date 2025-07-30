# Andiamo Nightlife Vibes

A modern nightlife events website with ambassador management system, built with React, Vite, TypeScript, Tailwind CSS, and Supabase.

## 🚀 Features

### Core Website
- **Responsive Design**: Mobile-first approach with beautiful UI
- **Multi-language Support**: English and French
- **Event Management**: Showcase upcoming events

- **Contact System**: Easy communication with visitors

### Ambassador System
- **Self-Registration**: Ambassadors can apply online
- **Admin Approval**: Admins approve/reject applications
- **Email Notifications**: Automated emails for approval/rejection
- **Dashboard**: Ambassadors can manage clients and sales
- **Performance Tracking**: Monitor sales and commissions

### Admin Dashboard
- **Application Management**: Review and approve ambassador applications
- **Performance Analytics**: Track ambassador performance
- **Event Management**: Manage events and assignments
- **Reporting**: Generate reports on sales and top performers

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, Shadcn/ui components
- **Backend**: Express.js, Node.js
- **Database**: Supabase (PostgreSQL)
- **Email**: Gmail SMTP with Nodemailer
- **Routing**: React Router DOM
- **State Management**: React Query

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd andiamo-nightlife-vibes-main
   ```

2. **Install dependencies**
```bash
npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
```

   Fill in your environment variables:
   ```env
   # Supabase Configuration
   VITE_SUPABASE_URL=your_supabase_url_here
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   
   # Gmail SMTP Configuration
   GMAIL_USER=your_gmail@gmail.com
   GMAIL_APP_PASSWORD=your_gmail_app_password_here
   GMAIL_FROM=andiamo@yourdomain.com
   
   # Server Configuration
   PORT=3001
   ```

4. **Set up Gmail App Password**
   - Go to your Google Account settings
   - Enable 2-factor authentication
   - Generate an App Password for "Mail"
   - Use this password in `GMAIL_APP_PASSWORD`

5. **Set up Supabase**
   - Create a new Supabase project
   - Run the migrations: `supabase db push`
   - Update your environment variables with Supabase credentials

## 🚀 Development

### Start Development Server
```bash
# Start both frontend and backend
npm run dev:full

# Or start them separately
npm run dev          # Frontend (Vite)
npm run server       # Backend (Express)
```

### Build for Production
```bash
npm run build
```

## 📊 Database Schema

### Tables
- **ambassadors**: Ambassador profiles and credentials
- **clients**: Client information and ticket sales
- **ambassador_events**: Event assignments for ambassadors
- **ambassador_performance**: Performance tracking and rankings
- **events**: Event information
- **site_content**: Dynamic content management

## 🔐 Security

- **Row Level Security (RLS)**: Database-level security policies
- **Password Hashing**: Secure password storage
- **Email Verification**: Automated email notifications
- **Admin Authentication**: Protected admin routes

## 📧 Email System

The system uses Gmail SMTP for sending:
- **Approval Emails**: When ambassadors are approved
- **Rejection Emails**: When applications are rejected
- **Password Reset**: For forgotten passwords

## 🎯 Ambassador Workflow

1. **Application**: Ambassador applies on `/ambassador`
2. **Admin Review**: Admin reviews in `/admin` dashboard
3. **Approval**: Admin approves and credentials are sent via email
4. **Login**: Ambassador logs in at `/ambassador/auth`
5. **Dashboard**: Ambassador manages clients and sales

## 🚀 Deployment

### Vercel Deployment
1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy with `npm run build`

### Backend Deployment
Deploy the Express server to:
- Vercel (Serverless Functions)
- Railway
- Heroku
- DigitalOcean App Platform

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | ✅ |
| `GMAIL_USER` | Gmail address for sending emails | ✅ |
| `GMAIL_APP_PASSWORD` | Gmail app password | ✅ |
| `GMAIL_FROM` | From email address | ✅ |
| `PORT` | Backend server port | ❌ (default: 3001) |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support, email support@andiamo.com or create an issue in the repository.
