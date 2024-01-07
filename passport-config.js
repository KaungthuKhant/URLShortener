//const { authenticate } = require('passport')
//const bcrypt = require('bcrypt')

//import passport from 'passport';
import bcrypt from 'bcrypt';

//const localStrategy = require('passport-local').Strategy
import localStrategy from 'passport-local'

function initialize(passport, getUserByEmail, getUserById){
    const authenticateUser = async (email, password, done) =>{
        const user = await getUserByEmail(email)
        if (user == null){
            return done(null, false, {message: 'No user with that email' })
        }
        try{
            if (await bcrypt.compare(password, user.password)){
                return done(null, user) 
            }
            else{
                return done(null, false, { message: 'Password incorrect'})
            }
        }
        catch (e){
            return done(e)
        }
    }
    passport.use(new localStrategy({ usernameField: 'email'}, authenticateUser))
    passport.serializeUser((user, done) => done(null, user.id))
    passport.deserializeUser(async(id, done) => {
        return done(null, await getUserById(id))
    })
}

export default initialize