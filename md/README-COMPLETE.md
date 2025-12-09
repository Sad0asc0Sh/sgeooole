# 🛍️ Welfvita Store - Modern E-commerce Platform

A full-stack e-commerce platform built with modern technologies including React, Next.js, Node.js, and MongoDB.

## 🌟 Features

- **🛒 Complete E-commerce Solution** - Product management, cart, checkout, and order tracking
- **👨‍💼 Admin Dashboard** - Comprehensive admin panel for store management
- **🔐 Secure Authentication** - JWT-based auth with refresh tokens
- **📱 Responsive Design** - Mobile-first approach with Tailwind CSS
- **🚀 High Performance** - Optimized with caching and lazy loading
- **🔒 Enterprise Security** - Rate limiting, sanitization, and helmet.js

## 🏗️ Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │     │ Admin Panel │     │   Backend   │
│   (React)   │────▶│  (Next.js)  │────▶│  (Express)  │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │   MongoDB   │
                                        └─────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 4.4+
- npm or yarn

### One-Command Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/welfvita-store.git
cd welfvita-store

# Run the setup script
chmod +x setup.sh
./setup.sh

# Install all dependencies
npm install
npm run install:all
```

### Start All Services

```bash
# Start all services concurrently
npm run dev
```

This will start:
- 🔧 Backend API on http://localhost:5000
- 🎨 Frontend on http://localhost:5173
- 👨‍💼 Admin Panel on http://localhost:3000

## 📋 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run setup` | Run initial setup script |
| `npm run install:all` | Install dependencies for all projects |
| `npm run dev` | Start all services in development mode |
| `npm run build` | Build frontend and admin for production |
| `npm run test` | Test all service connections |
| `npm run clean` | Remove all node_modules |

## 🔧 Configuration

### Backend Configuration (Backend/.env)
```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/welfvita-store
JWT_SECRET=your-secret-key
CLIENT_URL=http://localhost:5173,http://localhost:3000
```

### Frontend Configuration (Frontend/.env)
```env
VITE_API_URL=http://localhost:5000
VITE_APP_NAME=Welfvita Store
```

### Admin Configuration (admin/.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_APP_NAME=Welfvita Admin
```

## 👤 Creating Admin User

1. Register a regular user through the frontend
2. Access MongoDB and update user role:

```bash
mongosh
use welfvita-store
db.users.updateOne(
  {email: 'your-email@example.com'},
  {$set: {role: 'admin'}}
)
```

3. Login to admin panel with the updated credentials

## 🛠️ Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **JWT** - Authentication
- **Cloudinary** - Image storage (optional)

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Zustand** - State management
- **React Query** - Server state
- **Tailwind CSS** - Styling
- **Shadcn UI** - Component library

### Admin Panel
- **Next.js 15** - React framework
- **React 19** - Latest React
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling

## 📚 API Documentation

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/admin/login` | Admin login |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/auth/refresh-token` | Refresh token |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | Get all products |
| GET | `/api/products/:id` | Get single product |
| POST | `/api/products` | Create product (Admin) |
| PUT | `/api/products/:id` | Update product (Admin) |
| DELETE | `/api/products/:id` | Delete product (Admin) |

Full API documentation: [View Documentation](./TECHNICAL_DOCS.md)

## 🐛 Troubleshooting

### Common Issues

#### MongoDB Connection Error
```bash
# Start MongoDB service
sudo systemctl start mongod

# Check MongoDB status
sudo systemctl status mongod
```

#### Port Already in Use
```bash
# Find process using port
lsof -i :5000

# Kill process
kill -9 <PID>
```

#### CORS Error
- Check `CLIENT_URL` in Backend `.env`
- Verify proxy settings in frontend configs

## 🧪 Testing

```bash
# Test all connections
npm run test

# Or use the test script directly
./test-connections.sh
```

## 📦 Deployment

### Production Build

```bash
# Build frontend and admin
npm run build

# Start production servers
NODE_ENV=production npm start
```

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

- **Backend Development** - Node.js/Express Team
- **Frontend Development** - React Team
- **Admin Panel** - Next.js Team
- **UI/UX Design** - Design Team

## 📞 Support

- 📧 Email: support@welfvita.com
- 📖 Documentation: [Technical Docs](./TECHNICAL_DOCS.md)
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/welfvita-store/issues)

## 🙏 Acknowledgments

- React Community
- Next.js Team
- MongoDB Team
- All contributors

---

**Made with ❤️ by Welfvita Team**

⭐ Star us on GitHub!
