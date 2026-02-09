const axios = require('axios');

async function test() {
    try {
        console.log('Testing POST http://localhost:5000/api/auth/forgot-password');
        const response = await axios.post('http://localhost:5000/api/auth/forgot-password', {
            email: 'test@example.com'
        });
        console.log('Status:', response.status);
        console.log('Data:', response.data);
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', error.response.data);
        }
    }
}

test();
