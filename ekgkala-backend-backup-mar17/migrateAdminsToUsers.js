require('dotenv').config()
const mongoose = require('mongoose')
const User = require('./models/Admin') // مدل جدید که روی کالکشن `users` است

// اسکیمای ساده برای خواندن از کالکشن قدیمی `admins`
const legacyAdminSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    password: String,
    role: String,
    isActive: Boolean,
    lastLogin: Date,
    avatar: String,
    createdAt: Date,
    updatedAt: Date,
  },
  {
    collection: 'admins',
    timestamps: true,
  },
)

const LegacyAdmin = mongoose.model('LegacyAdmin', legacyAdminSchema)

const MONGO_URI =
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/ekgkala-store'

async function run() {
  try {
    console.log('Connecting to MongoDB...')
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    console.log('MongoDB connected:', mongoose.connection.name)

    const legacyAdmins = await LegacyAdmin.find({})
    console.log(`Found ${legacyAdmins.length} documents in admins collection`)

    for (const admin of legacyAdmins) {
      const existingUser = await User.findOne({ email: admin.email }).select('+password')

      const role = admin.role || existingUser?.role || 'user'

      if (existingUser) {
        // به‌روزرسانی پسورد و نقش از کالکشن قدیمی، بدون اجرای pre-save
        await User.updateOne(
          { email: admin.email },
          {
            $set: {
              password: admin.password, // همانی که قبلاً هش شده
              role,
            },
          },
        )
        console.log(
          `Updated existing user ${admin.email} from admins (role=${role})`,
        )
        continue
      }

      // ایجاد کاربر جدید در کالکشن users بدون اجرای هوک‌های Mongoose
      await User.collection.insertOne({
        name: admin.name,
        email: admin.email,
        password: admin.password, // هش‌شده
        role,
        isActive: admin.isActive !== undefined ? admin.isActive : true,
        lastLogin: admin.lastLogin || null,
        avatar: admin.avatar || null,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
      })

      console.log(`Migrated ${admin.email} -> users (role=${role})`)
    }

    await mongoose.disconnect()
    console.log('Migration complete.')
  } catch (err) {
    console.error('Error migrating admins to users:', err)
    process.exit(1)
  }
}

run()

