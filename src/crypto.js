const { scrypt, randomBytes, timingSafeEqual } = require('crypto');

function hashPassword(password) {
    return new Promise((resolve, reject) => {
        const salt = randomBytes(16).toString('hex');
        scrypt(password, salt, 64, (err, derivedKey) => {
            if (err) reject(err);
            else resolve(`${salt}:${derivedKey.toString('hex')}`);
        });
    });
}

function verifyPassword(password, hash) {
    return new Promise((resolve, reject) => {
        const [salt, key] = hash.split(':');
        scrypt(password, salt, 64, (err, derivedKey) => {
            if (err) reject(err);
            else resolve(timingSafeEqual(Buffer.from(key, 'hex'), derivedKey));
        });
    });
}

module.exports = { hashPassword, verifyPassword };
