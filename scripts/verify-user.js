const UserService = require('../src/services/UserService');

async function main() {
    const result = await UserService.getUserByUsername('nizam_sheikh');
    if (result.success) {
        const u = result.data;
        console.log('✅ User verified in database:');
        console.log('  ID:       ' + u.$id);
        console.log('  Username: ' + u.username);
        console.log('  Name:     ' + u.full_name);
        console.log('  Email:    ' + u.email);
        console.log('  Phone:    ' + u.phone);
        console.log('  Role:     ' + u.role);
        console.log('  Status:   ' + u.status);
        console.log('  Password: ' + (u.password && u.password.length > 0 ? '[hashed]' : '[empty]'));
    } else {
        console.log('❌ User not found: ' + result.error);
    }
}

main().catch(console.error);
