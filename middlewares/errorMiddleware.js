const express = require('express');  
       



module.exports = (err, req, res, next) => {
    const statusCode = err.status || 500;
    const message = err.message || 'Internal Server Error';


    console.error('Error:', err);


    if (req.accepts('json')) {
        return res.status(statusCode).json({
            success: false,
            message: message,
            error: err.error || null
        });
    } 

    else {
        return res.status(statusCode).render('error', { message });
    }
};