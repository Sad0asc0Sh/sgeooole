const mongoose = require('mongoose')
const Admin = require('./models/Admin')
require('dotenv').config()

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(async () => {
        console.log('Connected to MongoDB')
        const email = 'ekgkala@gmail.com'
        const newPassword = 'admin123456'

        const admin = await Admin.findOne({ email })
        if (!admin) {
            console.log('Admin not found!')
            process.exit(1)
        }

        admin.password = newPassword
        await admin.save()

        console.log(`Password for ${email} reset to: ${newPassword}`)
        process.exit(0)
    })
    .catch(err => {
        console.error(err)
        process.exit(1)
    })
