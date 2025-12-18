const axios = require('axios');

exports.handler = async (event, context) => {
  // به جای آدرس مستقیم، از متغیر محیطی استفاده می‌کنیم
  const API_URL = process.env.VITE_API_BASE_URL; 
  
  if (!API_URL) {
    return { statusCode: 500, body: JSON.stringify({ error: "API_URL is not configured in Netlify" }) };
  }

  const path = event.path.replace('/api-proxy', '');

  try {
    const response = await axios({
      method: event.httpMethod,
      url: `${API_URL}${path}`,
      data: event.body ? JSON.parse(event.body) : null,
      headers: {
        ...event.headers,
        host: new URL(API_URL).host,
      },
    });

    return {
      statusCode: response.status,
      body: JSON.stringify(response.data),
      headers: {
        // امنیت CORS: فقط دامنه خودتان را مجاز کنید (به جای *)
        "Access-Control-Allow-Origin": "https://welfvita-admin.netlify.app", 
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }
    };
  } catch (error) {
    return {
      statusCode: error.response?.status || 500,
      body: JSON.stringify(error.response?.data || { error: "Proxy Connection Error" }),
    };
  }
};