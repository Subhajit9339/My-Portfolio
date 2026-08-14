const express = require('express');
const app = express();

const userModel = require("./models/user");
const postModel = require("./models/post");
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');

app.set("view engine", "ejs");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/images/uploads');
    },

    filename: function (req, file, cb) {
        crypto.randomBytes(12, function (err, bytes) {
            const fn = bytes.toString('hex') + path.extname(file.originalname);
            cb(null, fn);
        });
    }
});

const upload = multer({ storage: storage });

// Home
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/test', (req, res) => {
    res.render('test');
});

app.post('/upload', upload.single('image'), (req, res) => {
    console.log(req.file);
    res.send("File uploaded successfully");
});
// Login page
app.get('/login', (req, res) => {
    res.render('login');
});


// Profile
app.get('/profile', isLoggedIn, async (req, res) => {
    let user = await userModel.findOne({ email: req.user.email }).populate('posts');
    res.render('profile', { user });
});


// Create Post
app.post('/post', isLoggedIn, async (req, res) => {
    let user = await userModel.findOne({ email: req.user.email });
    let { content } = req.body;

    let post = await postModel.create({
        user: user._id,
        content: content,
        likes: [] 
    });

    user.posts.push(post._id);
    await user.save();

    res.redirect('/profile');
});


// Like / Unlike toggle
app.get('/like/:id', isLoggedIn, async (req, res) => {
    let post = await postModel.findById(req.params.id);

    if (post.likes.indexOf(req.user.userid) === -1) {
        post.likes.push(req.user.userid);
    } else {
        post.likes.pull(req.user.userid);
    }

    await post.save();
    res.redirect('/profile');
});


// Render the edit page with the post data
app.get('/edit/:id', isLoggedIn, async (req, res) => {
    let post = await postModel.findById(req.params.id);
    res.redirect('edit', { post });
});





// Register
app.post('/register', async (req, res) => {
    let { email, password, username, name, age } = req.body;
    let user = await userModel.findOne({ email });

    if (user) {
        return res.status(500).send("User already registered");
    }

    bcrypt.genSalt(10, function (err, salt) {
        bcrypt.hash(password, salt, async function (err, hash) {
            let user = await userModel.create({
                username,
                email,
                age,
                name,
                password: hash
            });

            let token = jwt.sign(
                { email: email, userid: user._id },
                "shhhh"
            );

            res.cookie("token", token);
            res.redirect('/profile');
        });
    });
});


// Login
app.post('/login', async (req, res) => {
    let { email, password } = req.body;
    let user = await userModel.findOne({ email });

    if (!user) {
        return res.status(500).send("Something went wrong");
    }

    bcrypt.compare(password, user.password, function (err, result) {
        if (result) {
            let token = jwt.sign(
                { email: email, userid: user._id },
                "shhhh"
            );

            res.cookie("token", token);
            res.redirect('/profile');
        } else {
            res.redirect('/login');
        }
    });
});


// Logout
app.get('/logout', (req, res) => {
    res.cookie('token', '');
    res.redirect('/login');
});


// Authentication middleware
function isLoggedIn(req, res, next){
    if(!req.cookies.token){
        return res.redirect("/login");
    }

    try {
        let data = jwt.verify(req.cookies.token, "shhhh");
        req.user = data;
        next();
    } catch(err) {
        res.redirect("/login");
    }
}


app.listen(3000, () => {
    console.log("Server running on port 3000");
});