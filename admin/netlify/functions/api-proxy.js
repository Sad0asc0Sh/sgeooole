const axios = require('axios');

exports.handler = async (event, context) => {
  const API_URL = process.env.VITE_API_BASE_URL;
  const path = event.path.replace('/api-proxy', '');

  console.log(`Proxying request to: ${API_URL}${path}`); // لاگ برای دیباگ

  try {
    // مدیریت امن داده‌های ورودی
    let requestData = null;
    if (event.body) {
      try {
        requestData = JSON.parse(event.body);
      } catch (e) {
        requestData = event.body; // اگر قبلاً پارس شده بود
      }
    }

    const response = await axios({
      method: event.httpMethod,
      url: `${API_URL}${path}`,
      data: requestData,
      headers: {
        "content-type": event.headers["content-type"] || "application/json",
        // هدر Authorization برای توکن‌های ادمین حیاتی است
        "authorization": event.headers["authorization"] || "", 
      },
      timeout: 10000 // ۱۰ ثانیه مهلت پاسخگویی
    });

    return {
      statusCode: response.status,
      body: JSON.stringify(response.data),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
      }
    };
  } catch (error) {
    console.error("Proxy Error Details:", error.message);
    return {
      statusCode: error.response?.status || 500,
      body: JSON.stringify({ 
        message: "خطا در برقراری ارتباط با سرور اصلی",
        details: error.message 
      })
    };
  }
};