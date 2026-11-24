const mongoose = require('mongoose')
const Admin = require('./models/Admin')
require('dotenv').config()

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(async () => {
        console.log('Connected to MongoDB')
        const admins = await Admin.find({})
        console.log('Found admins:', admins.length)
        admins.forEach(admin => {
            const maskedEmail = admin.email ? String(admin.email).replace(/(^.).*(@.*$)/, '$1***$2') : '(none)'
            console.log(`- ID: ${admin._id}, Email: ${maskedEmail}, Role: ${admin.role}, Active: ${admin.isActive}`)
        })
        process.exit(0)
    })
    .catch(err => {
        console.error(err)
        process.exit(1)
    })
