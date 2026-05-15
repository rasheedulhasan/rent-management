/**
 * Script to create a collector user in the Appwrite database.
 * Usage: node scripts/create-collector-user.js
 */
const UserService = require('../src/services/UserService');

async function main() {
    console.log('Creating collector user...');

    const userData = {
        username: 'nizam_sheikh',
        full_name: 'Nizam Shiekh',
        email: 'heikhnizam521@gmail.com',
        phone: '+971 54 521 7923',
        role: 'collector',
        password: 'demo123',
        status: 'active'
    };

    const result = await UserService.createUser(userData);

    if (result.success) {
        console.log('✅ Collector user created successfully!');
        console.log('User ID:', result.data.$id);
        console.log('Username:', result.data.username);
        console.log('Full Name:', result.data.full_name);
        console.log('Email:', result.data.email);
        console.log('Phone:', result.data.phone);
        console.log('Role:', result.data.role);
        console.log('Status:', result.data.status);
    } else {
        console.error('❌ Failed to create user:', result.error);
        process.exit(1);
    }
}

main().catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
});
