const User = require('../models/userSchema');

const checkUserBlocked = async (req, res, next) => {
    try {
       
        const publicRoutes = ['/login', '/signup', '/auth/google', '/auth/google/callback'];

        if (publicRoutes.includes(req.path)) {
            return next(); 
        }

     
        if (!req.session.user) {
            return next();
        }

        
        const user = await User.findById(req.session.user);

       
        if (user && user.isBlocked) {
            req.session.destroy(); 
            return res.redirect('/login');
        }

        next(); 
    } catch (error) {
        console.error('Error in checkUserBlocked middleware:', error);
        res.status(500).send('Internal Server Error'); 
    }
};

module.exports = checkUserBlocked;
