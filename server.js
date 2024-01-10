if (process.env.NODE_ENV !== 'production'){
    require('dotenv').config()
}

const express = require('express')
const app = express()
const bcrypt = require('bcrypt')
const passport = require('passport')
const nodemailer = require('nodemailer');
const config = require('./config');
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')
const shortId = require('shortid')

// set up view enginer
app.set('view engine', 'ejs');

// utils
const sendPasswordResetEmail = require('./utils/emailHelper');
const generateUniqueToken = require('./utils/tokenHelper');

// mongodb 
const mongoose = require("mongoose")
const User = require("./Users")

mongoose.connect("mongodb://localhost/shortURLWithEmailAuthentication")

async function saveUser(namePara, emailPara, passPara){
    console.log("saving user")
    const user = new User({schemaType: "User", name: namePara, email: emailPara, password: passPara})
    await user.save()
    console.log(user)
}

async function saveLink(fullLink, shortLink, clicksParam, emailParam){
    console.log("searching for smilar results using short url of: " + shortLink)
    let searchResults = await findFullUrl(shortLink)
    console.log("results found " + searchResults)
    if (searchResults != null){
        console.log("short url already used")
        return;
    }
    const link = new User({schemaType: "Links", fullUrl: fullLink, shortUrl: shortLink, email: emailParam, clicks: clicksParam})
    await link.save()
    console.log(link)
}

async function findByEmail(eml){
    try{
        const user = await User.findOne({email: eml, schemaType: "User"})
        return user
    }
    catch(e){
        return null
    }
}

async function findLinksByEmail(emailParam){
    let links = await User.find({ schemaType: "Links", email: emailParam})
    return links
}

async function findFullUrl(shortUrlParam){
    let fullUrl = await User.findOne({schemaType: "Links", shortUrl: shortUrlParam})
    return fullUrl
}
    


const initializePassport = require('./passport-config')
initializePassport(
    passport, 
    //emailK => User.findOne({ email: emailK }).exec(),
    findByEmail,
    id => User.findById(id)
)
//const users = []

app.set('view-engine', 'ejs')
app.use(express.urlencoded({ extended: false}))
app.use(flash())
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false

}))
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))

app.get('/', checkAuthenticated, async (req, res) =>{
    let links = await findLinksByEmail(req.user.email)
    console.log("sending to index.ejs with user name of " + req.user.name)
    res.render('index.ejs', {name: req.user.name, urls: links, message: ""})
})

app.get('/login', checkNotAuthenticated, (req, res) =>{
    res.render('login.ejs')
})

app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
})) 

app.get('/register', checkNotAuthenticated, (req, res) =>{
    console.log("/register get request")
    res.render('register.ejs', { message: "" })
})

app.post('/register', checkNotAuthenticated, async (req, res) =>{
    try {
        const { name, email, password } = req.body;
    
        // check if email is already used
        console.log("checking to see if the email is already registered")
        const user = await User.findOne({ email: email });
        if (user != null){
          console.log("user exists")
          res.render('register', { message: "Email already used" })
          return;
        }
    
        // Hash the password before saving it to the database
        const hashedPassword = await bcrypt.hash(password, 10);
    
        const newUser = new User({ schemaType: "User", email: email, password: hashedPassword, isConfirmed: false });
        // Save the user to the database
        await newUser.save();

        // for now, we are not gonna use the save user function 
        //saveUser(name, email, hashedPassword)
    
        // Send confirmation email
        sendConfirmationEmail(email);
    
        res.render('confirmation');
      } catch (error) {
        console.error(error);
        res.redirect('/register');
      }
})

app.get('/confirmation', (req, res) => {
    res.render('confirmation');
});

