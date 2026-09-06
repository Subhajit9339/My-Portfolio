const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/miniproject';

mongoose.connect(MONGODB_URI)
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => console.error("MongoDB Connection Error:", err));

const userSchema = mongoose.Schema({
    username: String,
    name: String,
    age: Number,
    email: String,
    password: String,
    posts: [
        {
            type: mongoose.Schema.Types.ObjectId, 
            ref: "post"
        }
    ]
});

module.exports = mongoose.model('user', userSchema);