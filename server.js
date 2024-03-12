/*
if (process.env.NODE_ENV !== 'production'){
    require('dotenv').config()
}
*/
// import { config } from 'dotenv';
import { config as dotenvConfig } from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
    dotenvConfig();
}


import express from 'express';
import bcrypt from 'bcrypt';
import passport from 'passport';                      // Passport is authentication middleware for Node.js
import nodemailer from 'nodemailer';
import flash from 'express-flash';
import session from 'express-session';
import methodOverride from 'method-override';
import shortId from 'shortid';

import config from './config.js'

// create an instance of the express application. express() return express application
// you can use this to define routes, middleware and configure various settings for your application
const app = express()


// set up view engine
// a view engine is responsible for rendering dynamic content and templates on the server before sending them to the client
// EJS(Embedded JavaScript) allows you to embed JS code directly within your HTML templates
app.set('view engine', 'ejs');

// utils
import sendPasswordResetEmail from './utils/emailHelper.js';
import generateUniqueToken from './utils/tokenHelper.js';

// mongodb 
import mongoose from 'mongoose'
import User from './Users.js'

// connect to the database
mongoose.connect("mongodb://localhost/shortURLWithEmailAuthentication")

async function saveUser(namePara, emailPara, passPara){
    console.log("saving user with namePara, emailPara and passPara of " + namePara + " " + emailPara + " " + passPara)
    // creates a new instance of the User model
    const user = new User({schemaType: "User", name: namePara, email: emailPara, password: passPara})

    // save the model to MongoDB database
    // save() method is provided by Mongoose and it's used to persist changes to the database.
    await user.save()
    console.log(user)
}

async function saveLink(fullLink, shortLink, clicksParam, emailParam){
    console.log("searching for smilar results using short url of: " + shortLink)

    // COME BACK TO THIS FUNCTION
    let searchResults = await findFullUrl(shortLink)
    console.log("results found " + searchResults)
    if (searchResults != null){
        console.log("short url already used")
        return;
    }

    // create a User model (we get the model from Users.js)
    const link = new User({schemaType: "Links", fullUrl: fullLink, shortUrl: shortLink, email: emailParam, clicks: clicksParam})

    // save the user model 
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

  // this find function is provided by Mongoose 
    let links = await User.find({ schemaType: "Links", email: emailParam})
    return links
}

async function findFullUrl(shortUrlParam){
  // this find function is provided by Mongoose
  // find out what it does. looks like it find the first model that matches and return it.
    let fullUrl = await User.findOne({schemaType: "Links", shortUrl: shortUrlParam})
    return fullUrl
}
    


//const initializePassport = require('./passport-config')
import initializePassport from './passport-config.js';
initializePassport(
    passport, 
    //emailK => User.findOne({ email: emailK }).exec(),
    findByEmail,
    id => User.findById(id)       // pass in an arrow function that find  a model by id (Mongoose provide the findById function)
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
// passport.initialize function is provided by Passport.js itself. It initializes Passport and prepares it to be used as middleware within an Express application.
// it is different from the initialize function that I have inside passport-config.js. they are two different function with the same name
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))


// OWN EXPLAINATION ABOUT EXPRESS AND ROUTING
// from the pattern, it looks like get and post the function that are a part of express
// and they take a few parameters. We can pass in the route as string, middleware and some function 
// that holds instruction to what actions needs to be done for that route. 

// req: Represents the HTTP request object
// res: Represents the HTTP response object.


app.get('/', checkAuthenticated, async (req, res) =>{
    let links = await findLinksByEmail(req.user.email)
    console.log("sending to index.ejs with user name of " + req.user)
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
    
        const newUser = new User({ schemaType: "User", name: name, email: email, password: hashedPassword, isConfirmed: false });
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
  let short = req.body.shortUrl;
  let full = req.body.fullUrl;
    /*
    if (!checkURLExists(full)){
      let links = await findLinksByEmail(req.user.email)
      res.render('index.ejs', {name: req.user.name, urls: links, message: "URL does not exists"})
    }
    */

  if (short == "") {
    short = await shortId.generate(); // Use shortId here
    short = short.substring(0, 6);
    console.log("short url is " + short);
  }

  await saveLink(req.body.fullUrl, short, 0, req.user.email);
  res.redirect('/');
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


  // this is the port the server will be listening from
app.listen(8800)