app.get('/confirm/:email', async (req, res) => {
    try {
        console.log("searching with email: " + req.params.email)
        const user = await User.findOne({ schemaType: "User", email: req.params.email });

        if (!user) {
        return res.status(404).send('User not found');
        }

        // Update user's confirmation status
        user.isConfirmed = true;

        // Save the updated user document
        await user.save();

        res.redirect('/login');
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/forgot-password', (req, res) => {
    res.render('forgot-password', { message: 'Confirm your email' });
});
  
app.post('/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
  
      // Find the user by email
      const user = await User.findOne({ schemaType: "User", email: email });
  
      if (!user) {
        return res.status(404).send('User not found');
      }
  
      // Generate a unique reset token (you can use a library like 'crypto' for this)
      const resetToken = generateUniqueToken();
  
      // Save the reset token and its expiration date in the user document
      user.resetToken = resetToken;
      user.resetTokenExpires = Date.now() + 3600000; // Token expires in 1 hour
  
      await user.save();
  
      // Send an email with the reset link
      sendPasswordResetEmail(user.email, resetToken);
  
      //res.redirect('/forgot-password-confirm'); // Redirect to a confirmation page
      res.render('forgot-password', { message: 'Password reset email sent' });
  
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
});
  
  
app.get('/reset-password/:token', async (req, res) => {
    try {
      const token = req.params.token;
  
      // Find the user by the reset token
      const user = await User.findOne({
        resetToken: token,
        resetTokenExpires: { $gt: Date.now() } // Token should be valid
      });
  
      if (!user) {
        return res.status(404).send('Invalid or expired reset token');
      }
  
      res.render('reset-password', { token }); // Render the reset-password.ejs page with the token
  
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
});
  
app.post('/reset-password', async (req, res) => {
    try {
      const { token, password, confirmPassword } = req.body;
  
      // Find the user by the reset token
      const user = await User.findOne({
        resetToken: token,
        resetTokenExpires: { $gt: Date.now() } // Token should be valid
      });
  
      if (!user) {
        return res.status(404).send('Invalid or expired reset token');
      }
  
      // Validate the password and confirmPassword fields
      if (password !== confirmPassword) {
        return res.status(400).send('Passwords do not match');
      }
  
      // Update the user's password and clear the reset token
      user.password = await bcrypt.hash(password, 10); // Use your preferred bcrypt setup
      user.resetToken = undefined;
      user.resetTokenExpires = undefined;
  
      await user.save();
  
      res.redirect('/login'); // Redirect to the login page
  
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
});

app.post('/shortUrls', async (req, res) =>{
    let short = req.body.shortUrl
    let full = req.body.fullUrl
    /*
    if (!checkURLExists(full)){
      let links = await findLinksByEmail(req.user.email)
      res.render('index.ejs', {name: req.user.name, urls: links, message: "URL does not exists"})
    }
    */

    if (short == ""){
        short = await shortId.generate()
        console.log("short url is " + short)
    }
    //http://localhost:8800/8N1qoB8LW
    //short = `http://localhost:${config.server.port}/` + short
    
    await saveLink(req.body.fullUrl, short, 0, req.user.email)
    res.redirect('/')
})

app.get('/:shortUrl', async (req, res) => {
    let result = await findFullUrl(req.params.shortUrl)
    if (result == null) return res.sendStatus(404)

    result.clicks++
    result.save()

    res.redirect(result.fullUrl)

})

/*
app.delete('/logout', (req, res) => {
    req.logOut()
    res.redirect('/login')
})
*/
app.delete('/logout', function(req, res, next) {
    req.logOut(function(err){
        if (err) { return next(err); }
        res.redirect('/login')
    })
})

function checkAuthenticated(req, res, next){
    if (req.isAuthenticated()){
        return next()
    }

    res.redirect('/login')
}

function checkNotAuthenticated(req, res, next){
    if (req.isAuthenticated()){
        return res.redirect('/')
    }
    next()
}

function sendConfirmationEmail(to) {
    const confirmationLink = `http://localhost:${config.server.port}/confirm/${to}`;
  
    const mailOptions = {
      from: config.email.user,
      to,
      subject: 'Confirm your email address',
      text: `Click on the following link to confirm your email address: ${confirmationLink}`,
    };
  
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.error(error);
      }
      console.log('Email sent: ' + info.response);
    });
}

// Nodemailer configuration
const transporter = nodemailer.createTransport({
    service: config.email.service,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });

app.listen(8800)