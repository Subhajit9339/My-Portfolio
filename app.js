const express = require('express');
const app = express();
const path = require('path');

const userModel = require("./models/user");
const postModel = require("./models/post");
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// 1. View engine & Static files configuration
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

// 2. Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 3. Routes (MUST BE DEFINED BEFORE EXPORT)

// Home
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/test', (req, res) => {
    res.render('test');
});

// Login page
app.get('/login', (req, res) => {
    res.render('login');
});

// Profile
app.get('/profile', isLoggedIn, async (req, res) => {
    try {
        let user = await userModel.findOne({ email: req.user.email }).populate('posts');
        res.render('profile', { user });
    } catch (err) {
        console.error(err);
        res.status(500).send("Something went wrong");
    }
});

// Create Post
app.post('/post', isLoggedIn, async (req, res) => {
    try {
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
    } catch (err) {
        console.error(err);
        res.status(500).send("Something went wrong");
    }
});

// Like / Unlike toggle
app.get('/like/:id', isLoggedIn, async (req, res) => {
    try {
        let post = await postModel.findById(req.params.id);
        if (!post) return res.status(404).send("Post not found");

        if (post.likes.indexOf(req.user.userid) === -1) {
            post.likes.push(req.user.userid);
        } else {
            post.likes.pull(req.user.userid);
        }

        await post.save();
        res.redirect('/profile');
    } catch (err) {
        console.error(err);
        res.status(500).send("Something went wrong");
    }
});

// Render edit page
app.get('/edit/:id', isLoggedIn, async (req, res) => {
    try {
        let post = await postModel.findById(req.params.id);
        if (!post) return res.status(404).send("Post not found");

        if (post.user.toString() !== req.user.userid) {
            return res.status(403).send("Not authorized");
        }

        res.render('edit', { post });
    } catch (err) {
        console.error(err);
        res.status(500).send("Something went wrong");
    }
});

// Handle edit submission
app.post('/update/:id', isLoggedIn, async (req, res) => {
    try {
        let post = await postModel.findById(req.params.id);
        if (!post) return res.status(404).send("Post not found");

        if (post.user.toString() !== req.user.userid) {
            return res.status(403).send("Not authorized");
        }

        post.content = req.body.content;
        await post.save();

        res.redirect('/profile');
    } catch (err) {
        console.error(err);
        res.status(500).send("Something went wrong");
    }
});

// Delete a post
app.get('/delete/:id', isLoggedIn, async (req, res) => {
    try {
        let post = await postModel.findById(req.params.id);
        if (!post) return res.status(404).send("Post not found");

        if (post.user.toString() !== req.user.userid) {
            return res.status(403).send("Not authorized");
        }

        await postModel.findByIdAndDelete(req.params.id);

        await userModel.findByIdAndUpdate(req.user.userid, {
            $pull: { posts: post._id }
        });

        res.redirect('/profile');
    } catch (err) {
        console.error(err);
        res.status(500).send("Something went wrong");
    }
});

// Register
app.post('/register', async (req, res) => {
    try {
        let { email, password, username, name, age } = req.body;
        let existingUser = await userModel.findOne({ email });

        if (existingUser) {
            return res.status(500).send("User already registered");
        }

        bcrypt.genSalt(10, function (err, salt) {
            if (err) return res.status(500).send("Something went wrong");

            bcrypt.hash(password, salt, async function (err, hash) {
                if (err) return res.status(500).send("Something went wrong");

                try {
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
                } catch (err) {
                    console.error(err);
                    res.status(500).send("Something went wrong");
                }
            });
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Something went wrong");
    }
});

// Login
app.post('/login', async (req, res) => {
    try {
        let { email, password } = req.body;
        let user = await userModel.findOne({ email });

        if (!user) {
            return res.status(500).send("Something went wrong");
        }

        bcrypt.compare(password, user.password, function (err, result) {
            if (err) return res.status(500).send("Something went wrong");

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
    } catch (err) {
        console.error(err);
        res.status(500).send("Something went wrong");
    }
});

// Logout
app.get('/logout', (req, res) => {
    res.cookie('token', '');
    res.redirect('/login');
});

// Authentication middleware
function isLoggedIn(req, res, next) {
    if (!req.cookies.token) {
        return res.redirect("/login");
    }

    try {
        let data = jwt.verify(req.cookies.token, "shhhh");
        req.user = data;
        next();
    } catch (err) {
        res.redirect("/login");
    }
}

// 4. Start local listener AND export for Vercel
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;