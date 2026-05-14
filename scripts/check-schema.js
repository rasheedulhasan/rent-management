const { Client, Databases } = require('node-appwrite');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
const databases = new Databases(client);

async function check() {
    const attrs = await databases.listAttributes(process.env.APPWRITE_DATABASE_ID, 'rent_ledger');
    console.log('=== RENT_LEDGER ATTRIBUTES ===');
    attrs.attributes.forEach(a => console.log(a.key, '| type:', a.type, '| required:', a.required, '| size:', a.size || '-'));
    
    const tenants = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, 'tenants', [], 100);
    console.log('\n=== TENANTS ===');
    tenants.documents.forEach(t => console.log(t.$id, '|', t.full_name, '|', t.email, '|', t.status, '| room:', t.room_id, '| AED', t.monthly_rent));
    
    const rooms = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID, 'rooms', [], 100);
    console.log('\n=== ROOMS ===');
    rooms.documents.forEach(r => console.log(r.$id, '|', r.room_number, '|', r.status, '| AED', r.monthly_rent));
    
    process.exit(0);
}
check().catch(e => { console.error(e); process.exit(1); });
