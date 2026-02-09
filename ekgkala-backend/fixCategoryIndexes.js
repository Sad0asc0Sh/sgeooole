require('dotenv').config()
const mongoose = require('mongoose')
const Category = require('./models/Category')

async function run() {
  try {
    const uri =
      process.env.MONGODB_URI ||
      'mongodb://localhost:27017/ekgkala-store'

    console.log('Connecting to MongoDB...')
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })

    console.log('Connected to DB:', mongoose.connection.name)

    const before = await Category.collection.indexes()
    console.log('Current Category indexes:', before)

    // Drop legacy unique index on `name` if it exists
    try {
      await Category.collection.dropIndex('name_1')
      console.log('Dropped legacy index: name_1')
    } catch (err) {
      console.warn('Could not drop index name_1 (may not exist):', err.message)
    }

    // Sync indexes defined in schema (including { parent: 1, name: 1 } unique)
    await Category.syncIndexes()
    console.log('Category indexes synced with schema')

    const after = await Category.collection.indexes()
    console.log('Updated Category indexes:', after)

    await mongoose.disconnect()
    console.log('Done.')
  } catch (err) {
    console.error('Error while fixing Category indexes:', err)
    process.exit(1)
  }
}

run()

