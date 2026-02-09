#!/bin/bash

# ====================================
# EkgKala Store - Complete Setup Script
# ====================================

echo "🚀 Starting EkgKala Store Setup..."
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check for required tools
echo ""
echo "📋 Checking Prerequisites..."
echo "----------------------------"

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node -v)
    print_success "Node.js installed: $NODE_VERSION"
else
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check npm
if command_exists npm; then
    NPM_VERSION=$(npm -v)
    print_success "npm installed: $NPM_VERSION"
else
    print_error "npm is not installed."
    exit 1
fi

# Check MongoDB (optional warning)
if command_exists mongod; then
    print_success "MongoDB is installed"
else
    print_warning "MongoDB is not detected. Make sure MongoDB is running on port 27017"
fi

# ====================================
# Backend Setup
# ====================================
echo ""
echo "🔧 Setting up Backend..."
echo "------------------------"

cd ekgkala-backend || exit

# Install dependencies
echo "Installing Backend dependencies..."
npm install

# Check if .env exists, if not copy from .env.example
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        print_success "Created .env file from .env.example"
        print_warning "Please update .env file with your configuration"
    else
        print_error ".env file not found. Please create one based on .env.example"
    fi
else
    print_success ".env file already exists"
fi

# ====================================
# Frontend Setup
# ====================================
echo ""
echo "🎨 Setting up Frontend..."
echo "-------------------------"

cd ../frontend || exit

# Install dependencies
echo "Installing Frontend dependencies..."
npm install

# Check if .env exists
if [ ! -f .env ]; then
    echo "NEXT_PUBLIC_API_URL=http://localhost:5000/api" > .env
    echo "NEXT_PUBLIC_SITE_NAME=EkgKala" >> .env
    print_success "Created Frontend .env file"
else
    print_success "Frontend .env file already exists"
fi

# ====================================
# Admin Panel Setup
# ====================================
echo ""
echo "👨‍💼 Setting up Admin Panel..."
echo "-----------------------------"

cd ../admin || exit

# Install dependencies
echo "Installing Admin Panel dependencies..."
npm install

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "VITE_API_BASE_URL=http://localhost:5000/api" > .env.local
    echo "VITE_SITE_NAME=EkgKala Admin" >> .env.local
    print_success "Created Admin .env.local file"
else
    print_success "Admin .env.local file already exists"
fi

# ====================================
# Final Instructions
# ====================================
echo ""
echo "===================================="
echo "✅ Setup Complete!"
echo "===================================="
echo ""
echo "📝 Next Steps:"
echo "-------------"
echo ""
echo "1. Make sure MongoDB is running:"
echo "   ${YELLOW}sudo systemctl start mongod${NC}"
echo "   or"
echo "   ${YELLOW}mongod${NC}"
echo ""
echo "2. Update Backend configuration:"
echo "   - Edit ${YELLOW}ekgkala-backend/.env${NC} file"
echo "   - Add your MongoDB URI"
echo "   - Add JWT secrets"
echo "   - Configure Cloudinary (optional)"
echo "   - Configure Email settings (optional)"
echo ""
echo "3. Start the applications:"
echo ""
echo "   In separate terminals:"
echo ""
echo "   ${GREEN}Terminal 1 - Backend:${NC}"
echo "   cd ekgkala-backend"
echo "   npm run dev"
echo ""
echo "   ${GREEN}Terminal 2 - Frontend:${NC}"
echo "   cd frontend"
echo "   npm run dev"
echo ""
echo "   ${GREEN}Terminal 3 - Admin Panel:${NC}"
echo "   cd admin"
echo "   npm run dev"
echo ""
echo "4. Access the applications:"
echo "   - Frontend: ${GREEN}http://localhost:3000${NC}"
echo "   - Admin Panel: ${GREEN}http://localhost:3001${NC}"
echo "   - Backend API: ${GREEN}http://localhost:5000/api${NC}"
echo ""
echo "5. Default Admin Credentials:"
echo "   First, create an admin user by:"
echo "   - Register a normal user via Frontend"
echo "   - Update user role to 'admin' in MongoDB:"
echo "   ${YELLOW}db.users.updateOne({email: 'your-email'}, {\$set: {role: 'admin'}})${NC}"
echo ""
echo "===================================="
echo "🎉 Happy Coding!"
echo "===================================="
