const axios = require('axios');

const testApi = async () => {
    try {
        console.log('Fetching featured categories from http://localhost:5000/api/categories?isFeatured=true');
        const response = await axios.get('http://localhost:5000/api/categories?isFeatured=true');

        console.log('Status:', response.status);
        console.log('Count:', response.data.count);
        console.log('Data:', JSON.stringify(response.data.data, null, 2));

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.log('Response data:', error.response.data);
        }
    }
};

testApi();
