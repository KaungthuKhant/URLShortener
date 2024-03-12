//const { authenticate } = require('passport')
//const bcrypt = require('bcrypt')

//import passport from 'passport';
import bcrypt from 'bcrypt';

//const localStrategy = require('passport-local').Strategy
import localStrategy from 'passport-local'

function initialize(passport, getUserByEmail, getUserById){

    // authentication callback function that will be used by Passport.
    const authenticateUser = async (email, password, done) =>{
        const user = await getUserByEmail(email)
        if (user == null){
            return done(null, false, {message: 'No user with that email' })
        }

        // found the user that matches the email so we are going to check if password matches
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
    // passport.use is a method used to configure and set up authentication strategies
    // it sets up a local authentication strategy using the passport-local module (localStrategy)
    // By using passport.use(), you're telling Passport to use the local authentication strategy (LocalStrategy) and to call the authenticateUser function to handle user authentication.
    passport.use(new localStrategy({ usernameField: 'email'}, authenticateUser))

    //serialize user objects into the session. Serialization is the process of converting a user object (or any object) into a format that can be stored in the session.
    passport.serializeUser((user, done) => done(null, user.id))

    //This function is used to deserialize user objects from the session. Deserialization is the process of converting stored data (such as a user ID) back into a user object.
    passport.deserializeUser(async(id, done) => {
        return done(null, await getUserById(id))
    })
}

export default initialize