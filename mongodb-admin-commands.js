// MongoDB Commands to Create Admin User
// ======================================
// Run these commands in mongosh

// 1. Switch to the database
use ekgkala-store

// 2. Option A: Update existing user to admin
db.users.updateOne(
  { email: "your-email@example.com" },
  { $set: { role: "admin" } }
)

// 2. Option B: Create new admin user (with pre-hashed password)
// Note: This password hash is for "admin123" - FOR DEVELOPMENT ONLY
db.users.insertOne({
  name: "Admin User",
  email: "admin@example.com",
  password: "$2a$12$YourHashedPasswordHere", // You need to generate this
  role: "admin",
  isEmailVerified: true,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
})

// 3. Verify the user was created/updated
db.users.findOne({ email: "admin@example.com" })

// 4. List all admin users
db.users.find({ role: "admin" }).pretty()

// 5. To remove admin role from a user
db.users.updateOne(
  { email: "user@example.com" },
  { $set: { role: "user" } }
)
