// Debug routing logic
console.log('🔍 Debugging routing logic...\n');

// Simulate the ProtectedAdminRoute logic
const adminSession = localStorage.getItem('adminSession');
console.log('📋 Admin session from localStorage:', adminSession);

if (!adminSession) {
  console.log('❌ No admin session found - should redirect to /admin/login');
} else {
  try {
    const sessionData = JSON.parse(adminSession);
    console.log('✅ Admin session found:', sessionData);
    console.log('✅ Should allow access to admin dashboard');
  } catch (error) {
    console.log('❌ Invalid session data:', error);
  }
}

console.log('\n🌐 Test URLs:');
console.log('• Admin Login: http://localhost:8082/admin/login');
console.log('• Admin Dashboard: http://localhost:8082/admin');
console.log('• Home: http://localhost:8082/');

console.log('\n🔑 Test Credentials:');
console.log('• Email: admin@andiamo.com');
console.log('• Password: admin123');

console.log('\n💡 If you get a 404 after login:');
console.log('1. Check browser console for errors');
console.log('2. Make sure you\'re logged in (check localStorage)');
console.log('3. Try accessing /admin directly'); 