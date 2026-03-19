const mongoose = require('mongoose')
require('dotenv').config()

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(async () => {
        console.log('Connected to MongoDB')
        const db = mongoose.connection.db
        const collection = db.collection('carts')

        const indexes = await collection.indexes()
        console.log('Current Indexes:', indexes)

        const userIndex = indexes.find(idx => idx.key.user === 1 && idx.unique === true)

        if (userIndex) {
            console.log(`Found blocking unique index: ${userIndex.name}`)
            await collection.dropIndex(userIndex.name)
            console.log('Dropped blocking index.')
        } else {
            console.log('No blocking unique index found on user field.')
        }

        // Create the correct partial index if needed
        // await collection.createIndex({ user: 1 }, { unique: true, partialFilterExpression: { status: 'active' }, name: 'user_active_cart' })
        // console.log('Created partial unique index for active carts.')

        console.log('Done.')
        process.exit(0)
    })
    .catch(err => {
        console.error('Error:', err)
        process.exit(1)
    })
