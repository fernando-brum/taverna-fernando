const bcrypt = require('bcrypt');

// Other requires and configurations

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    // Fetch the user from the database
    const user = await getUserByUsername(username);

    if (user) {
        // Compare the incoming password with the hashed password
        const match = await bcrypt.compare(password, user.hashedPassword);
        if (match) {
            // Passwords match
            res.status(200).send('Login successful!');
        } else {
            // Invalid password
            res.status(401).send('Invalid username or password.');
        }
    } else {
        res.status(404).send('User not found.');
    }
});