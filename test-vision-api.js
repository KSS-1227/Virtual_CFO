// Test the vision API endpoint
const testVisionAPI = async () => {
  try {
    // Test with a simple base64 image (1x1 pixel PNG)
    const testImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    
    const response = await fetch('http://localhost:5001/api/vision/analyze-document', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageData: testImageData,
        fileName: 'test.png'
      })
    });
    
    const result = await response.json();
    console.log('Vision API Test Result:', result);
    
    if (result.success) {
      console.log('✅ Vision API is working correctly');
    } else {
      console.log('❌ Vision API failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Vision API test failed:', error);
  }
};

testVisionAPI();