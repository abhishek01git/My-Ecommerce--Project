const User = require('../models/userSchema');


const userAuth = async (req, res, next) => {
    try {
        console.log('Session:', req.session);
        if (req.session.user) {
            const user = await User.findById(req.session.user);
            if (user && !user.isBlocked) {
                req.user = user; 
                console.log('Authenticated user:', req.user); 
                return next();
            } else {
                console.log('User is blocked or does not exist.');
                return res.redirect('/login');
            }
        } else {
            console.log('User session not found.');
            return res.redirect('/login');
        }
    } catch (error) {
        console.error('Error in userAuth middleware:', error);
        return res.status(500).send('Internal Server Error');
    }
};




// Admin Authentication Middleware
const adminAuth = async (req, res, next) => {
    try {
        
        if (req.session.admin===true) {
            return next();
        } else {
            console.log('Admin user not found.');
            return res.redirect('/admin/login');
        }
    } catch (error) {
        console.error('Error in adminAuth middleware:', error);
        return res.status(500).send('Internal Server Error');
    }
};







module.exports = { userAuth, adminAuth };







