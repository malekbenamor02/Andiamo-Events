const bcrypt = require('bcryptjs');
bcrypt.hash('admin123', 10).then(console.log);