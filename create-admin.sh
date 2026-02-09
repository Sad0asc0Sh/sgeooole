#!/bin/bash

# ====================================
# Create Admin User Script
# ====================================

echo "🔐 Creating Admin User for EkgKala Store"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if mongosh is installed
if ! command -v mongosh &> /dev/null; then
    echo -e "${RED}❌ mongosh is not installed${NC}"
    echo "Please install MongoDB Shell first"
    exit 1
fi

# Get user input
read -p "Enter email for admin user: " EMAIL
read -s -p "Enter password for admin user: " PASSWORD
echo
read -p "Enter name for admin user: " NAME

# Generate password hash using Node.js
echo ""
echo "Creating admin user..."

# Create a temporary Node.js script
cat > /tmp/create-admin.js << EOF
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'user' },
  avatar: String,
  isEmailVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  addresses: [{ type: mongoose.Schema.Types.Mixed }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

async function createAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ekgkala-store');
    console.log('Connected to MongoDB');

    // Check if user already exists
    const existingUser = await User.findOne({ email: '$EMAIL' });
    if (existingUser) {
      console.log('User already exists. Updating to admin role...');
      existingUser.role = 'admin';
      await existingUser.save();
      console.log('User updated to admin successfully!');
    } else {
      // Hash password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash('$PASSWORD', salt);

      // Create new admin user
      const adminUser = new User({
        name: '$NAME',
        email: '$EMAIL',
        password: hashedPassword,
        role: 'admin',
        isEmailVerified: true,
        isActive: true
      });

      await adminUser.save();
      console.log('Admin user created successfully!');
    }

    // Disconnect
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

createAdmin();
EOF

# Run the script from Backend directory
cd Backend 2>/dev/null || cd origin-main/Backend 2>/dev/null || {
    echo -e "${RED}❌ Cannot find Backend directory${NC}"
    echo "Please run this script from the project root"
    exit 1
}

# Install bcryptjs if not already installed
if [ ! -d "node_modules/bcryptjs" ]; then
    echo "Installing bcryptjs..."
    npm install bcryptjs mongoose --save 2>/dev/null
fi

# Run the Node.js script
node /tmp/create-admin.js

# Check result
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Admin user created successfully!${NC}"
    echo ""
    echo "You can now login to the admin panel with:"
    echo -e "Email: ${YELLOW}$EMAIL${NC}"
    echo -e "Password: ${YELLOW}[your entered password]${NC}"
    echo ""
    echo "Admin Panel URL: http://localhost:3000"
else
    echo -e "${RED}❌ Failed to create admin user${NC}"
fi

# Clean up
rm -f /tmp/create-admin.js

echo "=========================================="
